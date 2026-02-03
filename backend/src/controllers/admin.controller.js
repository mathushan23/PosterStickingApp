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
      sp.last_stuck_at
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN spots sp ON sp.id = s.spot_id
    ${where}
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

  return res.json({
    submission: {
      ...sub,
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
      sp.id, sp.latitude, sp.longitude, sp.address_text, sp.last_stuck_at,
      sp.last_stuck_by, u.name as last_stuck_by_name, u.email as last_stuck_by_email,
      (SELECT COUNT(*) FROM submissions s WHERE s.spot_id = sp.id) as submissions_count
    FROM spots sp
    LEFT JOIN users u ON u.id = sp.last_stuck_by
    ORDER BY sp.last_stuck_at DESC
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
      u.name as user_name, u.email as user_email
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    WHERE s.spot_id=?
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
    return res.status(400).json({
      message: "Valid latitude and longitude required",
    });
  }

  const [ins] = await pool.query(
    `
    INSERT INTO spots (latitude, longitude, address_text)
    VALUES (?,?,?)
    `,
    [lat, lng, (address_text || "").trim() || null]
  );

  const [rows] = await pool.query(
    "SELECT * FROM spots WHERE id=?",
    [ins.insertId]
  );

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

    if (spot.last_stuck_at) {
      const next = addMonths(spot.last_stuck_at, 3);
      if (new Date() < next) {
        return res.status(409).json({
          available: false,
          message: "This location is in cooldown period",
          next_available_date: next.toISOString(),
        });
      }
    }

    return res.json({
      available: true,
      existing_spot_id: spot.id,
    });
  };


exports.assignSpot = async (req, res) => {
  const { spot_id, user_id } = req.body;
  const adminId = req.user.id;

  const [spotRows] = await pool.query(
    "SELECT last_stuck_at FROM spots WHERE id=?",
    [spot_id]
  );
  if (!spotRows.length) {
    return res.status(404).json({ message: "Spot not found" });
  }

  const last = spotRows[0].last_stuck_at;
  if (last) {
    const next = addMonths(last, 3);
    if (new Date() < next) {
      return res.status(409).json({
        message: "This spot is still in cooldown",
        next_available_date: next.toISOString(),
      });
    }
  }

  // prevent duplicate active assignment
  const [active] = await pool.query(
    "SELECT id FROM spot_assignments WHERE spot_id=? AND status='assigned'",
    [spot_id]
  );
  if (active.length) {
    return res.status(409).json({
      message: "This spot is already assigned to another user",
    });
  }

  await pool.query(
    `
    INSERT INTO spot_assignments (spot_id, user_id, assigned_by)
    VALUES (?,?,?)
    `,
    [spot_id, user_id, adminId]
  );

  res.json({ message: "Spot assigned successfully" });
};


