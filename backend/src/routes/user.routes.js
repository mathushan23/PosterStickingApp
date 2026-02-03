const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const userCtrl = require("../controllers/user.controller");
const { upload } = require("../upload/multer");

router.use(auth, requireRole("user"));

router.post("/submissions", upload.array("proof", 10), userCtrl.submitProof);
router.get("/submissions", userCtrl.mySubmissions);
router.get("/assignments", userCtrl.myAssignments);

module.exports = router;
