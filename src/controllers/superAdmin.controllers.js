const User = require("../models/user.model");
const Session = require("../models/session.model");
const SystemConfig = require("../models/systemConfig.model");
const AuditLog = require("../models/auditLog.model");
const NotificationCampaign = require("../models/notification.model");
const { sendPushToSessions } = require("../services/pushService");
const Argon = require("argon2");
const argonLimiter = require("../../utils/argonLimiter");

// Safe helper to log audit actions
async function recordAudit({
  req,
  action,
  targetType,
  targetId,
  targetIdentifier,
  outcome = "SUCCESS",
  summary,
  details = {},
}) {
  try {
    const adminUser = req.user || {};
    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
    const userAgent = req.headers["user-agent"] || "";

    await AuditLog.create({
      adminId: adminUser.id,
      adminRegistrationNumber: adminUser.registrationNumber || "UNKNOWN",
      adminName: adminUser.name || "Super Admin",
      action,
      targetType,
      targetId: targetId ? targetId.toString() : "",
      targetIdentifier: targetIdentifier || "",
      outcome,
      summary,
      details,
      ip,
      userAgent: userAgent.slice(0, 512),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

// ─── OVERVIEW STATS ──────────────────────────────────────────────────────────
// GET /api/v1/superadmin/overview
const getSystemOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      deactivatedUsers,
      totalSessions,
      activeSessions,
      totalCampaigns,
      recentAuditLogs,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ accountStatus: "active", isActivated: true }),
      User.countDocuments({ accountStatus: { $in: ["deactivated", "suspended"] } }),
      Session.countDocuments(),
      Session.countDocuments({ status: "active" }),
      NotificationCampaign.countDocuments(),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    // Role breakdown
    const roleCounts = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    // Active device breakdown
    const deviceCounts = await Session.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$deviceType", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        deactivatedUsers,
        totalSessions,
        activeSessions,
        totalCampaigns,
      },
      roleBreakdown: roleCounts.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {}),
      deviceBreakdown: deviceCounts.reduce((acc, d) => ({ ...acc, [d._id]: d.count }), {}),
      recentActivity: recentAuditLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate system overview",
      error: error.message,
    });
  }
};

// ─── USER DIRECTORY ──────────────────────────────────────────────────────────
// GET /api/v1/superadmin/users
const getUsersDirectory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { search, role, status, hostel } = req.query;

    const query = {};

    if (search) {
      const sanitized = search.trim();
      query.$or = [
        { registrationNumber: { $regex: sanitized, $options: "i" } },
        { name: { $regex: sanitized, $options: "i" } },
        { email: { $regex: sanitized, $options: "i" } },
      ];
    }

    if (role && role !== "all") {
      query.role = role;
    }

    if (status && status !== "all") {
      query.accountStatus = status;
    }

    if (hostel && hostel !== "all") {
      query.hostel = hostel;
    }

    const [rawUsers, total, config] = await Promise.all([
      User.find(query)
        .select("-password") // STRICT: NEVER expose password hashes
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      SystemConfig.getEffectiveConfig(),
    ]);

    const userIds = rawUsers.map((u) => u._id);
    const sessionCounts = await Session.aggregate([
      { $match: { userId: { $in: userIds }, status: "active" } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    const sessionCountMap = new Map();
    sessionCounts.forEach((s) => sessionCountMap.set(s._id.toString(), s.count));

    const users = rawUsers.map((u) => {
      const activeCount = sessionCountMap.get(u._id.toString()) || 0;
      const effectiveLimit =
        typeof u.maxDevices === "number" && u.maxDevices > 0
          ? u.maxDevices
          : config.maxConcurrentSessions;
      return {
        ...u,
        activeDeviceCount: activeCount,
        effectiveDeviceLimit: effectiveLimit,
      };
    });

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users directory",
      error: error.message,
    });
  }
};

