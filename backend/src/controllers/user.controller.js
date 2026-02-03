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
    const { latitude, longitude, note, address } = req.body || {};
    const addressText = (address || "").trim();
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!req.file) return res.status(400).json({ message: "Proof file is required" });
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid latitude and longitude required" });
    }

    // determine proof type + size rule
    const mime = (req.file.mimetype || "").toLowerCase();
    const size = req.file.size;

    let proof_type = null;
    if (imageMimes.has(mime)) {
      proof_type = "image";
      if (size > MAX_IMAGE) return res.status(400).json({ message: "Image size must be <= 5MB" });
    } else if (videoMimes.has(mime)) {
      proof_type = "video";
      if (size > MAX_VIDEO) return res.status(400).json({ message: "Video size must be <= 50MB" });
    } else {
      return res.status(400).json({ message: "Invalid file mime" });
    }

    const proof_url = `/uploads/proofs/${req.file.filename}`;

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
    const now = new Date();

    let spotId;
    let spotLastStuckAt = null;

    if (near.length) {
      const spot = near[0];
      spotId = spot.id;
      spotLastStuckAt = spot.last_stuck_at;

      // if (spotLastStuckAt) {
      //   const next = addMonths(spotLastStuckAt, 3);
      //   if (now < next) {
      //     return res.status(409).json({
      //       message: "This location was already updated recently.",
      //       next_available_date: next.toISOString(),
      //     });
      //   }
      // }

      // allowed: insert submission + update spot
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [ins] = await conn.query(
          `
          INSERT INTO submissions
          (user_id, spot_id, proof_url, proof_type, proof_mime, proof_size,
           submitted_latitude, submitted_longitude, note)
          VALUES (?,?,?,?,?,?,?,?,?)
          `,
          [userId, spotId, proof_url, proof_type, mime, size, lat, lng, note || null]
        );

        await conn.query(
          `
          UPDATE spots 
          SET last_stuck_at=NOW(), last_stuck_by=?, address_text=?
          WHERE id=?
          `,
          [userId, addressText || null, spotId]
        );


        await conn.commit();
        return res.status(201).json({
          message: "Submission successful",
          submission_id: ins.insertId,
          spot_id: spotId,
        });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } else {
      // create new spot + submission
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [spotIns] = await conn.query(
          `
          INSERT INTO spots(latitude, longitude, address_text, last_stuck_at, last_stuck_by)
          VALUES(?,?,?,NOW(),?)
          `,
          [lat, lng, addressText || null, userId]
        );


        spotId = spotIns.insertId;

        const [subIns] = await conn.query(
          `
          INSERT INTO submissions
          (user_id, spot_id, proof_url, proof_type, proof_mime, proof_size,
           submitted_latitude, submitted_longitude, note)
          VALUES (?,?,?,?,?,?,?,?,?)
          `,
          [userId, spotId, proof_url, proof_type, mime, size, lat, lng, note || null]
        );

        await conn.commit();
        return res.status(201).json({
          message: "Submission successful (new spot created)",
          submission_id: subIns.insertId,
          spot_id: spotId,
        });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
    } catch (e) {
    console.error("SUBMIT PROOF ERROR ↓↓↓");
    console.error(e);

    return res.status(500).json({
        message: "Server error",
        error: e.message,
    });
    }

};

exports.mySubmissions = async (req, res) => {
  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT 
      s.id, s.submitted_at, s.proof_url, s.proof_type,
      s.submitted_latitude, s.submitted_longitude,
      s.spot_id,
      sp.latitude as spot_latitude,
      sp.longitude as spot_longitude,
      sp.address_text,
      sp.last_stuck_at,
      sp.last_stuck_by
    FROM submissions s
    JOIN spots sp ON sp.id = s.spot_id
    WHERE s.user_id=?
    ORDER BY s.submitted_at DESC
    `,
    [userId]
  );


  const data = rows.map((r) => ({
    ...r,
    maps_link: `https://www.google.com/maps?q=${r.submitted_latitude},${r.submitted_longitude}`,
  }));

  res.json({ submissions: data });
};
