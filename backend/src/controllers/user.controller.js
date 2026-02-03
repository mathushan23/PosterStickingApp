const pool = require("../db");
const path = require("path");
const { addMonths } = require("../utils/date");
const { haversineMetersSQL } = require("../utils/haversineSql");

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMimes = new Set(["video/mp4", "video/webm", "video/quicktime"]);



exports.submitProof = async (req, res) => {
  try {
    const { latitude, longitude, note, address, assignment_id } = req.body || {};
    const addressText = (address || "").trim();
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one proof file is required" });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid latitude and longitude required" });
    }

    const processedFiles = [];
    for (const file of req.files) {
      const mime = (file.mimetype || "").toLowerCase();
      const size = file.size;

      let proof_type = null;
      if (imageMimes.has(mime)) {
        proof_type = "image";
        if (size > MAX_IMAGE) return res.status(400).json({ message: `Image ${file.originalname} is too large (>5MB)` });
      } else if (videoMimes.has(mime)) {
        proof_type = "video";
        if (size > MAX_VIDEO) return res.status(400).json({ message: `Video ${file.originalname} is too large (>50MB)` });
      } else {
        return res.status(400).json({ message: `Invalid file type for ${file.originalname}` });
      }

      processedFiles.push({
        url: `/uploads/proofs/${file.filename}`,
        type: proof_type,
        mime: mime,
        size: size
      });
    }

    // find nearest spot within 20m
    const distSql = haversineMetersSQL();
    const [near] = await pool.query(
      `
      SELECT 
          id, latitude, longitude, last_stuck_at,
          ${distSql} AS distance_m
      FROM spots
      HAVING distance_m <= 20
      ORDER BY distance_m ASC
      LIMIT 1
      `,
      [lat, lng, lat]
    );

    const userId = req.user.id;
    let spotId;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (near.length) {
        spotId = near[0].id;
        await conn.query(
          `UPDATE spots SET last_stuck_at=NOW(), last_stuck_by=?, address_text=? WHERE id=?`,
          [userId, addressText || null, spotId]
        );
      } else {
        const [spotIns] = await conn.query(
          `INSERT INTO spots(latitude, longitude, address_text, last_stuck_at, last_stuck_by) VALUES(?,?,?,NOW(),?)`,
          [lat, lng, addressText || null, userId]
        );
        spotId = spotIns.insertId;
      }

      // Insert Submission record with summary proof type
      const hasImage = processedFiles.some(f => f.type === "image");
      const hasVideo = processedFiles.some(f => f.type === "video");
      let summaryType = "";
      if (hasImage && hasVideo) summaryType = "IMAGE and VIDEO";
      else if (hasVideo) summaryType = "VIDEOS";
      else summaryType = "IMAGE";

      const primaryProof = processedFiles[0];
      const [subIns] = await conn.query(
        `
        INSERT INTO submissions
        (user_id, spot_id, proof_url, proof_type, proof_mime, proof_size,
         submitted_latitude, submitted_longitude, note)
        VALUES (?,?,?,?,?,?,?,?,?)
        `,
        [userId, spotId, primaryProof.url, summaryType, primaryProof.mime, primaryProof.size, lat, lng, note || null]
      );

      const submissionId = subIns.insertId;

      // Insert all proofs into submission_proofs
      for (const f of processedFiles) {
        await conn.query(
          `
          INSERT INTO submission_proofs (submission_id, proof_url, proof_type, proof_mime, proof_size)
          VALUES (?, ?, ?, ?, ?)
          `,
          [submissionId, f.url, f.type, f.mime, f.size]
        );
      }

      await conn.commit();
      return res.status(201).json({
        message: "Submission successful",
        submission_id: submissionId,
        spot_id: spotId,
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("SUBMIT PROOF ERROR", e);
    return res.status(500).json({ message: "Server error", error: e.message });
  }
};


exports.mySubmissions = async (req, res) => {
  const userId = req.user.id;

  const [submissions] = await pool.query(
    `
    SELECT 
      s.id, s.submitted_at, s.proof_url, s.proof_type,
      s.submitted_latitude, s.submitted_longitude,
      s.spot_id, s.note,
      sp.latitude as spot_latitude,
      sp.longitude as spot_longitude,
      sp.address_text
    FROM submissions s
    JOIN spots sp ON sp.id = s.spot_id
    WHERE s.user_id=?
    ORDER BY s.submitted_at DESC
    `,
    [userId]
  );

  if (submissions.length === 0) {
    return res.json({ submissions: [] });
  }

  // Fetch all proofs for these submissions
  const subIds = submissions.map(s => s.id);
  const [proofs] = await pool.query(
    `SELECT * FROM submission_proofs WHERE submission_id IN (?)`,
    [subIds]
  );

  // Group proofs by submission_id
  const proofsMap = proofs.reduce((acc, p) => {
    if (!acc[p.submission_id]) acc[p.submission_id] = [];
    acc[p.submission_id].push(p);
    return acc;
  }, {});

  const data = submissions.map((s) => ({
    ...s,
    proofs: proofsMap[s.id] || [],
    maps_link: `https://www.google.com/maps?q=${s.submitted_latitude},${s.submitted_longitude}`,
  }));

  res.json({ submissions: data });
};