// ─── USER DETAILS ────────────────────────────────────────────────────────────
// GET /api/v1/superadmin/users/:userId
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [activeSessions, sessionHistory, userAuditLogs, config] = await Promise.all([
      Session.find({ userId, status: "active" })
        .select("-pushToken -webPushSubscription")
        .sort({ lastActivityAt: -1 })
        .lean(),
      Session.find({ userId })
        .select("-pushToken -webPushSubscription")
        .sort({ loginAt: -1 })
        .limit(15)
        .lean(),
      AuditLog.find({ targetId: userId.toString() })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      SystemConfig.getEffectiveConfig(),
    ]);

    const effectiveDeviceLimit =
      typeof user.maxDevices === "number" && user.maxDevices > 0
        ? user.maxDevices
        : config.maxConcurrentSessions;

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        activeDeviceCount: activeSessions.length,
        effectiveDeviceLimit,
      },
      activeSessions,
      sessionHistory,
      auditLogs: userAuditLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message,
    });
  }
};

// ─── EDIT USER PROFILE ───────────────────────────────────────────────────────
// PATCH /api/v1/superadmin/users/:userId
const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, hostel, roomNumber, maxDevices, deviceLimit } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const allowedRoles = ["student", "caretaker", "warden", "superintendent", "chiefHostelWarden", "superadmin"];
    const changes = {};

    if (name && name.trim()) {
      changes.name = { from: user.name, to: name.trim() };
      user.name = name.trim();
    }

    if (email !== undefined) {
      changes.email = { from: user.email, to: (email || "").trim() };
      user.email = (email || "").trim();
    }

    if (hostel && hostel.trim()) {
      changes.hostel = { from: user.hostel, to: hostel.trim() };
      user.hostel = hostel.trim();
    }

    if (roomNumber !== undefined) {
      changes.roomNumber = { from: user.roomNumber, to: roomNumber };
      user.roomNumber = roomNumber;
    }

    if (role && allowedRoles.includes(role)) {
      if (user.role !== role) {
        changes.role = { from: user.role, to: role };
        user.role = role;
      }
    }

    const rawLimit = maxDevices !== undefined ? maxDevices : deviceLimit;
    if (rawLimit !== undefined) {
      if (rawLimit === null || rawLimit === "" || rawLimit === "default") {
        changes.maxDevices = { from: user.maxDevices, to: null };
        user.maxDevices = null;
      } else {
        const parsed = Number(rawLimit);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
          return res.status(400).json({
            success: false,
            message: "Device limit must be a valid positive integer between 1 and 50.",
          });
        }
        changes.maxDevices = { from: user.maxDevices, to: parsed };
        user.maxDevices = parsed;
      }
    }

    await user.save();

    await recordAudit({
      req,
      action: changes.role ? "ROLE_CHANGE" : changes.maxDevices ? "DEVICE_LIMIT_UPDATED" : "PROFILE_UPDATE",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Updated profile for user ${user.registrationNumber}`,
      details: changes,
    });

    const config = await SystemConfig.getEffectiveConfig();
    const effectiveDeviceLimit =
      typeof user.maxDevices === "number" && user.maxDevices > 0
        ? user.maxDevices
        : config.maxConcurrentSessions;

    const activeDeviceCount = await Session.countDocuments({
      userId: user._id,
      status: "active",
    });

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        registrationNumber: user.registrationNumber,
        email: user.email,
        role: user.role,
        hostel: user.hostel,
        roomNumber: user.roomNumber,
        maxDevices: user.maxDevices,
        effectiveDeviceLimit,
        activeDeviceCount,
        accountStatus: user.accountStatus,
        isActivated: user.isActivated,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

// ─── UPDATE USER DEVICE LIMIT ───────────────────────────────────────────────
// PATCH /api/v1/superadmin/users/:userId/device-limit
const updateUserDeviceLimit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxDevices, deviceLimit } = req.body;

    const rawLimit = maxDevices !== undefined ? maxDevices : deviceLimit;

    if (rawLimit === undefined) {
      return res.status(400).json({
        success: false,
        message: "Device limit value is required (e.g. 1, 2, 3, or null for system default).",
      });
    }

    let cleanLimit = null;
    if (rawLimit !== null && rawLimit !== "" && rawLimit !== "default") {
      const parsed = Number(rawLimit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        return res.status(400).json({
          success: false,
          message: "Device limit must be a valid positive integer between 1 and 50.",
        });
      }
      cleanLimit = parsed;
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const previousLimit = user.maxDevices;
    user.maxDevices = cleanLimit;
    await user.save();

    const config = await SystemConfig.getEffectiveConfig();
    const effectiveDeviceLimit =
      cleanLimit !== null ? cleanLimit : config.maxConcurrentSessions;

    const activeDeviceCount = await Session.countDocuments({
      userId: user._id,
      status: "active",
    });

    await recordAudit({
      req,
      action: "DEVICE_LIMIT_UPDATED",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Updated device limit for user ${user.registrationNumber} to ${cleanLimit !== null ? `${cleanLimit} devices` : `system default (${config.maxConcurrentSessions})`}`,
      details: {
        previousLimit,
        newLimit: cleanLimit,
        effectiveDeviceLimit,
        currentActiveDevices: activeDeviceCount,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Device limit for user '${user.registrationNumber}' updated successfully to ${cleanLimit !== null ? `${cleanLimit} devices` : `system default (${config.maxConcurrentSessions} devices)`}.`,
      user: {
        _id: user._id,
        registrationNumber: user.registrationNumber,
        name: user.name,
        role: user.role,
        maxDevices: user.maxDevices,
        effectiveDeviceLimit,
        activeDeviceCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update device limit.",
      error: error.message,
    });
  }
};

// ─── ACCOUNT ACTIVATION / STATUS TOGGLE ──────────────────────────────────────
// PATCH /api/v1/superadmin/users/:userId/status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountStatus, isActivated } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const previousStatus = user.accountStatus;
    const previousActivated = user.isActivated;

    if (accountStatus && ["active", "deactivated", "suspended"].includes(accountStatus)) {
      user.accountStatus = accountStatus;
    }

    if (typeof isActivated === "boolean") {
      user.isActivated = isActivated;
    }

    // If deactivating or suspending, instantly revoke all active sessions
    let revokedSessionCount = 0;
    if (user.accountStatus !== "active" || user.isActivated === false) {
      user.sessionsRevokedAt = new Date();
      const revokeRes = await Session.updateMany(
        { userId: user._id, status: "active" },
        {
          $set: {
            status: "revoked",
            revokedAt: new Date(),
            revokedBy: `admin:${req.user.registrationNumber}`,
          },
        }
      );
      revokedSessionCount = revokeRes.modifiedCount || 0;
    }

    await user.save();

    await recordAudit({
      req,
      action: user.accountStatus === "active" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Changed account status for ${user.registrationNumber} from ${previousStatus} to ${user.accountStatus}`,
      details: {
        previousStatus,
        newStatus: user.accountStatus,
        previousActivated,
        newActivated: user.isActivated,
        sessionsRevoked: revokedSessionCount,
      },
    });

    return res.status(200).json({
      success: true,
      message: `User status changed to ${user.accountStatus}`,
      accountStatus: user.accountStatus,
      isActivated: user.isActivated,
      revokedSessions: revokedSessionCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update account status",
      error: error.message,
    });
  }
};

