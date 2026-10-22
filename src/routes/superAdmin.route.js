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
  getSessionsDirectory,
  revokeSessionById,
  getSystemConfig,
  updateSystemConfig,
  getMaintenanceConfig,
  updateMaintenanceConfig,
  sendAdminNotification,
  getNotificationHistory,
  getAuditLogs,
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

// Session & Device Management
router.get("/sessions", getSessionsDirectory);
router.delete("/sessions/:sessionId", sensitiveActionLimiter, revokeSessionById);

// System Configuration & Login Limits
router.get("/config", getSystemConfig);
router.put("/config", sensitiveActionLimiter, updateSystemConfig);

// Maintenance Mode Configuration
router.get("/maintenance", getMaintenanceConfig);
router.put("/maintenance", sensitiveActionLimiter, updateMaintenanceConfig);

// Notification Center
router.post("/notifications/send", sensitiveActionLimiter, sendAdminNotification);
router.get("/notifications", getNotificationHistory);

// Audit Logs
router.get("/audit-logs", getAuditLogs);

module.exports = router;
