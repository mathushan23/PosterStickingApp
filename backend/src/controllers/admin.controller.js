const pool = require("../db");
const bcrypt = require("bcrypt");
const { addMonths } = require("../utils/date");
const { haversineMetersSQL } = require("../utils/haversineSql");

// --------------------
// Users
// --------------------
exports.createUser = async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name,email,password required" });
  }

  const userRole = role === "admin" ? "admin" : "user";
  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users(name,email,password_hash,role,is_active) VALUES(?,?,?,?,1)",
      [name, email, hash, userRole]
    );
    return res.status(201).json({ message: "User created" });
  } catch (e) {
    if (String(e.message).toLowerCase().includes("duplicate")) {
      return res.status(409).json({ message: "Email already exists" });
    }
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listUsers = async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id,name,email,role,is_active,created_at FROM users ORDER BY created_at DESC"
  );
  return res.json({ users: rows });
};

exports.updateUserStatus = async (req, res) => {
  const id = Number(req.params.id);
  const { is_active } = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid user id" });

  await pool.query("UPDATE users SET is_active=? WHERE id=?", [is_active ? 1 : 0, id]);
  return res.json({ message: "Status updated" });
};

// --------------------
// Admin Submissions
// --------------------
exports.listSubmissions = async (req, res) => {
  const { user, start, end } = req.query;

  let where = "WHERE 1=1";
  const params = [];

  if (user) {
    where += " AND (u.name LIKE ? OR u.email LIKE ?)";
    params.push(`%${user}%`, `%${user}%`);
  }
  if (start) {
    where += " AND s.submitted_at >= ?";
    params.push(start);
  }
  if (end) {
    where += " AND s.submitted_at <= ?";
    params.push(end);
  }

  const [rows] = await pool.query(
    `
    SELECT 
      s.id, s.submitted_at, s.proof_url, s.proof_type,
      s.submitted_latitude, s.submitted_longitude,
      u.name as user_name, u.email as user_email,
      sp.id as spot_id,
      sp.latitude as spot_latitude,
      sp.longitude as spot_longitude,
      sp.address_text,
      sp.last_stuck_at,
      COALESCE(SUM(CASE WHEN pr.proof_type = 'image' THEN 1 ELSE 0 END), 0) as img_count,
      COALESCE(SUM(CASE WHEN pr.proof_type = 'video' THEN 1 ELSE 0 END), 0) as vid_count
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN spots sp ON sp.id = s.spot_id
    LEFT JOIN submission_proofs pr ON pr.submission_id = s.id
    ${where}
    GROUP BY s.id, u.id, sp.id
    ORDER BY s.submitted_at DESC
    `,
    params
  );

  const data = rows.map((r) => ({
    ...r,
    next_available_date: r.last_stuck_at
      ? addMonths(r.last_stuck_at, 3).toISOString()
      : null,
  }));

  return res.json({ submissions: data });
};


exports.getSubmissionDetails = async (req, res) => {
  const id = Number(req.params.id);

  const [rows] = await pool.query(
    `
    SELECT 
      s.*, 
      u.name as user_name, 
      u.email as user_email,
      sp.id as spot_id,
      sp.latitude as spot_latitude, 
      sp.longitude as spot_longitude,
      sp.address_text,
      sp.last_stuck_at, 
      sp.last_stuck_by
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN spots sp ON sp.id = s.spot_id
    WHERE s.id = ?
    LIMIT 1
    `,
    [id]
  );

  const sub = rows[0];
  if (!sub) return res.status(404).json({ message: "Not found" });

  const [proofs] = await pool.query(
    `SELECT * FROM submission_proofs WHERE submission_id = ?`,
    [id]
  );

  return res.json({
    submission: {
      ...sub,
      proofs: proofs,
      next_available_date: sub.last_stuck_at
        ? addMonths(sub.last_stuck_at, 3).toISOString()
        : null,
      maps_link: `https://www.google.com/maps?q=${sub.submitted_latitude},${sub.submitted_longitude}`,
    },
  });
};



