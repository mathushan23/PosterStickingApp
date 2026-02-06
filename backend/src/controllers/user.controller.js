const pool = require("../db");
const path = require("path");
const { addMonths } = require("../utils/date");

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMimes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const MAX_ASSIGN_DISTANCE_M = 20;
const MAX_NEAR_DISTANCE_M = 20;

// ✅ JS Haversine (reliable, no SQL param confusion)
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

// ✅ Extract "Colombo" from "... , Colombo District, ..."
function extractDistrict(addressText) {
  if (!addressText) return null;
  return addressText.match(/,\s*([^,]+)\s+District\s*,/i)?.[1]?.trim() || null;
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
          return res
            .status(400)
            .json({ message: `Image ${file.originalname} is too large (>5MB)` });
        }
      } else if (videoMimes.has(mime)) {
        proof_type = "video";
        if (size > MAX_VIDEO) {
          return res
            .status(400)
            .json({ message: `Video ${file.originalname} is too large (>50MB)` });
        }
      } else {
        return res
          .status(400)
          .json({ message: `Invalid file type for ${file.originalname}` });
      }

      processedFiles.push({
        url: `/uploads/proofs/${file.filename}`,
        type: proof_type, // "image" | "video"
        mime,
        size,
      });
    }

    const userId = req.user.id;
    const now = new Date();
    const assignmentId = assignment_id ? Number(assignment_id) : null;
    const districtFromAddress = extractDistrict(addressText);

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
            sp.district,
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

        // ✅ cooldown check
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

        // ✅ distance check (JS)
        const distanceM = haversineMeters(
          lat,
          lng,
          Number(a.spot_latitude),
          Number(a.spot_longitude)
        );

        if (!Number.isFinite(distanceM)) {
          await conn.rollback();
          return res
            .status(409)
            .json({ message: "Unable to verify distance. Please try again." });
        }

        if (distanceM > MAX_ASSIGN_DISTANCE_M) {
          await conn.rollback();
          return res.status(409).json({
            message:
              "You are not at the assigned location. Please go to the assigned spot and try again.",
            allowed_distance_m: MAX_ASSIGN_DISTANCE_M,
            distance_m: Math.round(distanceM),
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

        // ✅ update spot (keep existing district if already set, otherwise set from address)
        await conn.query(
          `
          UPDATE spots 
          SET last_stuck_at=NOW(),
              last_stuck_by=?,
              address_text=?,
              district=COALESCE(district, ?)
          WHERE id=?
          `,
          [userId, addressText || null, districtFromAddress, spotId]
        );
      }

      // ======================================================
      // ✅ NORMAL MODE: nearest spot within 20m (JS distance)
      // ======================================================
      if (!assignmentId) {
        // read all spots (OK for small/medium data). If huge, optimize later.
        const [spots] = await conn.query(
          `SELECT id, latitude, longitude, last_stuck_at, district, address_text FROM spots`
        );

        let nearest = null;

        for (const s of spots) {
          const d = haversineMeters(
            lat,
            lng,
            Number(s.latitude),
            Number(s.longitude)
          );

          if (Number.isFinite(d) && d <= MAX_NEAR_DISTANCE_M) {
            if (!nearest || d < nearest.distance_m) {
              nearest = { ...s, distance_m: d };
            }
          }
        }

        if (nearest) {
          spotId = nearest.id;

          // ✅ cooldown check
          if (nearest.last_stuck_at) {
            const next = addMonths(nearest.last_stuck_at, 3);
            if (now < next) {
              await conn.rollback();
              return res.status(409).json({
                message: "This location was already updated recently.",
                next_available_date: next.toISOString(),
              });
            }
          }

          await conn.query(
            `
            UPDATE spots
            SET last_stuck_at=NOW(),
                last_stuck_by=?,
                address_text=?,
                district=COALESCE(district, ?)
            WHERE id=?
            `,
            [userId, addressText || null, districtFromAddress, spotId]
          );
        } else {
          const [spotIns] = await conn.query(
            `
            INSERT INTO spots(latitude, longitude, address_text, district, last_stuck_at, last_stuck_by)
            VALUES(?,?,?,?,NOW(),?)
            `,
            [lat, lng, addressText || null, districtFromAddress, userId]
          );
          spotId = spotIns.insertId;
        }
      }

      // -----------------------------
      // Insert submission + proofs
      // -----------------------------
      const primaryProof = processedFiles[0];
      const proofType = primaryProof.type; // ✅ "image" | "video" (matches ENUM)

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
          proofType,
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
      s.assignment_id,
      sp.latitude as spot_latitude,
      sp.longitude as spot_longitude,
      sp.address_text,
      sp.district
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

  const subIds = submissions.map((s) => s.id);
  const [proofs] = await pool.query(
    `SELECT * FROM submission_proofs WHERE submission_id IN (?)`,
    [subIds]
  );

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
      s.address_text,
      s.district
    FROM spot_assignments a
    JOIN spots s ON s.id = a.spot_id
    WHERE a.user_id=? AND a.status='assigned'
    ORDER BY a.assigned_at DESC
    `,
    [userId]
  );

  res.json({ assignments: rows });
};
