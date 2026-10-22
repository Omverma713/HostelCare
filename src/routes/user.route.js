const express = require("express");
const router = express.Router();
const {
  activateUser,
  loggedInUser,
  getMySessions,
  revokeMySession,
  logoutUser,
  registerPushToken,
} = require("../controllers/user.controllers");
const authMiddleware = require("../middleware/auth.middleware");
const {
  savingComplaint,
  findingcomplaint,
  caretakerComplaints,
  updateComplaint,
  wardernDashboard,
  updateComplaintbyid,
  staffPerformance,
} = require("../controllers/comaplaint.controllers");

const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

router.post("/activate", activateUser);
router.post("/login", loginLimiter, loggedInUser);
router.post("/logout", authMiddleware, logoutUser);
router.get("/my-sessions", authMiddleware, getMySessions);
router.delete("/my-sessions/:sessionId", authMiddleware, revokeMySession);
router.post("/register-push-token", authMiddleware, registerPushToken);

router.post("/complaints", authMiddleware, savingComplaint);
router.get("/hostel-complaints", authMiddleware, findingcomplaint);
router.get("/caretaker/complaints", authMiddleware, caretakerComplaints);
router.patch("/update-complaint/:id", authMiddleware, updateComplaintbyid);
router.get("/warden/dashboard", authMiddleware, wardernDashboard);
router.get(
  "/superintendent/staff-performance",
  authMiddleware,
  staffPerformance
);

module.exports = router;