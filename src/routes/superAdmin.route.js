const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/auth.middleware");
const requireSuperAdmin = require("../middleware/superAdmin.middleware");
const {
  getSystemOverview,
  getUsersDirectory,
  getUserDetails,
  provisionUser,
  updateUserProfile,
  updateUserDeviceLimit,
  updateUserStatus,
  resetUserPassword,
  forceLogoutUser,
  unlockUserAccount,
  getSessionsDirectory,
  revokeSessionById,
  getSystemConfig,
  updateSystemConfig,
  getMaintenanceConfig,
  updateMaintenanceConfig,
  sendAdminNotification,
  getNotificationHistory,
  getAuditLogs,
  impersonateUser,
  getSuperAdminAppVersionConfig,
  updateSuperAdminAppVersionConfig,
  testPilotUserEligibility,
  deleteSuperAdminAppRelease,
  deleteSuperAdminPilotRelease,
  getMessNotificationSchedule,
  updateMessNotificationSchedule,
  testMessNotificationBroadcast,
} = require("../controllers/superAdmin.controllers");

// Privileged operations rate limiter (120 requests per 15 minutes per IP)
const superAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Super Admin rate limit reached. Please try again shortly.",
  },
});

// Stricter rate limiter for sensitive write operations (30 writes per 15 minutes)
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Sensitive action threshold reached. Please wait before attempting further modifications.",
  },
});

// All superadmin routes require authentication and superadmin privileges
router.use(authMiddleware);
router.use(requireSuperAdmin);
router.use(superAdminLimiter);

// System Overview
router.get("/overview", getSystemOverview);

// User Management
router.get("/users", getUsersDirectory);
router.post("/users", sensitiveActionLimiter, provisionUser);
router.get("/users/:userId", getUserDetails);
router.patch("/users/:userId", sensitiveActionLimiter, updateUserProfile);
router.patch("/users/:userId/device-limit", sensitiveActionLimiter, updateUserDeviceLimit);
router.patch("/users/:userId/status", sensitiveActionLimiter, updateUserStatus);
router.post("/users/:userId/reset-password", sensitiveActionLimiter, resetUserPassword);
router.post("/users/:userId/force-logout", sensitiveActionLimiter, forceLogoutUser);
router.post("/users/:userId/impersonate", sensitiveActionLimiter, impersonateUser);
router.post("/users/:userId/unlock", sensitiveActionLimiter, unlockUserAccount);

// Session & Device Management
router.get("/sessions", getSessionsDirectory);
router.delete("/sessions/:sessionId", sensitiveActionLimiter, revokeSessionById);

// System Configuration & Login Limits
router.get("/config", getSystemConfig);
router.put("/config", sensitiveActionLimiter, updateSystemConfig);

// Maintenance Mode Configuration
router.get("/maintenance", getMaintenanceConfig);
router.put("/maintenance", sensitiveActionLimiter, updateMaintenanceConfig);

// App Version & In-App Update Management
router.get("/app-version", getSuperAdminAppVersionConfig);
router.put("/app-version", sensitiveActionLimiter, updateSuperAdminAppVersionConfig);
router.delete("/app-version/release", sensitiveActionLimiter, deleteSuperAdminAppRelease);
router.delete("/pilot-testing/release", sensitiveActionLimiter, deleteSuperAdminPilotRelease);
router.post("/pilot-testing/test-user", testPilotUserEligibility);

// Notification Center
router.post("/notifications/send", sensitiveActionLimiter, sendAdminNotification);
router.get("/notifications", getNotificationHistory);

// Autonomous Mess Menu Auto-Notification Schedule & Test Engine
router.get("/mess-notifications", getMessNotificationSchedule);
router.put("/mess-notifications", sensitiveActionLimiter, updateMessNotificationSchedule);
router.post("/mess-notifications/test", sensitiveActionLimiter, testMessNotificationBroadcast);

// Audit Logs
router.get("/audit-logs", getAuditLogs);

module.exports = router;