// --------------------
// Spots
// --------------------
exports.listSpots = async (req, res) => {
  const [rows] = await pool.query(
    `
    SELECT 
      sp.id,
      sp.latitude,
      sp.longitude,
      sp.address_text,
      sp.district,
      sp.last_stuck_at,
      sp.last_stuck_by,

      u_last.name  AS last_stuck_by_name,
      u_last.email AS last_stuck_by_email,

      a.user_id AS assigned_user_id,
      u_ass.name AS assigned_user_name,
      u_ass.email AS assigned_user_email,

      (SELECT COUNT(*) FROM submissions s WHERE s.spot_id = sp.id) AS submissions_count

    FROM spots sp
    LEFT JOIN users u_last ON u_last.id = sp.last_stuck_by

    -- ✅ only the CURRENT active assignment
    LEFT JOIN spot_assignments a 
      ON a.spot_id = sp.id AND a.status = 'assigned'

    LEFT JOIN users u_ass ON u_ass.id = a.user_id

    ORDER BY sp.last_stuck_at DESC, sp.id DESC
    `
  );

  const data = rows.map((r) => ({
    ...r,
    next_available_date: r.last_stuck_at
      ? addMonths(r.last_stuck_at, 3).toISOString()
      : null,
  }));

  return res.json({ spots: data });
};


exports.getSpotDetails = async (req, res) => {
  const id = Number(req.params.id);

  const [spotRows] = await pool.query(
    `
    SELECT sp.*, u.name as last_stuck_by_name, u.email as last_stuck_by_email
    FROM spots sp
    LEFT JOIN users u ON u.id = sp.last_stuck_by
    WHERE sp.id=?
    LIMIT 1
    `,
    [id]
  );

  const spot = spotRows[0];
  if (!spot) return res.status(404).json({ message: "Spot not found" });

  const [subs] = await pool.query(
    `
    SELECT 
      s.id, s.proof_url, s.proof_type, s.submitted_at, 
      s.submitted_latitude, s.submitted_longitude,
      u.name as user_name, u.email as user_email,
      COALESCE(SUM(CASE WHEN pr.proof_type = 'image' THEN 1 ELSE 0 END), 0) as img_count,
      COALESCE(SUM(CASE WHEN pr.proof_type = 'video' THEN 1 ELSE 0 END), 0) as vid_count
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN submission_proofs pr ON pr.submission_id = s.id
    WHERE s.spot_id=?
    GROUP BY s.id, u.id
    ORDER BY s.submitted_at DESC
    `,
    [id]
  );

  return res.json({
    spot: {
      ...spot,
      next_available_date: spot.last_stuck_at
        ? addMonths(spot.last_stuck_at, 3).toISOString()
        : null,
      maps_link: `https://www.google.com/maps?q=${spot.latitude},${spot.longitude}`,
    },
    submissions: subs,
  });
};

// --------------------
// Create Spot (Admin)
// --------------------
exports.createSpot = async (req, res) => {
  const { latitude, longitude, address_text } = req.body || {};

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: "Valid latitude and longitude required" });
  }

  const addr = (address_text || "").trim() || null;

  // ✅ district extraction from address_text like "... , Colombo District, ..."
  // Result: "Colombo"
  const districtFromAddress = addr
    ? (addr.match(/,\s*([^,]+)\s+District\s*,/i)?.[1] || null)
    : null;

  const [ins] = await pool.query(
    `
    INSERT INTO spots (latitude, longitude, address_text, district)
    VALUES (?,?,?,?)
    `,
    [lat, lng, addr, districtFromAddress]
  );

  const [rows] = await pool.query("SELECT * FROM spots WHERE id=?", [ins.insertId]);
  return res.status(201).json({ spot: rows[0] });
};


// --------------------
// Check spot availability (Admin)
// --------------------


  exports.checkSpotAvailability = async (req, res) => {
    const { latitude, longitude } = req.body || {};
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid latitude & longitude required" });
    }

    const distSql = haversineMetersSQL();

    const [rows] = await pool.query(
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

    if (!rows.length) {
      return res.json({ available: true });
    }

    const spot = rows[0];

    // if (spot.last_stuck_at) {
    //   const next = addMonths(spot.last_stuck_at, 3);
    //   if (new Date() < next) {
    //     return res.status(409).json({
    //       available: false,
    //       message: "This location is in cooldown period",
    //       next_available_date: next.toISOString(),
    //     });
    //   }
    // }

    return res.json({
      available: true,
      existing_spot_id: spot.id,
    });
  };