// ─── ADMIN PASSWORD RESET ────────────────────────────────────────────────────
// POST /api/v1/superadmin/users/:userId/reset-password
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, adminPassword } = req.body;

    // Verify Admin re-authentication password for sensitive password reset action
    if (!adminPassword) {
      return res.status(400).json({
        success: false,
        message: "Super Admin re-authentication password is required for security verification.",
      });
    }

    const adminUser = await User.findById(req.user.id);
    const isAdminPasswordValid = await argonLimiter.schedule(() =>
      Argon.verify(adminUser.password, adminPassword)
    );

    if (!isAdminPasswordValid) {
      await recordAudit({
        req,
        action: "PASSWORD_RESET",
        targetType: "USER",
        targetId: userId,
        outcome: "FAILURE",
        summary: `Admin password verification failed during password reset attempt`,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid Super Admin confirmation password",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const hashedPassword = await Argon.hash(newPassword);
    user.password = hashedPassword;
    user.isActivated = true;
    user.accountStatus = "active";
    user.sessionsRevokedAt = new Date(); // Revoke all existing sessions
    await user.save();

    // Revoke all existing database sessions
    await Session.updateMany(
      { userId: user._id, status: "active" },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revokedBy: `admin:${req.user.registrationNumber}:password_reset`,
        },
      }
    );

    await recordAudit({
      req,
      action: "PASSWORD_RESET",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Administrative password reset executed for ${user.registrationNumber}`,
      details: { allSessionsRevoked: true },
    });

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for ${user.registrationNumber}. All active sessions have been invalidated.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

// ─── FORCE LOGOUT ALL SESSIONS ───────────────────────────────────────────────
// POST /api/v1/superadmin/users/:userId/force-logout
const forceLogoutUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.sessionsRevokedAt = new Date();
    await user.save();

    const result = await Session.updateMany(
      { userId: user._id, status: "active" },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revokedBy: `admin:${req.user.registrationNumber}:force_logout`,
        },
      }
    );

    await recordAudit({
      req,
      action: "SESSIONS_REVOKED_ALL",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Forced logout on all active sessions for ${user.registrationNumber}`,
      details: { revokedCount: result.modifiedCount },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully revoked all ${result.modifiedCount} active session(s) for ${user.registrationNumber}`,
      revokedCount: result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to force logout user",
      error: error.message,
    });
  }
};

// ─── SESSIONS DIRECTORY ──────────────────────────────────────────────────────
// GET /api/v1/superadmin/sessions
const getSessionsDirectory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { status, search, deviceType } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (deviceType && deviceType !== "all") {
      query.deviceType = deviceType;
    }

    if (search) {
      const sanitized = search.trim();
      query.$or = [
        { registrationNumber: { $regex: sanitized, $options: "i" } },
        { deviceNickname: { $regex: sanitized, $options: "i" } },
        { ip: { $regex: sanitized, $options: "i" } },
      ];
    }

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .select("-pushToken -webPushSubscription")
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name role hostel")
        .lean(),
      Session.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions directory",
      error: error.message,
    });
  }
};

// ─── REVOKE SPECIFIC SESSION ─────────────────────────────────────────────────
// DELETE /api/v1/superadmin/sessions/:sessionId
const revokeSessionById = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (session.status === "revoked") {
      return res.status(400).json({
        success: false,
        message: "Session is already revoked",
      });
    }

    session.status = "revoked";
    session.revokedAt = new Date();
    session.revokedBy = `admin:${req.user.registrationNumber}`;
    await session.save();

    await recordAudit({
      req,
      action: "SESSION_REVOKED",
      targetType: "SESSION",
      targetId: session.sessionId,
      targetIdentifier: `${session.registrationNumber} (${session.deviceNickname})`,
      summary: `Revoked session ${session.sessionId} for user ${session.registrationNumber}`,
      details: {
        deviceType: session.deviceType,
        ip: session.ip,
        os: session.os,
        browser: session.browser,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Session ${sessionId} has been revoked successfully`,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        revokedAt: session.revokedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to revoke session",
      error: error.message,
    });
  }
};

