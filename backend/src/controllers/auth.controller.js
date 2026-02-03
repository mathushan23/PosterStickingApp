const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  if (!user.is_active) return res.status(403).json({ message: "User is inactive" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

  res.json({
    accessToken: token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};

exports.me = async (req, res) => {
  const [rows] = await pool.query("SELECT id,name,email,role,is_active,created_at FROM users WHERE id=?", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ message: "User not found" });
  res.json({ user: rows[0] });
};
