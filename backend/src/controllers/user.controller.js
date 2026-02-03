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
    const userId = req.user.id;

    if (!req.file) return res.status(400).json({ message: "Proof file is required" });
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid latitude and longitude required" });
    }

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
    const now = new Date();

    let spotId;
    let spotLastStuckAt = null;

    // ===== ASSIGNMENT MODE =====
    if (assignment_id) {
      const [rows] = await pool.query(
        `
        SELECT a.id, a.spot_id, s.last_stuck_at
        FROM spot_assignments a
        JOIN spots s ON s.id = a.spot_id
        WHERE a.id=? AND a.user_id=? AND a.status='assigned'
        `,
        [assignment_id, userId]
      );

      if (!rows.length) {
        return res.status(403).json({ message: "Invalid or expired assignment" });
      }

      const assignment = rows[0];
      spotId = assignment.spot_id;
      spotLastStuckAt = assignment.last_stuck_at;

      if (spotLastStuckAt) {
        const next = addMonths(spotLastStuckAt, 3);
        if (now < next) {
          return res.status(409).json({
            message: "This location is still in cooldown",
            next_available_date: next.toISOString(),
          });
        }
      }
    }

    // ===== NORMAL MODE (NEAREST SPOT) =====
    const distSql = haversineMetersSQL();
    const [near] = assignment_id ? [[]] : await pool.query(
      `
      SELECT id, last_stuck_at,
      ${distSql} AS distance_m
      FROM spots
      HAVING distance_m <= 20
      ORDER BY distance_m ASC
      LIMIT 1
      `,
      [lat, lng, lat]
    );

    if (!assignment_id && near.length) {
      spotId = near[0].id;
      spotLastStuckAt = near[0].last_stuck_at;

      if (spotLastStuckAt) {
        const next = addMonths(spotLastStuckAt, 3);
        if (now < next) {
          return res.status(409).json({
            message: "This location was already updated recently.",
            next_available_date: next.toISOString(),
          });
        }
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (!spotId) {
        const [spotIns] = await conn.query(
          `
          INSERT INTO spots(latitude, longitude, address_text, last_stuck_at, last_stuck_by)
          VALUES(?,?,?,NOW(),?)
          `,
          [lat, lng, addressText || null, userId]
        );
        spotId = spotIns.insertId;
      }

      const [ins] = await conn.query(
        `
        INSERT INTO submissions
        (user_id, spot_id, assignment_id, proof_url, proof_type, proof_mime, proof_size,
         submitted_latitude, submitted_longitude, note)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [userId, spotId, assignment_id || null, proof_url, proof_type, mime, size, lat, lng, note || null]
      );

      await conn.query(
        `
        UPDATE spots 
        SET last_stuck_at=NOW(), last_stuck_by=?, address_text=?
        WHERE id=?
        `,
        [userId, addressText || null, spotId]
      );

      if (assignment_id) {
        await conn.query(
          "UPDATE spot_assignments SET status='completed', completed_at=NOW() WHERE id=?",
          [assignment_id]
        );
      }

      await conn.commit();
      res.status(201).json({
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
  } catch (e) {
    console.error("SUBMIT PROOF ERROR ↓↓↓", e);
    res.status(500).json({ message: "Server error", error: e.message });
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

