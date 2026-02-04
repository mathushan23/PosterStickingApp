const pool = require("../db");
const path = require("path");
const { addMonths } = require("../utils/date");
const { haversineMetersSQL } = require("../utils/haversineSql");

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMimes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const MAX_ASSIGN_DISTANCE_M = 20;

function distanceMetersSQL() {
  // distance between (lat1,lng1) and (lat2,lng2)
  // params: lat1, lng1, lat2, lng2
  return `
    (6371000 * acos(
      cos(radians(?)) * cos(radians(?)) *
      cos(radians(?) - radians(?)) +
      sin(radians(?)) * sin(radians(?))
    ))
  `;
}


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

    // ✅ process uploaded files
    const processedFiles = [];
    for (const file of req.files) {
      const mime = (file.mimetype || "").toLowerCase();
      const size = file.size;

      let proof_type = null;
      if (imageMimes.has(mime)) {
        proof_type = "image";
        if (size > MAX_IMAGE) {
          return res.status(400).json({ message: `Image ${file.originalname} is too large (>5MB)` });
        }
      } else if (videoMimes.has(mime)) {
        proof_type = "video";
        if (size > MAX_VIDEO) {
          return res.status(400).json({ message: `Video ${file.originalname} is too large (>50MB)` });
        }
      } else {
        return res.status(400).json({ message: `Invalid file type for ${file.originalname}` });
      }

      processedFiles.push({
        url: `/uploads/proofs/${file.filename}`,
        type: proof_type,
        mime,
        size,
      });
    }

    const userId = req.user.id;
    const now = new Date();
    const assignmentId = assignment_id ? Number(assignment_id) : null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let spotId = null;

      // ======================================================
      // ✅ ASSIGNMENT MODE: must be at the assigned spot
      // ======================================================
      if (assignmentId) {
        const [aRows] = await conn.query(
          `
          SELECT 
            a.id AS assignment_id,
            a.status,
            a.user_id,
            a.spot_id,
            sp.latitude AS spot_latitude,
            sp.longitude AS spot_longitude,
            sp.address_text,
            sp.last_stuck_at
          FROM spot_assignments a
          JOIN spots sp ON sp.id = a.spot_id
          WHERE a.id=? AND a.user_id=?
          LIMIT 1
          `,
          [assignmentId, userId]
        );

        if (!aRows.length) {
          await conn.rollback();
          return res.status(404).json({ message: "Assignment not found" });
        }

        const a = aRows[0];

        if (a.status !== "assigned") {
          await conn.rollback();
          return res.status(409).json({ message: "This assignment is not active" });
        }

        // optional cooldown check
        if (a.last_stuck_at) {
          const next = addMonths(a.last_stuck_at, 3);
          if (now < next) {
            await conn.rollback();
            return res.status(409).json({
              message: "This assigned spot is still in cooldown",
              next_available_date: next.toISOString(),
            });
          }
        }

        // ✅ distance check to the assigned spot ONLY
        const distSql = haversineMetersSQL();

        const [dRows] = await conn.query(
          `
          SELECT ${distSql} AS distance_m
          FROM spots
          WHERE id=?
          LIMIT 1
          `,
          [lat, lng, lat, a.spot_id]
        );

        const distanceM = Number(dRows?.[0]?.distance_m);

        if (!Number.isFinite(distanceM)) {
          await conn.rollback();
          return res.status(409).json({
            message: "Unable to verify distance to assigned location. Please try again.",
          });
        }

        if (distanceM > MAX_ASSIGN_DISTANCE_M) {
          await conn.rollback();
          return res.status(409).json({
            message: "You are not at the assigned location. Please go to the assigned spot and try again.",
            allowed_distance_m: MAX_ASSIGN_DISTANCE_M,
            distance_m: distanceM,
            assigned_spot: {
              spot_id: a.spot_id,
              latitude: a.spot_latitude,
              longitude: a.spot_longitude,
              address_text: a.address_text || null,
              maps_link: `https://www.google.com/maps?q=${a.spot_latitude},${a.spot_longitude}`,
            },
          });
        }

        // lock spotId to assignment spot
        spotId = a.spot_id;

        await conn.query(
          `UPDATE spots SET last_stuck_at=NOW(), last_stuck_by=?, address_text=? WHERE id=?`,
          [userId, addressText || null, spotId]
        );
      }


      // ======================================================
      // ✅ NORMAL MODE: your old nearest-spot logic
      // ======================================================
      if (!assignmentId) {
        const distSql = haversineMetersSQL();
        const [near] = await conn.query(
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

        if (near.length) {
          spotId = near[0].id;

          if (near[0].last_stuck_at) {
            const next = addMonths(near[0].last_stuck_at, 3);
            if (now < next) {
              await conn.rollback();
              return res.status(409).json({
                message: "This location was already updated recently.",
                next_available_date: next.toISOString(),
              });
            }
          }

          await conn.query(
            `UPDATE spots SET last_stuck_at=NOW(), last_stuck_by=?, address_text=? WHERE id=?`,
            [userId, addressText || null, spotId]
          );
        } else {
          const [spotIns] = await conn.query(
            `INSERT INTO spots(latitude, longitude, address_text, last_stuck_at, last_stuck_by)
             VALUES(?,?,?,NOW(),?)`,
            [lat, lng, addressText || null, userId]
          );
          spotId = spotIns.insertId;
        }
      }

      // -----------------------------
      // Insert submission + proofs
      // -----------------------------
      const hasImage = processedFiles.some((f) => f.type === "image");
      const hasVideo = processedFiles.some((f) => f.type === "video");
      let summaryType = "";
      if (hasImage && hasVideo) summaryType = "IMAGE and VIDEO";
      else if (hasVideo) summaryType = "VIDEOS";
      else summaryType = "IMAGE";

      const primaryProof = processedFiles[0];

      const [subIns] = await conn.query(
        `
        INSERT INTO submissions
        (user_id, spot_id, assignment_id, proof_url, proof_type, proof_mime, proof_size,
         submitted_latitude, submitted_longitude, note)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
          userId,
          spotId,
          assignmentId,
          primaryProof.url,
          summaryType,
          primaryProof.mime,
          primaryProof.size,
          lat,
          lng,
          note || null,
        ]
      );

      const submissionId = subIns.insertId;

      for (const f of processedFiles) {
        await conn.query(
          `
          INSERT INTO submission_proofs
          (submission_id, proof_url, proof_type, proof_mime, proof_size)
          VALUES (?, ?, ?, ?, ?)
          `,
          [submissionId, f.url, f.type, f.mime, f.size]
        );
      }

      // ✅ if assignment => mark completed
      if (assignmentId) {
        await conn.query(
          `
          UPDATE spot_assignments
          SET status='completed', completed_at=NOW()
          WHERE id=? AND user_id=? AND status='assigned'
          `,
          [assignmentId, userId]
        );
      }

      await conn.commit();

      return res.status(201).json({
        message: assignmentId ? "Assignment submission successful" : "Submission successful",
        submission_id: submissionId,
        spot_id: spotId,
        assignment_id: assignmentId || null,
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

exports.myAssignments = async (req, res) => {
  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT 
      a.id AS assignment_id,
      a.assigned_at,
      s.id AS spot_id,
      s.latitude,
      s.longitude,
      s.address_text
    FROM spot_assignments a
    JOIN spots s ON s.id = a.spot_id
    WHERE a.user_id=? AND a.status='assigned'
    ORDER BY a.assigned_at DESC
    `,
    [userId]
  );

  res.json({ assignments: rows });
};


