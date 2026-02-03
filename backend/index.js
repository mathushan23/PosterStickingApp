require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");


const authRoutes = require("./src/routes/auth.routes");
const adminRoutes = require("./src/routes/admin.routes");
const userRoutes = require("./src/routes/user.routes");


const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) =>
  res.json({ ok: true, message: "Backend running" })
);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);

app.use((err, req, res, next) => {
  if (err) {
    // Multer/fileFilter errors
    if (String(err.message || "").toLowerCase().includes("invalid file type")) {
      return res.status(400).json({ message: err.message });
    }

    // Multer file size errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large" });
    }

    console.error("GLOBAL ERROR:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));



const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