// ─── SYSTEM CONFIGURATION & LIMITS ───────────────────────────────────────────
// GET /api/v1/superadmin/config
const getSystemConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get system configuration",
      error: error.message,
    });
  }
};

// PUT /api/v1/superadmin/config
const updateSystemConfig = async (req, res) => {
  try {
    const {
      maxConcurrentSessions,
      maxRegisteredDevices,
      requireDeviceApproval,
      revokeOldestOnLimit,
      sessionInactivityTimeoutMinutes,
    } = req.body;

    const config = await SystemConfig.getEffectiveConfig();
    const previous = {
      maxConcurrentSessions: config.maxConcurrentSessions,
      maxRegisteredDevices: config.maxRegisteredDevices,
      requireDeviceApproval: config.requireDeviceApproval,
      revokeOldestOnLimit: config.revokeOldestOnLimit,
      sessionInactivityTimeoutMinutes: config.sessionInactivityTimeoutMinutes,
    };

    if (maxConcurrentSessions && maxConcurrentSessions >= 1 && maxConcurrentSessions <= 20) {
      config.maxConcurrentSessions = maxConcurrentSessions;
    }

    if (maxRegisteredDevices && maxRegisteredDevices >= 1 && maxRegisteredDevices <= 50) {
      config.maxRegisteredDevices = maxRegisteredDevices;
    }

    if (typeof requireDeviceApproval === "boolean") {
      config.requireDeviceApproval = requireDeviceApproval;
    }

    if (typeof revokeOldestOnLimit === "boolean") {
      config.revokeOldestOnLimit = revokeOldestOnLimit;
    }

    if (
      sessionInactivityTimeoutMinutes &&
      sessionInactivityTimeoutMinutes >= 15 &&
      sessionInactivityTimeoutMinutes <= 43200
    ) {
      config.sessionInactivityTimeoutMinutes = sessionInactivityTimeoutMinutes;
    }

    config.updatedBy = req.user.registrationNumber;
    await config.save();

    await recordAudit({
      req,
      action: "LOGIN_LIMITS_UPDATED",
      targetType: "SYSTEM_CONFIG",
      targetId: config._id,
      summary: "Updated login limits and session configuration parameters",
      details: { previous, updated: config },
    });

    return res.status(200).json({
      success: true,
      message: "System configuration updated successfully",
      config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update system config",
      error: error.message,
    });
  }
};

