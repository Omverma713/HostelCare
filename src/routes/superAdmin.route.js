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
  lockUserAccount,
  adjustUserLockDuration,
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
  purgeMessNotificationDispatches,
  getGlobalNotices,
  getActiveGlobalNotice,
  createGlobalNotice,
  toggleGlobalNoticeStatus,
  deleteGlobalNotice,
  getDeviceRegistryDirectory,
  toggleDeviceMuteStatus,
  pingSingleDevice,
  deleteDeviceRegistryEntry,
  broadcastCustomMessAlert,
  simulateAutoFireMessAlert,
  rearmMessSlotForToday,
  flushUserAccount,
  getSuperAdminSelfProfile,
  updateSuperAdminSelfProfile,
  getDelegationsList,
  createDelegation,
  revokeDelegation,
  updateDelegationDuration,
  updateDelegationScopes,
} = require("../controllers/superAdmin.controllers");

const {
  getCbtConfig,
  updateCbtConfig,
  getCbtApplications,
  approveCbtApplication,
  rejectCbtApplication,
  deleteCbtApplication,
  bulkApproveCbtApplications,
} = require("../controllers/cbt.controllers");

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

// Super Admin Self-Profile Management
router.get("/me", getSuperAdminSelfProfile);
router.patch("/me", sensitiveActionLimiter, updateSuperAdminSelfProfile);

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
router.post("/users/:userId/lock", sensitiveActionLimiter, lockUserAccount);
router.patch("/users/:userId/lock-duration", sensitiveActionLimiter, adjustUserLockDuration);
router.post("/users/:userId/flush", sensitiveActionLimiter, flushUserAccount);

// Temporary Sub-Admin Delegation Management
router.get("/delegations", getDelegationsList);
router.post("/delegations", sensitiveActionLimiter, createDelegation);
router.post("/delegations/:delegationId/revoke", sensitiveActionLimiter, revokeDelegation);
router.patch("/delegations/:delegationId/duration", sensitiveActionLimiter, updateDelegationDuration);
router.patch("/delegations/:delegationId/scopes", sensitiveActionLimiter, updateDelegationScopes);

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

// System Audit Logs
router.get("/audit-logs", getAuditLogs);

// Autonomous Mess Menu Auto-Notification Schedule & Test Engine
router.get("/mess-notifications", getMessNotificationSchedule);
router.put("/mess-notifications", sensitiveActionLimiter, updateMessNotificationSchedule);
router.post("/mess-notifications/test", sensitiveActionLimiter, testMessNotificationBroadcast);
router.delete("/mess-notifications/dispatches", sensitiveActionLimiter, purgeMessNotificationDispatches);
router.post("/mess-notifications/auto-fire-simulator", sensitiveActionLimiter, simulateAutoFireMessAlert);
router.post("/mess-notifications/rearm-slot", sensitiveActionLimiter, rearmMessSlotForToday);

// Emergency / Global Broadcast Notices
router.get("/notices", getGlobalNotices);
router.get("/notices/active", getActiveGlobalNotice);
router.post("/notices", sensitiveActionLimiter, createGlobalNotice);
router.patch("/notices/:noticeId/status", sensitiveActionLimiter, toggleGlobalNoticeStatus);
router.delete("/notices/:noticeId", sensitiveActionLimiter, deleteGlobalNotice);

// Hardware Device Registry & Granular Student Mute/Ping Controls
router.get("/device-registry", getDeviceRegistryDirectory);
router.post("/device-registry/:deviceId/toggle-mute", sensitiveActionLimiter, toggleDeviceMuteStatus);
router.post("/device-registry/:deviceId/ping", sensitiveActionLimiter, pingSingleDevice);
router.delete("/device-registry/:deviceId", sensitiveActionLimiter, deleteDeviceRegistryEntry);
router.post("/mess-notifications/broadcast-custom", sensitiveActionLimiter, broadcastCustomMessAlert);

// Closed Beta Testing (CBT) Program
router.get("/cbt/config", getCbtConfig);
router.put("/cbt/config", sensitiveActionLimiter, updateCbtConfig);
router.get("/cbt/applications", getCbtApplications);
router.patch("/cbt/applications/:id/approve", sensitiveActionLimiter, approveCbtApplication);
router.patch("/cbt/applications/:id/reject", sensitiveActionLimiter, rejectCbtApplication);
router.delete("/cbt/applications/:id", sensitiveActionLimiter, deleteCbtApplication);
router.post("/cbt/applications/bulk-approve", sensitiveActionLimiter, bulkApproveCbtApplications);

module.exports = router;
