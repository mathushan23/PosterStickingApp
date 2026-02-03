const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "..", "uploads", "proofs");
fs.mkdirSync(uploadDir, { recursive: true });

// allowed extensions
const imageExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const videoExt = new Set([".mp4", ".webm", ".mov"]);

// allowed mime
const imageMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMime = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, safe);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  const isImgByExt = imageExt.has(ext);
  const isVidByExt = videoExt.has(ext);

  const isImgByMime = imageMime.has(mime) || mime.startsWith("image/");
  const isVidByMime = videoMime.has(mime) || mime.startsWith("video/");

  // ✅ allow if EXT looks valid OR MIME looks valid
  const ok = (isImgByExt && isImgByMime) || (isVidByExt && isVidByMime) ||
             isImgByExt || isVidByExt || isImgByMime || isVidByMime;

  if (!ok) {
    return cb(
      new Error(
        `Invalid file type. Got ext=${ext}, mime=${mime}. Allowed: jpg/jpeg/png/webp, mp4/webm/mov`
      )
    );
  }

  cb(null, true);
}

// size limits: image 5MB, video 50MB
// Multer has only one limit, so we set to 50MB max and do fine-grained check later
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = { upload, imageMime, videoMime };
