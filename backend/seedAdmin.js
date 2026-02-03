require("dotenv").config();
const pool = require("./src/db");
const bcrypt = require("bcrypt");

async function seed() {
  const email = "admin@example.com";
  const password = "Admin@12345";
  const name = "System Admin";

  const [rows] = await pool.query("SELECT id FROM users WHERE email=?", [email]);
  if (rows.length) {
    console.log("Admin already exists:", email);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users(name,email,password_hash,role,is_active) VALUES(?,?,?,?,1)",
    [name, email, hash, "admin"]
  );

  console.log("✅ Admin created");
  console.log("Email:", email);
  console.log("Password:", password);
  process.exit(0);
}
seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