exports.assignSpot = async (req, res) => {
  const spot_id = Number(req.body?.spot_id);
  const user_id = Number(req.body?.user_id);
  const adminId = req.user.id;

  if (!Number.isInteger(spot_id) || !Number.isInteger(user_id)) {
    return res.status(400).json({ message: "spot_id and user_id must be valid numbers" });
  }

  // ✅ user must exist + active + role=user
  const [uRows] = await pool.query(
    "SELECT id, role, is_active FROM users WHERE id=? LIMIT 1",
    [user_id]
  );
  if (!uRows.length) {
    return res.status(404).json({ message: "User not found" });
  }
  if (!uRows[0].is_active) {
    return res.status(409).json({ message: "User is inactive" });
  }
  if (uRows[0].role !== "user") {
    return res.status(409).json({ message: "You can only assign spots to users (not admins)" });
  }

  // ✅ spot must exist
  const [spotRows] = await pool.query(
    "SELECT last_stuck_at FROM spots WHERE id=? LIMIT 1",
    [spot_id]
  );
  if (!spotRows.length) {
    return res.status(404).json({ message: "Spot not found" });
  }

  // ✅ cooldown check
  // const last = spotRows[0].last_stuck_at;
  // if (last) {
  //   const next = addMonths(last, 3);
  //   if (new Date() < next) {
  //     return res.status(409).json({
  //       message: "This spot is still in cooldown",
  //       next_available_date: next.toISOString(),
  //     });
  //   }
  // }

  // ✅ prevent duplicate active assignment
  const [active] = await pool.query(
    "SELECT id FROM spot_assignments WHERE spot_id=? AND status='assigned' LIMIT 1",
    [spot_id]
  );
  if (active.length) {
    return res.status(409).json({ message: "This spot is already assigned to another user" });
  }

  await pool.query(
    `INSERT INTO spot_assignments (spot_id, user_id, assigned_by) VALUES (?,?,?)`,
    [spot_id, user_id, adminId]
  );

  return res.json({ message: "Spot assigned successfully" });
};


// --------------------
// Spot Assignments (Admin)
// --------------------
exports.listSpotAssignments = async (req, res) => {
  try {
    const { status, q, from, to } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (status && ["assigned", "completed", "cancelled"].includes(status)) {
      where += " AND a.status = ?";
      params.push(status);
    }

    // search by user name/email or spot address
    if (q && q.trim()) {
      where += " AND (u.name LIKE ? OR u.email LIKE ? OR sp.address_text LIKE ?)";
      params.push(`%${q.trim()}%`, `%${q.trim()}%`, `%${q.trim()}%`);
    }

    if (from) {
      where += " AND a.assigned_at >= ?";
      params.push(from);
    }
    if (to) {
      where += " AND a.assigned_at <= ?";
      params.push(to);
    }

    const [rows] = await pool.query(
      `
      SELECT 
        a.id,
        a.spot_id,
        a.user_id,
        a.assigned_by,
        a.status,
        a.assigned_at,
        a.completed_at,

        u.name AS user_name,
        u.email AS user_email,

        ad.name AS assigned_by_name,
        ad.email AS assigned_by_email,

        sp.latitude,
        sp.longitude,
        sp.address_text,

        -- how many submissions done for this assignment (optional)
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count

      FROM spot_assignments a
      JOIN users u ON u.id = a.user_id
      JOIN users ad ON ad.id = a.assigned_by
      JOIN spots sp ON sp.id = a.spot_id
      ${where}
      ORDER BY a.assigned_at DESC
      `,
      params
    );

    return res.json({ assignments: rows });
  } catch (e) {
    console.error("LIST ASSIGNMENTS ERROR", e);
    return res.status(500).json({ message: "Server error" });
  }
};