// ─── NOTIFICATION DISPATCH ENGINE ────────────────────────────────────────────
// POST /api/v1/superadmin/notifications/send
const sendAdminNotification = async (req, res) => {
  try {
    const {
      title,
      body,
      targetAudience, // "SINGLE_DEVICE" | "SINGLE_USER" | "ROLE_GROUP" | "HOSTEL_GROUP" | "ALL_DEVICES"
      targetCriteria = {},
      route = "/",
    } = req.body;

    if (!title || !body || !targetAudience) {
      return res.status(400).json({
        success: false,
        message: "title, body, and targetAudience are required fields",
      });
    }

    // 1. Resolve Target Active Sessions
    let targetSessions = [];

    switch (targetAudience) {
      case "SINGLE_DEVICE": {
        if (!targetCriteria.sessionId) {
          return res.status(400).json({
            success: false,
            message: "sessionId is required when targeting SINGLE_DEVICE",
          });
        }
        targetSessions = await Session.find({
          sessionId: targetCriteria.sessionId,
          status: "active",
        }).select("+pushToken +webPushSubscription");
        break;
      }

      case "SINGLE_USER": {
        let userFilter = null;
        if (targetCriteria.userId) {
          userFilter = { userId: targetCriteria.userId };
        } else if (targetCriteria.registrationNumber) {
          userFilter = { registrationNumber: targetCriteria.registrationNumber };
        } else {
          return res.status(400).json({
            success: false,
            message: "userId or registrationNumber is required when targeting SINGLE_USER",
          });
        }
        targetSessions = await Session.find({
          ...userFilter,
          status: "active",
        }).select("+pushToken +webPushSubscription");
        break;
      }

      case "ROLE_GROUP": {
        if (!targetCriteria.role) {
          return res.status(400).json({
            success: false,
            message: "role is required when targeting ROLE_GROUP",
          });
        }
        const matchingUsers = await User.find({ role: targetCriteria.role }).select("_id");
        const userIds = matchingUsers.map((u) => u._id);
        targetSessions = await Session.find({
          userId: { $in: userIds },
          status: "active",
        }).select("+pushToken +webPushSubscription");
        break;
      }

      case "HOSTEL_GROUP": {
        if (!targetCriteria.hostel) {
          return res.status(400).json({
            success: false,
            message: "hostel is required when targeting HOSTEL_GROUP",
          });
        }
        const matchingUsers = await User.find({ hostel: targetCriteria.hostel }).select("_id");
        const userIds = matchingUsers.map((u) => u._id);
        targetSessions = await Session.find({
          userId: { $in: userIds },
          status: "active",
        }).select("+pushToken +webPushSubscription");
        break;
      }

      case "ALL_DEVICES": {
        targetSessions = await Session.find({
          status: "active",
        }).select("+pushToken +webPushSubscription");
        break;
      }

      default: {
        return res.status(400).json({
          success: false,
          message: `Unsupported targetAudience: ${targetAudience}`,
        });
      }
    }

    // 2. Dispatch Multi-Channel Push (FCM / Web Push)
    const report = await sendPushToSessions(targetSessions, {
      title,
      body,
      route,
      data: {
        sender: req.user.registrationNumber,
        campaignAt: new Date().toISOString(),
      },
    });

    const campaignStatus =
      report.failed === 0
        ? "accepted_by_provider"
        : report.accepted > 0
        ? "partially_failed"
        : "failed";

    // 3. Persist Campaign Record
    const campaign = await NotificationCampaign.create({
      title,
      body,
      targetAudience,
      targetCriteria,
      route,
      sentBy: req.user.id,
      sentByRegistrationNumber: req.user.registrationNumber,
      targetCount: targetSessions.length,
      successCount: report.accepted,
      failureCount: report.failed,
      status: campaignStatus,
      providerSummary: {
        fcm: report.fcm,
        webpush: report.webpush,
        notes: report.providerNotes.join("; "),
      },
      deliveryErrors: report.errors.slice(0, 50),
    });

    await recordAudit({
      req,
      action: "NOTIFICATION_SENT",
      targetType: "NOTIFICATION",
      targetId: campaign._id,
      summary: `Sent push notification '${title}' to ${targetAudience} (${targetSessions.length} target sessions)`,
      details: {
        targetAudience,
        targetCriteria,
        targetSessionsCount: targetSessions.length,
        accepted: report.accepted,
        failed: report.failed,
        providerNotes: report.providerNotes,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Notification processed for ${targetSessions.length} target device(s).`,
      campaign: {
        id: campaign._id,
        targetCount: campaign.targetCount,
        successCount: campaign.successCount,
        failureCount: campaign.failureCount,
        status: campaign.status,
        providerSummary: campaign.providerSummary,
        sentAt: campaign.sentAt,
      },
      report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to dispatch notification",
      error: error.message,
    });
  }
};

// GET /api/v1/superadmin/notifications
const getNotificationHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      NotificationCampaign.find()
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationCampaign.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notification campaigns",
      error: error.message,
    });
  }
};

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
// GET /api/v1/superadmin/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const { action, outcome, search, from, to } = req.query;

    const query = {};

    if (action && action !== "all") {
      query.action = action;
    }

    if (outcome && outcome !== "all") {
      query.outcome = outcome;
    }

    if (search) {
      const sanitized = search.trim();
      query.$or = [
        { adminRegistrationNumber: { $regex: sanitized, $options: "i" } },
        { targetIdentifier: { $regex: sanitized, $options: "i" } },
        { summary: { $regex: sanitized, $options: "i" } },
      ];
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
      error: error.message,
    });
  }
};

// ─── PROVISION USER ──────────────────────────────────────────────────────────
// POST /api/v1/superadmin/users
const provisionUser = async (req, res) => {
  try {
    const {
      registrationNumber,
      name,
      role = "superadmin",
      hostel,
      roomNumber,
      email,
      password,
      adminPassword,
    } = req.body;

    // 1. Enforce admin re-authentication password
    if (!adminPassword) {
      return res.status(400).json({
        success: false,
        message: "Super Admin re-authentication password is required.",
      });
    }

    const adminUser = await User.findById(req.user.id);
    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: "Authenticated admin user not found in database.",
      });
    }

    const isAdminPasswordValid = await argonLimiter.schedule(() =>
      Argon.verify(adminUser.password, adminPassword)
    );

    if (!isAdminPasswordValid) {
      await recordAudit({
        req,
        action: "USER_PROVISIONED",
        targetType: "USER",
        targetIdentifier: typeof registrationNumber === "string" ? registrationNumber.trim() : "",
        outcome: "FAILURE",
        summary: "Super Admin password verification failed during user provisioning attempt",
        details: { targetRole: role },
      });

      return res.status(401).json({
        success: false,
        message: "Invalid Super Admin confirmation password.",
      });
    }

    // 2. Validate input fields
    if (!registrationNumber || typeof registrationNumber !== "string" || !registrationNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required.",
      });
    }

    const cleanRegNo = registrationNumber.trim();
    if (cleanRegNo.length < 3 || cleanRegNo.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Registration number must be between 3 and 50 characters.",
      });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }
    const cleanName = name.trim();

    // Validate role against User schema enum
    const validRoles = User.schema.path("role").enumValues || [];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role '${role}'. Allowed roles: ${validRoles.join(", ")}`,
      });
    }

    // Password validation (min 8 chars)
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password is required and must be at least 8 characters long.",
      });
    }

    // Email validation (if provided)
    let cleanEmail = "";
    if (email) {
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format.",
        });
      }
      cleanEmail = email.trim().toLowerCase();
    }

    // Hostel validation: default to "ADMIN_HQ" for superadmin if omitted
    let cleanHostel = typeof hostel === "string" ? hostel.trim() : "";
    if (!cleanHostel) {
      if (role === "superadmin") {
        cleanHostel = "ADMIN_HQ";
      } else {
        return res.status(400).json({
          success: false,
          message: "Hostel is required for this role.",
        });
      }
    }

    // 3. Prevent duplicate registration numbers (pre-check)
    const existingUser = await User.findOne({ registrationNumber: cleanRegNo });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `User with registration number '${cleanRegNo}' already exists.`,
      });
    }

    // 4. Hash password with Argon2
    const hashedPassword = await argonLimiter.schedule(() => Argon.hash(password));

    // 5. Create user record safely (handling possible race conditions on unique index)
    let newUser;
    try {
      newUser = await User.create({
        registrationNumber: cleanRegNo,
        name: cleanName,
        role,
        hostel: cleanHostel,
        roomNumber: typeof roomNumber === "string" && roomNumber.trim() ? roomNumber.trim() : null,
        email: cleanEmail,
        password: hashedPassword,
        isActivated: true,
        accountStatus: "active",
      });
    } catch (createErr) {
      // MongoDB E11000 duplicate key error handling for concurrent requests
      if (createErr.code === 11000 || (createErr.message && createErr.message.includes("E11000"))) {
        return res.status(409).json({
          success: false,
          message: `User with registration number '${cleanRegNo}' already exists.`,
        });
      }
      throw createErr;
    }

    // 6. Write audit log (passwords/hashes strictly omitted)
    await recordAudit({
      req,
      action: "USER_PROVISIONED",
      targetType: "USER",
      targetId: newUser._id,
      targetIdentifier: newUser.registrationNumber,
      outcome: "SUCCESS",
      summary: `Super Admin ${adminUser.registrationNumber} provisioned new account ${newUser.registrationNumber} with role '${role}'`,
      details: {
        role: newUser.role,
        registrationNumber: newUser.registrationNumber,
        hostel: newUser.hostel,
        email: newUser.email,
        isActivated: newUser.isActivated,
        accountStatus: newUser.accountStatus,
      },
    });

    // 7. Return sanitized response (strictly exclude password and hashes)
    return res.status(201).json({
      success: true,
      message: `User '${newUser.registrationNumber}' provisioned successfully with role '${newUser.role}'.`,
      user: {
        id: newUser._id,
        registrationNumber: newUser.registrationNumber,
        name: newUser.name,
        role: newUser.role,
        hostel: newUser.hostel,
        roomNumber: newUser.roomNumber,
        email: newUser.email,
        isActivated: newUser.isActivated,
        accountStatus: newUser.accountStatus,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to provision user.",
      error: error.message,
    });
  }
};

