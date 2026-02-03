const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const userCtrl = require("../controllers/user.controller");
const { upload } = require("../upload/multer");

router.use(auth, requireRole("user"));

router.post("/submissions", upload.single("proof"), userCtrl.submitProof);
router.get("/submissions", userCtrl.mySubmissions);

module.exports = router;
