const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const adminCtrl = require("../controllers/admin.controller");

router.use(auth, requireRole("admin"));

// ✅ User Management
router.post("/users", adminCtrl.createUser);
router.get("/users", adminCtrl.listUsers);
router.patch("/users/:id/status", adminCtrl.updateUserStatus);

// ✅ Submission Management
router.get("/submissions", adminCtrl.listSubmissions);
router.get("/submissions/:id", adminCtrl.getSubmissionDetails);

// ✅ Spots Viewer
router.get("/spots", adminCtrl.listSpots);
router.get("/spots/:id", adminCtrl.getSpotDetails);
router.post("/spot-assignments",auth,requireRole("admin"),adminCtrl.assignSpot);
router.post("/spots", adminCtrl.createSpot);
router.post("/spots/check", adminCtrl.checkSpotAvailability);
router.get("/spot-assignments", adminCtrl.listSpotAssignments);



module.exports = router;