// ─── MAINTENANCE CONFIGURATION ───────────────────────────────────────────────
// GET /api/v1/superadmin/maintenance
const getMaintenanceConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    return res.status(200).json({
      success: true,
      maintenance: config.maintenance,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get maintenance configuration",
      error: error.message,
    });
  }
};

// PUT /api/v1/superadmin/maintenance
const updateMaintenanceConfig = async (req, res) => {
  try {
    const { global, selective } = req.body;
    const config = await SystemConfig.getEffectiveConfig();
    const previous = {
      global: config.maintenance?.global ? { ...config.maintenance.global.toObject?.() || config.maintenance.global } : {},
      selective: config.maintenance?.selective ? { ...config.maintenance.selective.toObject?.() || config.maintenance.selective } : {},
    };

    if (!config.maintenance) {
      config.maintenance = { global: {}, selective: {} };
    }

    // 1. Update Global Maintenance if provided
    if (global && typeof global === "object") {
      if (typeof global.enabled === "boolean") {
        config.maintenance.global.enabled = global.enabled;
      }
      if (typeof global.title === "string") {
        const cleanTitle = global.title.trim().slice(0, 120);
        if (cleanTitle) config.maintenance.global.title = cleanTitle;
      }
      if (typeof global.message === "string") {
        const cleanMessage = global.message.trim().slice(0, 1000);
        if (cleanMessage) config.maintenance.global.message = cleanMessage;
      }
      if (global.plannedStart !== undefined) {
        config.maintenance.global.plannedStart = global.plannedStart ? new Date(global.plannedStart) : null;
      }
      if (global.plannedEnd !== undefined) {
        config.maintenance.global.plannedEnd = global.plannedEnd ? new Date(global.plannedEnd) : null;
      }
    }

    // 2. Update Selective Maintenance if provided
    if (selective && typeof selective === "object") {
      if (typeof selective.enabled === "boolean") {
        config.maintenance.selective.enabled = selective.enabled;
      }
      if (typeof selective.title === "string") {
        const cleanTitle = selective.title.trim().slice(0, 120);
        if (cleanTitle) config.maintenance.selective.title = cleanTitle;
      }
      if (typeof selective.message === "string") {
        const cleanMessage = selective.message.trim().slice(0, 1000);
        if (cleanMessage) config.maintenance.selective.message = cleanMessage;
      }
      if (Array.isArray(selective.affectedRoles)) {
        const validRoles = ["student", "caretaker", "warden", "superintendent"];
        config.maintenance.selective.affectedRoles = selective.affectedRoles
          .map((r) => String(r).trim().toLowerCase())
          .filter((r) => validRoles.includes(r));
      }
      if (Array.isArray(selective.affectedRegistrationNumbers)) {
        config.maintenance.selective.affectedRegistrationNumbers = selective.affectedRegistrationNumbers
          .map((reg) => String(reg).trim().toUpperCase())
          .filter(Boolean);
      }
      if (selective.plannedStart !== undefined) {
        config.maintenance.selective.plannedStart = selective.plannedStart ? new Date(selective.plannedStart) : null;
      }
      if (selective.plannedEnd !== undefined) {
        config.maintenance.selective.plannedEnd = selective.plannedEnd ? new Date(selective.plannedEnd) : null;
      }
    }

    config.updatedBy = req.user.registrationNumber || "superadmin";
    config.markModified("maintenance");
    await config.save();

    // 3. Write Audit Log
    const actionDesc = [
      global && typeof global.enabled === "boolean" ? `Global: ${global.enabled ? "ENABLED" : "DISABLED"}` : null,
      selective && typeof selective.enabled === "boolean" ? `Selective: ${selective.enabled ? "ENABLED" : "DISABLED"}` : null,
    ].filter(Boolean).join(", ") || "Configuration Updated";

    await recordAudit({
      req,
      action: "MAINTENANCE_MODE_UPDATED",
      targetType: "SYSTEM_CONFIG",
      targetId: config._id,
      targetIdentifier: "maintenance",
      outcome: "SUCCESS",
      summary: `Maintenance configuration updated (${actionDesc}) by ${req.user.registrationNumber}`,
      details: {
        previous,
        updated: {
          global: config.maintenance.global,
          selective: config.maintenance.selective,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Maintenance configuration updated successfully",
      maintenance: config.maintenance,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update maintenance configuration",
      error: error.message,
    });
  }
};

module.exports = {
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
};

