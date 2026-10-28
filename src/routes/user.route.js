const express = require("express");
const router = express.Router();
const {
  activateUser,
  loggedInUser,
  getMySessions,
  revokeMySession,
  logoutUser,
  registerPushToken,
  verifyUserPassword,
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

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

router.post("/activate", activateUser);
router.post("/login", loginLimiter, loggedInUser);
router.post("/logout", authMiddleware, logoutUser);
router.get("/my-sessions", authMiddleware, getMySessions);
router.delete("/my-sessions/:sessionId", authMiddleware, revokeMySession);
router.post("/register-push-token", authMiddleware, registerPushToken);
router.post("/verify-password", authMiddleware, sensitiveActionLimiter, verifyUserPassword);

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

// Global Emergency / Announcement Notice for any user/app
router.get("/active-notice", async (req, res) => {
  try {
    const GlobalNotice = require("../models/globalNotice.model");
    const notice = await GlobalNotice.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, notice: notice || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch active notice", error: error.message });
  }
});

module.exports = router;
