const User = require("../models/user.model");
const Session = require("../models/session.model");
const SystemConfig = require("../models/systemConfig.model");
const AuditLog = require("../models/auditLog.model");
const NotificationCampaign = require("../models/notification.model");
const GlobalNotice = require("../models/globalNotice.model");
const { sendPushToSessions } = require("../services/pushService");
const Argon = require("argon2");
const argonLimiter = require("../../utils/argonLimiter");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { isValidVersion, compareVersions } = require("../utils/versionComparator");

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
      if (status === "locked") {
        query.$or = [
          { lockUntil: { $gt: new Date() } },
          { accountStatus: "locked" },
          { failedLoginAttempts: { $gte: 5 } },
        ];
      } else {
        query.accountStatus = status;
      }
    }

    if (hostel && hostel !== "all") {
      query.hostel = hostel;
    }

    const [rawUsers, total, totalLockedCount, config] = await Promise.all([
      User.find(query)
        .select("-password") // STRICT: NEVER expose password hashes
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      User.countDocuments({
        $or: [
          { lockUntil: { $gt: new Date() } },
          { accountStatus: "locked" },
          { failedLoginAttempts: { $gte: 5 } },
        ],
      }),
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
      const isLocked = Boolean(
        (u.lockUntil && new Date(u.lockUntil) > new Date()) ||
        u.accountStatus === "locked" ||
        (u.failedLoginAttempts || 0) >= (config.failedLoginThreshold || 5)
      );
      const lockMinutesRemaining = u.lockUntil && new Date(u.lockUntil) > new Date()
        ? Math.max(1, Math.ceil((new Date(u.lockUntil) - new Date()) / (60 * 1000)))
        : isLocked ? (config.lockoutDurationMinutes || 15) : 0;
      return {
        ...u,
        isLocked,
        lockMinutesRemaining,
        activeDeviceCount: activeCount,
        effectiveDeviceLimit: effectiveLimit,
      };
    });

    return res.status(200).json({
      success: true,
      users,
      lockedCount: totalLockedCount,
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

    const isLocked = Boolean(user.lockUntil && new Date(user.lockUntil) > new Date());
    const lockMinutesRemaining = isLocked
      ? Math.max(1, Math.ceil((new Date(user.lockUntil) - new Date()) / (60 * 1000)))
      : 0;

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        isLocked,
        lockMinutesRemaining,
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
    const {
      name,
      email,
      role,
      hostel,
      roomNumber,
      registrationNumber,
      password,
      accountStatus,
      maxDevices,
      deviceLimit,
    } = req.body;

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

    if (registrationNumber && registrationNumber.trim()) {
      const cleanReg = registrationNumber.trim().toUpperCase();
      if (cleanReg !== user.registrationNumber) {
        const exists = await User.findOne({
          registrationNumber: cleanReg,
          _id: { $ne: user._id },
        });
        if (exists) {
          return res.status(409).json({
            success: false,
            message: `Registration number '${cleanReg}' is already assigned to another user (${exists.name}).`,
          });
        }
        changes.registrationNumber = { from: user.registrationNumber, to: cleanReg };
        user.registrationNumber = cleanReg;

        // Cascade update to sessions
        await Session.updateMany(
          { userId: user._id },
          { $set: { registrationNumber: cleanReg } }
        ).catch(() => {});
      }
    }

    if (password && password.trim().length >= 6) {
      user.password = await Argon.hash(password.trim());
      user.isActivated = true;
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      changes.password = "updated_and_rehashed";
    }

    if (accountStatus && ["active", "locked", "deactivated", "suspended"].includes(accountStatus)) {
      if (user.accountStatus !== accountStatus) {
        changes.accountStatus = { from: user.accountStatus, to: accountStatus };
        user.accountStatus = accountStatus;
        if (accountStatus === "active") {
          user.failedLoginAttempts = 0;
          user.lockUntil = null;
        }
      }
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

    // Cascade student details to permanent DeviceRegistry
    try {
      const DeviceRegistry = require("../models/deviceRegistry.model");
      await DeviceRegistry.updateMany(
        { userId: user._id },
        {
          $set: {
            studentName: user.name,
            registrationNumber: user.registrationNumber,
            hostelBlock: user.hostel,
            roomNumber: user.roomNumber,
            userRole: user.role,
          },
        }
      );
    } catch (_) {}

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
      if (accountStatus === "active") {
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
      }
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
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
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

// ─── UNLOCK USER ACCOUNT (CLEAR LOCKOUT) ──────────────────────────────────────
// POST /api/v1/superadmin/users/:userId/unlock
const unlockUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const wasLocked = Boolean(user.lockUntil && new Date(user.lockUntil) > new Date());
    const previousAttempts = user.failedLoginAttempts || 0;
    const previousLockUntil = user.lockUntil;

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await recordAudit({
      req,
      action: "ACCOUNT_UNLOCKED",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Unlocked login lockout for user ${user.registrationNumber} (cleared ${previousAttempts} failed attempt(s))`,
      details: {
        wasLocked,
        previousAttempts,
        previousLockUntil,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Account for ${user.registrationNumber} has been successfully unlocked.`,
      user: {
        _id: user._id,
        registrationNumber: user.registrationNumber,
        failedLoginAttempts: 0,
        lockUntil: null,
        isLocked: false,
        lockMinutesRemaining: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unlock user account",
      error: error.message,
    });
  }
};

// ─── LOCK USER ACCOUNT MANUALLY ─────────────────────────────────────────────
// POST /api/v1/superadmin/users/:userId/lock
const lockUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { durationMinutes = 15, reason = "" } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "SuperAdmin accounts are exempt from lockouts and cannot be locked.",
      });
    }

    const config = await SystemConfig.getEffectiveConfig();
    const duration = Math.min(10080, Math.max(1, parseInt(durationMinutes) || config.lockoutDurationMinutes || 15));
    const lockUntil = new Date(Date.now() + duration * 60 * 1000);

    user.lockUntil = lockUntil;
    user.failedLoginAttempts = Math.max(user.failedLoginAttempts || 0, config.failedLoginThreshold || 5);
    await user.save();

    await recordAudit({
      req,
      action: "ACCOUNT_LOCKED_MANUALLY",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Manually locked account for user ${user.registrationNumber} for ${duration} minute(s). Reason: ${reason || "Admin discretion"}`,
      details: {
        durationMinutes: duration,
        lockUntil,
        reason,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Account for ${user.registrationNumber} locked for ${duration} minute(s).`,
      user: {
        _id: user._id,
        registrationNumber: user.registrationNumber,
        failedLoginAttempts: user.failedLoginAttempts,
        lockUntil: user.lockUntil,
        isLocked: true,
        lockMinutesRemaining: duration,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to lock user account",
      error: error.message,
    });
  }
};

// ─── ADJUST USER LOCK DURATION ──────────────────────────────────────────────
// PATCH /api/v1/superadmin/users/:userId/lock-duration
const adjustUserLockDuration = async (req, res) => {
  try {
    const { userId } = req.params;
    const { adjustMinutes } = req.body;

    const delta = parseInt(adjustMinutes);
    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({
        success: false,
        message: "adjustMinutes must be a valid non-zero integer (positive to extend, negative to reduce).",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "SuperAdmin accounts are exempt from lockouts and cannot be locked.",
      });
    }

    const now = Date.now();
    const baseTime = (user.lockUntil && new Date(user.lockUntil) > new Date(now))
      ? new Date(user.lockUntil).getTime()
      : now;

    const newLockTimeMs = baseTime + delta * 60 * 1000;

    if (newLockTimeMs <= now) {
      // Lock has been reduced to zero or negative -> unlock immediately
      user.lockUntil = null;
      user.failedLoginAttempts = 0;
      await user.save();

      await recordAudit({
        req,
        action: "ACCOUNT_LOCK_DURATION_ADJUSTED",
        targetType: "USER",
        targetId: user._id,
        targetIdentifier: user.registrationNumber,
        summary: `Adjusted lock duration by ${delta}m for user ${user.registrationNumber}. Lock time expired, account unlocked.`,
        details: { adjustMinutes: delta, newLockUntil: null, isLocked: false },
      });

      return res.status(200).json({
        success: true,
        message: `Account for ${user.registrationNumber} has been unlocked as lock duration was reduced past 0.`,
        user: {
          _id: user._id,
          registrationNumber: user.registrationNumber,
          failedLoginAttempts: 0,
          lockUntil: null,
          isLocked: false,
          lockMinutesRemaining: 0,
        },
      });
    } else {
      user.lockUntil = new Date(newLockTimeMs);
      const config = await SystemConfig.getEffectiveConfig();
      user.failedLoginAttempts = Math.max(user.failedLoginAttempts || 0, config.failedLoginThreshold || 5);
      await user.save();

      const remainingMins = Math.max(1, Math.ceil((newLockTimeMs - now) / (60 * 1000)));

      await recordAudit({
        req,
        action: "ACCOUNT_LOCK_DURATION_ADJUSTED",
        targetType: "USER",
        targetId: user._id,
        targetIdentifier: user.registrationNumber,
        summary: `Adjusted lock duration by ${delta > 0 ? `+${delta}` : delta}m for user ${user.registrationNumber}. New remaining time: ~${remainingMins}m.`,
        details: { adjustMinutes: delta, newLockUntil: user.lockUntil, lockMinutesRemaining: remainingMins, isLocked: true },
      });

      return res.status(200).json({
        success: true,
        message: `Lock duration for ${user.registrationNumber} adjusted by ${delta > 0 ? `+${delta}` : delta} minute(s). Remaining: ~${remainingMins}m.`,
        user: {
          _id: user._id,
          registrationNumber: user.registrationNumber,
          failedLoginAttempts: user.failedLoginAttempts,
          lockUntil: user.lockUntil,
          isLocked: true,
          lockMinutesRemaining: remainingMins,
        },
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to adjust user lock duration",
      error: error.message,
    });
  }
};

// ─── FLUSH USER ACCOUNT ──────────────────────────────────────────────────────
// POST /api/v1/superadmin/users/:userId/flush
const flushUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const previousAttempts = user.failedLoginAttempts || 0;
    const wasLocked = Boolean(user.lockUntil && new Date(user.lockUntil) > new Date());

    // 1. Reset user lockout and status
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.accountStatus = "active";
    user.sessionsRevokedAt = new Date();
    await user.save();

    // 2. Revoke all active sessions
    const sessionResult = await Session.updateMany(
      { userId: user._id, status: "active" },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revokedBy: `admin:${req.user.registrationNumber}:flush`,
          pushToken: null,
          pushProvider: "none",
        },
      }
    );

    // 3. Clear/prune hardware device bindings
    let prunedCount = 0;
    try {
      const DeviceRegistry = require("../models/deviceRegistry.model");
      const deviceResult = await DeviceRegistry.deleteMany({ userId: user._id });
      prunedCount = deviceResult.deletedCount || 0;
    } catch (_) {}

    await recordAudit({
      req,
      action: "ACCOUNT_FLUSHED",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Administrative flush executed for ${user.registrationNumber}: revoked ${sessionResult.modifiedCount} session(s), pruned ${prunedCount} device(s), cleared ${previousAttempts} failed attempt(s).`,
      details: {
        revokedSessions: sessionResult.modifiedCount,
        prunedDevices: prunedCount,
        clearedAttempts: previousAttempts,
        wasLocked,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Account for ${user.name} (${user.registrationNumber}) has been completely flushed! All sessions revoked (${sessionResult.modifiedCount}), hardware devices pruned (${prunedCount}), and login lockouts reset.`,
      user: {
        _id: user._id,
        name: user.name,
        registrationNumber: user.registrationNumber,
        failedLoginAttempts: 0,
        lockUntil: null,
        accountStatus: "active",
        isLocked: false,
      },
      revokedSessions: sessionResult.modifiedCount,
      prunedDevices: prunedCount,
    });
  } catch (error) {
    console.error("flushUserAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to flush user account",
      error: error.message,
    });
  }
};

// ─── SUPER ADMIN SELF-PROFILE (ME) ──────────────────────────────────────────
// GET /api/v1/superadmin/me
const getSuperAdminSelfProfile = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?._id || req.superAdminUser?._id;
    const admin = await User.findById(adminId).select("-password").lean();
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin profile not found" });
    }
    return res.status(200).json({ success: true, admin });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch admin profile", error: error.message });
  }
};

// PATCH /api/v1/superadmin/me
const updateSuperAdminSelfProfile = async (req, res) => {
  try {
    const { name, email, registrationNumber, newPassword, currentPassword } = req.body;
    const adminId = req.user?.id || req.user?._id || req.superAdminUser?._id;
    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin account not found" });
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
      }
      if (currentPassword) {
        const matches = await Argon.verify(admin.password, currentPassword);
        if (!matches) {
          return res.status(400).json({ success: false, message: "Current password does not match." });
        }
      }
      admin.password = await Argon.hash(newPassword);
    }

    if (name && name.trim()) {
      admin.name = name.trim();
    }

    if (email !== undefined) {
      admin.email = (email || "").trim();
    }

    if (registrationNumber && registrationNumber.trim()) {
      const cleanReg = registrationNumber.trim().toUpperCase();
      if (cleanReg !== admin.registrationNumber) {
        const exists = await User.findOne({ registrationNumber: cleanReg, _id: { $ne: admin._id } });
        if (exists) {
          return res.status(409).json({ success: false, message: `Registration number '${cleanReg}' is already in use.` });
        }
        admin.registrationNumber = cleanReg;
        await Session.updateMany({ userId: admin._id }, { $set: { registrationNumber: cleanReg } }).catch(() => {});
      }
    }

    await admin.save();

    await recordAudit({
      req,
      action: "SUPERADMIN_SELF_PROFILE_UPDATED",
      targetType: "USER",
      targetId: admin._id,
      targetIdentifier: admin.registrationNumber,
      summary: `Super Admin updated their own profile (${admin.name}, ${admin.registrationNumber})`,
      details: { name: admin.name, email: admin.email, registrationNumber: admin.registrationNumber, passwordUpdated: Boolean(newPassword) },
    });

    return res.status(200).json({
      success: true,
      message: "Your Super Admin profile has been updated successfully!",
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        registrationNumber: admin.registrationNumber,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("updateSuperAdminSelfProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to update admin profile", error: error.message });
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
      failedLoginThreshold,
      lockoutDurationMinutes,
      jwtLifespanDays,
    } = req.body;

    const config = await SystemConfig.getEffectiveConfig();
    const previous = {
      maxConcurrentSessions: config.maxConcurrentSessions,
      maxRegisteredDevices: config.maxRegisteredDevices,
      requireDeviceApproval: config.requireDeviceApproval,
      revokeOldestOnLimit: config.revokeOldestOnLimit,
      sessionInactivityTimeoutMinutes: config.sessionInactivityTimeoutMinutes,
      failedLoginThreshold: config.failedLoginThreshold,
      lockoutDurationMinutes: config.lockoutDurationMinutes,
      jwtLifespanDays: config.jwtLifespanDays,
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

    if (
      failedLoginThreshold !== undefined &&
      !isNaN(parseInt(failedLoginThreshold)) &&
      parseInt(failedLoginThreshold) >= 1 &&
      parseInt(failedLoginThreshold) <= 20
    ) {
      config.failedLoginThreshold = parseInt(failedLoginThreshold);
    }

    if (
      lockoutDurationMinutes !== undefined &&
      !isNaN(parseInt(lockoutDurationMinutes)) &&
      parseInt(lockoutDurationMinutes) >= 1 &&
      parseInt(lockoutDurationMinutes) <= 1440
    ) {
      config.lockoutDurationMinutes = parseInt(lockoutDurationMinutes);
    }

    if (
      jwtLifespanDays !== undefined &&
      !isNaN(parseInt(jwtLifespanDays)) &&
      parseInt(jwtLifespanDays) >= 1 &&
      parseInt(jwtLifespanDays) <= 365
    ) {
      config.jwtLifespanDays = parseInt(jwtLifespanDays);
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
      imageUrl = null,
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
      imageUrl: imageUrl && typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
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
      imageUrl: imageUrl && typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
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
      role = "student",
      hostel,
      roomNumber,
      email,
      password,
      activateImmediately = false,
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

    // Password & Activation mode logic
    const shouldActivate = Boolean(
      activateImmediately === true ||
      activateImmediately === "true" ||
      req.body.isActivated === true ||
      req.body.isActivated === "true"
    );

    let hashedPassword = undefined;
    if (shouldActivate) {
      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password is required and must be at least 6 characters long when activating an account immediately.",
        });
      }
      hashedPassword = await argonLimiter.schedule(() => Argon.hash(password));
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

    // 4. Create user record safely (handling possible race conditions on unique index)
    let newUser;
    try {
      newUser = await User.create({
        registrationNumber: cleanRegNo,
        name: cleanName,
        role,
        hostel: cleanHostel,
        roomNumber: typeof roomNumber === "string" && roomNumber.trim() ? roomNumber.trim() : null,
        email: cleanEmail,
        ...(hashedPassword ? { password: hashedPassword } : {}),
        isActivated: shouldActivate,
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

// ─── IMPERSONATE USER (LOGIN AS USER) ─────────────────────────────────────────
// POST /api/v1/superadmin/users/:userId/impersonate
const impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found",
      });
    }

    if (targetUser.accountStatus === "deactivated" || targetUser.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: `Cannot login as user whose account status is '${targetUser.accountStatus}'.`,
      });
    }

    const config = await SystemConfig.getEffectiveConfig();
    const timeoutMinutes = config.sessionInactivityTimeoutMinutes || 10080;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    const sessionId = crypto.randomUUID();

    const newSession = await Session.create({
      sessionId,
      userId: targetUser._id,
      registrationNumber: targetUser.registrationNumber,
      deviceNickname: `Impersonated by Super Admin (${req.user.name || "Master Super Admin"})`,
      installationId: sessionId,
      deviceType: "desktop",
      os: "Web",
      browser: "SuperAdmin Console",
      userAgent: (req.headers["user-agent"] || "SuperAdmin Impersonation").slice(0, 512),
      ip: req.ip || "127.0.0.1",
      status: "active",
      expiresAt,
      loginAt: new Date(),
      lastActivityAt: new Date(),
    });

    const isDelegated = Boolean(
      targetUser.isDelegatedSubAdmin &&
      targetUser.delegatedRole === "superadmin" &&
      (targetUser.delegationIndefinite || (targetUser.delegationExpiresAt && new Date(targetUser.delegationExpiresAt) > new Date()))
    );

    const token = jwt.sign(
      {
        id: targetUser._id,
        sessionId: newSession.sessionId,
        name: targetUser.name,
        registrationNumber: targetUser.registrationNumber,
        role: targetUser.role,
        hostel: targetUser.hostel,
        roomNumber: targetUser.roomNumber,
        isImpersonated: true,
        impersonatedBy: req.user.id || req.user._id,
        isDelegatedSubAdmin: isDelegated,
        delegationTitle: isDelegated ? targetUser.delegationTitle : undefined,
        delegationScopes: isDelegated ? targetUser.delegationScopes : undefined,
        delegationExpiresAt: isDelegated ? targetUser.delegationExpiresAt : undefined,
        delegationIndefinite: isDelegated ? targetUser.delegationIndefinite : undefined,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Record Audit Trail
    await recordAudit({
      req,
      action: "USER_IMPERSONATED",
      targetType: "USER",
      targetId: targetUser._id.toString(),
      targetIdentifier: targetUser.registrationNumber,
      summary: `Super Admin '${req.user.name}' impersonated user '${targetUser.name}' (${targetUser.role})`,
      details: {
        targetRole: targetUser.role,
        targetHostel: targetUser.hostel,
        targetRoom: targetUser.roomNumber,
        sessionId: newSession.sessionId,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully logged in as ${targetUser.name} (${targetUser.role})`,
      token,
      user: {
        _id: targetUser._id,
        id: targetUser._id,
        name: targetUser.name,
        registrationNumber: targetUser.registrationNumber,
        role: targetUser.role,
        hostel: targetUser.hostel,
        roomNumber: targetUser.roomNumber,
        email: targetUser.email,
        isActivated: targetUser.isActivated,
      },
      isImpersonated: true,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to impersonate user",
      error: error.message,
    });
  }
};

// ─── APP VERSION & UPDATE MANAGEMENT ─────────────────────────────────────────
// GET /api/v1/superadmin/app-version
const getSuperAdminAppVersionConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    return res.status(200).json({
      success: true,
      appVersion: {
        latestVersion: config?.appVersion?.latestVersion || "1.0.0",
        minimumSupportedVersion: config?.appVersion?.minimumSupportedVersion || "1.0.0",
        updateMessage:
          config?.appVersion?.updateMessage ||
          "A new version of HostelCare is available. Please update to enjoy the latest features and security improvements.",
        updateUrl:
          config?.appVersion?.updateUrl ||
          "https://play.google.com/store/apps/details?id=com.hostelcare.app",
        forceUpdate: Boolean(config?.appVersion?.forceUpdate),
        isSuspended: Boolean(config?.appVersion?.isSuspended),
        suspendedReason: config?.appVersion?.suspendedReason || "",
        releaseNotes: config?.appVersion?.releaseNotes || "",
        releaseMedia: config?.appVersion?.releaseMedia || [],
        apkSha256: config?.appVersion?.apkSha256 || "",
        targetAudience: config?.appVersion?.targetAudience || "all",
        targetedRegistrationNumbers: config?.appVersion?.targetedRegistrationNumbers || [],
        targetedRoles: config?.appVersion?.targetedRoles || [],
        targetedHostels: config?.appVersion?.targetedHostels || [],
      },
      pilotTesting: {
        enabled: Boolean(config?.pilotTesting?.enabled),
        isSuspended: Boolean(config?.pilotTesting?.isSuspended),
        suspendedReason: config?.pilotTesting?.suspendedReason || "",
        version: config?.pilotTesting?.version || "1.2.2.12",
        updateMessage:
          config?.pilotTesting?.updateMessage ||
          "You have been selected for the HostelCare Pilot Beta Program! Please update to test the newest features.",
        updateUrl:
          config?.pilotTesting?.updateUrl ||
          "https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.12/hostelcare-v1.2.2.12.apk",
        forceUpdate: Boolean(config?.pilotTesting?.forceUpdate),
        releaseNotes: config?.pilotTesting?.releaseNotes || "",
        releaseMedia: config?.pilotTesting?.releaseMedia || [],
        apkSha256: config?.pilotTesting?.apkSha256 || "",
        targetedRegistrationNumbers: config?.pilotTesting?.targetedRegistrationNumbers || [],
      },
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve app version configuration",
      error: error.message,
    });
  }
};

// PUT /api/v1/superadmin/app-version
const updateSuperAdminAppVersionConfig = async (req, res) => {
  try {
    const {
      latestVersion,
      minimumSupportedVersion,
      updateMessage,
      updateUrl,
      forceUpdate,
      isSuspended,
      suspendedReason,
      releaseNotes,
      releaseMedia,
      apkSha256,
      targetAudience,
      targetedRegistrationNumbers,
      targetedRoles,
      targetedHostels,
    } = req.body;

    if (latestVersion !== undefined && !isValidVersion(latestVersion)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latestVersion format. Must be a valid semantic version (e.g. 1.2.0).",
      });
    }

    if (minimumSupportedVersion !== undefined && !isValidVersion(minimumSupportedVersion)) {
      return res.status(400).json({
        success: false,
        message: "Invalid minimumSupportedVersion format. Must be a valid semantic version (e.g. 1.0.0).",
      });
    }

    const config = await SystemConfig.getEffectiveConfig();
    if (!config.appVersion) {
      config.appVersion = {
        latestVersion: "1.0.0",
        minimumSupportedVersion: "1.0.0",
        updateMessage: "A new version of HostelCare is available.",
        updateUrl: "https://play.google.com/store/apps/details?id=com.hostelcare.app",
        forceUpdate: false,
        releaseNotes: "",
        targetAudience: "all",
        targetedRegistrationNumbers: [],
        targetedRoles: [],
        targetedHostels: [],
      };
    }

    const nextLatest = latestVersion !== undefined ? latestVersion.trim().replace(/^v/i, "") : config.appVersion.latestVersion;
    const nextMin = minimumSupportedVersion !== undefined ? minimumSupportedVersion.trim().replace(/^v/i, "") : config.appVersion.minimumSupportedVersion;

    if (compareVersions(nextMin, nextLatest) > 0) {
      return res.status(400).json({
        success: false,
        message: `Minimum supported version (${nextMin}) cannot be higher than latest version (${nextLatest}).`,
      });
    }

    if (updateUrl !== undefined) {
      const trimmedUrl = String(updateUrl).trim();
      if (!trimmedUrl.startsWith("https://") && !trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("market://")) {
        return res.status(400).json({
          success: false,
          message: "updateUrl must start with https://, http://, or market://",
        });
      }
      config.appVersion.updateUrl = trimmedUrl;
    }

    if (targetAudience !== undefined) {
      if (!["all", "specific"].includes(targetAudience)) {
        return res.status(400).json({
          success: false,
          message: "targetAudience must be either 'all' or 'specific'.",
        });
      }
      config.appVersion.targetAudience = targetAudience;
    }

    if (targetedRegistrationNumbers !== undefined) {
      if (Array.isArray(targetedRegistrationNumbers)) {
        config.appVersion.targetedRegistrationNumbers = targetedRegistrationNumbers
          .map((r) => String(r).trim().toUpperCase())
          .filter(Boolean);
      } else {
        return res.status(400).json({
          success: false,
          message: "targetedRegistrationNumbers must be an array of registration numbers.",
        });
      }
    }

    if (targetedRoles !== undefined) {
      if (Array.isArray(targetedRoles)) {
        config.appVersion.targetedRoles = targetedRoles
          .map((r) => String(r).trim().toLowerCase())
          .filter(Boolean);
      }
    }

    if (targetedHostels !== undefined) {
      if (Array.isArray(targetedHostels)) {
        config.appVersion.targetedHostels = targetedHostels
          .map((h) => String(h).trim())
          .filter(Boolean);
      }
    }

    const previous = {
      latestVersion: config.appVersion.latestVersion,
      minimumSupportedVersion: config.appVersion.minimumSupportedVersion,
      updateMessage: config.appVersion.updateMessage,
      updateUrl: config.appVersion.updateUrl,
      forceUpdate: config.appVersion.forceUpdate,
      isSuspended: config.appVersion.isSuspended,
      suspendedReason: config.appVersion.suspendedReason,
      releaseNotes: config.appVersion.releaseNotes,
      targetAudience: config.appVersion.targetAudience,
      targetedRegistrationNumbers: config.appVersion.targetedRegistrationNumbers,
      targetedRoles: config.appVersion.targetedRoles,
      targetedHostels: config.appVersion.targetedHostels,
    };

    if (latestVersion !== undefined) config.appVersion.latestVersion = nextLatest;
    if (minimumSupportedVersion !== undefined) config.appVersion.minimumSupportedVersion = nextMin;
    if (typeof forceUpdate === "boolean") config.appVersion.forceUpdate = forceUpdate;
    if (typeof isSuspended === "boolean") config.appVersion.isSuspended = isSuspended;
    if (typeof suspendedReason === "string") config.appVersion.suspendedReason = suspendedReason.trim().slice(0, 500);
    if (typeof updateMessage === "string") config.appVersion.updateMessage = updateMessage.trim().slice(0, 1000);
    if (typeof releaseNotes === "string") config.appVersion.releaseNotes = releaseNotes.trim().slice(0, 10000);
    if (Array.isArray(releaseMedia)) {
      config.appVersion.releaseMedia = releaseMedia
        .map((m) => String(m).trim())
        .filter((m) => m.startsWith("http://") || m.startsWith("https://"));
    }
    if (typeof apkSha256 === "string") config.appVersion.apkSha256 = apkSha256.trim().slice(0, 128);

    if (req.body.pilotTesting && typeof req.body.pilotTesting === "object") {
      if (!config.pilotTesting) config.pilotTesting = {};
      const pt = req.body.pilotTesting;
      if (typeof pt.enabled === "boolean") config.pilotTesting.enabled = pt.enabled;
      if (typeof pt.isSuspended === "boolean") config.pilotTesting.isSuspended = pt.isSuspended;
      if (typeof pt.suspendedReason === "string") config.pilotTesting.suspendedReason = pt.suspendedReason.trim().slice(0, 500);
      if (typeof pt.version === "string" && isValidVersion(pt.version)) {
        config.pilotTesting.version = pt.version.trim().replace(/^v/i, "");
      }
      if (typeof pt.updateUrl === "string") config.pilotTesting.updateUrl = pt.updateUrl.trim();
      if (typeof pt.updateMessage === "string") config.pilotTesting.updateMessage = pt.updateMessage.trim().slice(0, 1000);
      if (typeof pt.releaseNotes === "string") config.pilotTesting.releaseNotes = pt.releaseNotes.trim().slice(0, 10000);
      if (typeof pt.forceUpdate === "boolean") config.pilotTesting.forceUpdate = pt.forceUpdate;
      if (Array.isArray(pt.targetedRegistrationNumbers)) {
        const cleaned = pt.targetedRegistrationNumbers
          .map((r) => String(r).trim().toUpperCase())
          .filter(Boolean);
        config.pilotTesting.targetedRegistrationNumbers = cleaned;
      }
      config.markModified("pilotTesting");
    }

    config.updatedBy = req.user.registrationNumber || "superadmin";
    config.markModified("appVersion");
    await config.save();

    await recordAudit({
      req,
      action: "APP_VERSION_CONFIG_UPDATED",
      targetType: "SYSTEM_CONFIG",
      targetId: config._id,
      targetIdentifier: "appVersion",
      outcome: "SUCCESS",
      summary: `App version config updated: latest=${config.appVersion.latestVersion}, pilot=${config.pilotTesting?.version}, pilotSuspended=${config.pilotTesting?.isSuspended} by ${req.user.registrationNumber}`,
      details: {
        previous,
        updated: config.appVersion,
        pilotTesting: config.pilotTesting,
      },
    });

    return res.status(200).json({
      success: true,
      message: "App version configuration updated successfully",
      appVersion: config.appVersion,
      pilotTesting: config.pilotTesting,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update app version configuration",
      error: error.message,
    });
  }
};

// POST /api/v1/superadmin/pilot-testing/test-user
const testPilotUserEligibility = async (req, res) => {
  try {
    const { registrationNumber } = req.body;
    if (!registrationNumber) {
      return res.status(400).json({ success: false, message: "registrationNumber is required" });
    }

    const cleanReg = String(registrationNumber).trim().toUpperCase();
    const config = await SystemConfig.getEffectiveConfig();
    const appVersionConfig = config.appVersion || {};
    const pilotConfig = config.pilotTesting || {};

    // Check if user is registered in the system
    const student = await User.findOne({
      registrationNumber: { $regex: new RegExp(`^${cleanReg}$`, "i") },
    }).select("name role hostel roomNumber registrationNumber email accountStatus");

    let activeSessionIp = null;
    if (student) {
      const activeSession = await Session.findOne({
        userId: student._id,
        status: "active",
      }).sort({ lastActivityAt: -1 });
      if (activeSession && activeSession.ip) {
        activeSessionIp = activeSession.ip;
      }
    }

    const pilotTargets = (pilotConfig.targetedRegistrationNumbers || []).map((r) => String(r).trim().toUpperCase());
    const isTargeted = pilotTargets.includes(cleanReg);
    const isPilotActive = Boolean(pilotConfig.enabled);
    const isPilotSuspended = Boolean(pilotConfig.isSuspended);
    const pilotVersion = pilotConfig.version || "1.2.2.12";

    let updateWillTrigger = false;
    let reason = "";

    if (!isTargeted) {
      reason = `Student ${cleanReg} is NOT in the pilot target list. Click '+ Add to Pilot Testers Now' to add them.`;
    } else if (!isPilotActive) {
      reason = `Student ${cleanReg} is in the list, but Pilot Testing is currently DISABLED. Toggle Pilot Testing to ON.`;
    } else if (isPilotSuspended) {
      reason = `Student ${cleanReg} is in the list, but the Pilot Release is currently SUSPENDED (Paused). Click Resume.`;
    } else {
      updateWillTrigger = true;
      reason = `Student ${cleanReg} is ELIGIBLE! They will receive Pilot Release v${pilotVersion}.`;
    }

    const verdict = {
      isEligible: updateWillTrigger,
      reason,
    };

    const checks = {
      userFound: Boolean(student),
      inPilotGroup: isTargeted,
      pilotEnabled: isPilotActive,
      isSuspended: isPilotSuspended,
      activeSessionIp,
    };

    return res.status(200).json({
      success: true,
      registrationNumber: cleanReg,
      student: student
        ? {
            name: student.name,
            role: student.role,
            hostel: student.hostel,
            roomNumber: student.roomNumber,
            registrationNumber: student.registrationNumber,
            email: student.email,
            accountStatus: student.accountStatus,
          }
        : null,
      verdict,
      checks,
      isTargeted,
      isPilotActive,
      isPilotSuspended,
      pilotVersion,
      updateWillTrigger,
      reason,
      pilotConfig,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE PRODUCTION APP RELEASE ──────────────────────────────────────────
// DELETE /api/v1/superadmin/app-version/release
const deleteSuperAdminAppRelease = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const previous = { ...config.appVersion };

    config.appVersion.latestVersion = config.appVersion.minimumSupportedVersion || "1.0.0";
    config.appVersion.updateUrl = "";
    config.appVersion.updateMessage = "";
    config.appVersion.releaseNotes = "";
    config.appVersion.releaseMedia = [];
    config.appVersion.forceUpdate = false;
    config.appVersion.isSuspended = false;
    config.appVersion.suspendedReason = "";
    config.appVersion.apkSha256 = "";
    config.appVersion.targetedRegistrationNumbers = [];

    config.updatedBy = req.user?.registrationNumber || "superadmin";
    config.markModified("appVersion");
    await config.save();

    await recordAudit({
      req,
      action: "APP_RELEASE_DELETED",
      targetType: "SYSTEM_CONFIG",
      targetId: config._id,
      targetIdentifier: "appVersion",
      outcome: "SUCCESS",
      summary: `Production app release deleted and reset to baseline by ${req.user?.registrationNumber || "superadmin"}`,
      details: { previous, current: config.appVersion },
    });

    return res.status(200).json({
      success: true,
      message: "Production app release deleted successfully. All update prompts have been reset to baseline.",
      appVersion: config.appVersion,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete production app release",
      error: error.message,
    });
  }
};

// ─── DELETE PILOT TESTING RELEASE ───────────────────────────────────────────
// DELETE /api/v1/superadmin/pilot-testing/release
const deleteSuperAdminPilotRelease = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const previous = { ...(config.pilotTesting || {}) };

    config.pilotTesting = {
      enabled: false,
      isSuspended: false,
      suspendedReason: "",
      version: "",
      updateUrl: "",
      updateMessage: "",
      releaseNotes: "",
      forceUpdate: false,
      releaseMedia: [],
      apkSha256: "",
      targetedRegistrationNumbers: [],
    };

    config.updatedBy = req.user?.registrationNumber || "superadmin";
    config.markModified("pilotTesting");
    await config.save();

    await recordAudit({
      req,
      action: "PILOT_RELEASE_DELETED",
      targetType: "SYSTEM_CONFIG",
      targetId: config._id,
      targetIdentifier: "pilotTesting",
      outcome: "SUCCESS",
      summary: `Pilot testing release permanently deleted and cleared by ${req.user?.registrationNumber || "superadmin"}`,
      details: { previous, current: config.pilotTesting },
    });

    return res.status(200).json({
      success: true,
      message: "Pilot testing release deleted successfully. Pilot testing is now disabled and all pilot parameters have been cleared.",
      pilotTesting: config.pilotTesting,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete pilot release",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/superadmin/mess-notifications
 * Fetches current mess auto-notification configuration and status telemetry
 */
async function getMessNotificationSchedule(req, res) {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const { getKolkataTime, getEffectiveStartTimings } = require("../services/messReminderScheduler");
    const DeviceRegistry = require("../models/deviceRegistry.model");
    const timeInfo = getKolkataTime();
    const effective = await getEffectiveStartTimings();

    // Query live hardware device radar counts (Layer 1)
    const [androidHardwareCount, webPushCount, staleTokensCount, legacySessionsCount] = await Promise.all([
      DeviceRegistry.countDocuments({ platform: "android", isActive: true }),
      DeviceRegistry.countDocuments({ platform: "web", isActive: true }),
      DeviceRegistry.countDocuments({ isActive: false }),
      Session.countDocuments({
        status: "active",
        $or: [
          { pushToken: { $exists: true, $ne: null, $ne: "" } },
          { "webPushSubscription.endpoint": { $exists: true, $ne: null } },
        ],
      }),
    ]);

    const totalReachableDevices = Math.max(androidHardwareCount + webPushCount, legacySessionsCount);

    // Query today's dispatches for live telemetry audit log
    const MessNotificationDispatch = require("../models/messNotificationDispatch.model");
    const todayDispatches = await MessNotificationDispatch.find({ dateStr: timeInfo.dateStr })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const dayMode = effective.dayModeOverride || "auto";
    const isHolidaySchedule =
      dayMode === "working"
        ? false
        : dayMode === "sunday" || dayMode === "holiday"
        ? true
        : timeInfo.isSunday;

    return res.status(200).json({
      success: true,
      config: config.messNotificationConfig,
      effectiveTimings: effective,
      serverTime: timeInfo,
      activePushSessionsCount: legacySessionsCount,
      dayModeInfo: {
        weekday: timeInfo.weekday,
        isSunday: timeInfo.isSunday,
        dayModeOverride: dayMode,
        isHolidaySchedule,
        activeTimetableName: isHolidaySchedule ? "Sunday & Holidays" : "Working Days",
      },
      radar: {
        androidHardwareCount,
        webPushCount,
        staleTokensCount,
        legacySessionsCount,
        totalReachableDevices,
        fcmReady: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      },
      todayDispatches,
    });
  } catch (error) {
    console.error("getMessNotificationSchedule error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mess auto-notification schedule",
      error: error.message,
    });
  }
}

/**
 * PUT /api/v1/superadmin/mess-notifications
 * Updates mess auto-notification schedule timings, enabled status, and independent meal frequencies
 */
async function updateMessNotificationSchedule(req, res) {
  try {
    // 1. Strict Role Authorization
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin is authorized to configure mess notification settings.",
      });
    }

    const { enabled, workingDays, sundayAndHolidays, alertCountPerMeal, frequencies } = req.body;
    const config = await SystemConfig.getEffectiveConfig();

    if (!config.messNotificationConfig) {
      config.messNotificationConfig = {};
    }

    // 2. Validate & Update Enabled Status
    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Invalid 'enabled' parameter. Must be a boolean.",
        });
      }
      config.messNotificationConfig.enabled = enabled;
    }

    // 3. Validate & Update Independent Per-Meal Frequencies
    const validSlots = ["breakfast", "lunch", "snacks", "dinner"];
    if (frequencies !== undefined) {
      if (typeof frequencies !== "object" || frequencies === null || Array.isArray(frequencies)) {
        return res.status(400).json({
          success: false,
          message: "Frequencies must be an object with meal slots (breakfast, lunch, snacks, dinner).",
        });
      }

      if (!config.messNotificationConfig.frequencies) {
        config.messNotificationConfig.frequencies = {
          breakfast: 1,
          lunch: 1,
          snacks: 1,
          dinner: 1,
        };
      }

      for (const [slot, freq] of Object.entries(frequencies)) {
        if (!validSlots.includes(slot)) {
          return res.status(400).json({
            success: false,
            message: `Invalid meal slot in frequencies: '${slot}'. Must be one of: ${validSlots.join(", ")}`,
          });
        }
        const num = Number(freq);
        if (!Number.isInteger(num) || num < 1 || num > 3) {
          return res.status(400).json({
            success: false,
            message: `Invalid notification frequency for '${slot}': ${freq}. Must be an integer between 1 and 3.`,
          });
        }
        config.messNotificationConfig.frequencies[slot] = num;
      }
    }

    // Backward compatibility for single alertCountPerMeal
    if (alertCountPerMeal !== undefined) {
      const num = Number(alertCountPerMeal);
      if (!Number.isInteger(num) || num < 1 || num > 3) {
        return res.status(400).json({
          success: false,
          message: "alertCountPerMeal must be an integer between 1 and 3.",
        });
      }
      config.messNotificationConfig.alertCountPerMeal = num;
    }

    // 4. Validate Timings for Working Days & Sundays/Holidays
    const validateScheduleSlots = (scheduleObj, scheduleName) => {
      if (!scheduleObj || typeof scheduleObj !== "object") return null;
      for (const [slot, timeDef] of Object.entries(scheduleObj)) {
        if (!validSlots.includes(slot)) {
          return `Invalid slot '${slot}' in ${scheduleName}.`;
        }
        if (timeDef.startHour !== undefined) {
          const h = Number(timeDef.startHour);
          if (!Number.isInteger(h) || h < 0 || h > 23) {
            return `Invalid startHour for '${slot}' in ${scheduleName}: ${timeDef.startHour}. Must be 0-23.`;
          }
        }
        if (timeDef.startMinute !== undefined) {
          const m = Number(timeDef.startMinute);
          if (!Number.isInteger(m) || m < 0 || m > 59) {
            return `Invalid startMinute for '${slot}' in ${scheduleName}: ${timeDef.startMinute}. Must be 0-59.`;
          }
        }
      }
      return null;
    };

    if (workingDays && typeof workingDays === "object") {
      const err = validateScheduleSlots(workingDays, "workingDays");
      if (err) return res.status(400).json({ success: false, message: err });
      config.messNotificationConfig.workingDays = {
        ...config.messNotificationConfig.workingDays,
        ...workingDays,
      };
    }

    if (sundayAndHolidays && typeof sundayAndHolidays === "object") {
      const err = validateScheduleSlots(sundayAndHolidays, "sundayAndHolidays");
      if (err) return res.status(400).json({ success: false, message: err });
      config.messNotificationConfig.sundayAndHolidays = {
        ...config.messNotificationConfig.sundayAndHolidays,
        ...sundayAndHolidays,
      };
    }

    if (req.body.vacationMode !== undefined) {
      config.messNotificationConfig.vacationMode = Boolean(req.body.vacationMode);
    }

    if (req.body.dayModeOverride !== undefined) {
      const validDayModes = ["auto", "working", "sunday", "holiday"];
      if (validDayModes.includes(req.body.dayModeOverride)) {
        config.messNotificationConfig.dayModeOverride = req.body.dayModeOverride;
      }
    }

    if (req.body.mealSwitches && typeof req.body.mealSwitches === "object") {
      config.messNotificationConfig.mealSwitches = {
        ...config.messNotificationConfig.mealSwitches,
        ...req.body.mealSwitches,
      };
    }

    if (req.body.leadTimes && typeof req.body.leadTimes === "object") {
      config.messNotificationConfig.leadTimes = {
        ...config.messNotificationConfig.leadTimes,
        ...req.body.leadTimes,
      };
    }

    if (req.body.customTemplates && typeof req.body.customTemplates === "object") {
      config.messNotificationConfig.customTemplates = {
        ...config.messNotificationConfig.customTemplates,
        ...req.body.customTemplates,
      };
    }

    if (Array.isArray(req.body.targetBlocks)) {
      config.messNotificationConfig.targetBlocks = req.body.targetBlocks;
    }

    if (Array.isArray(req.body.targetRoles)) {
      config.messNotificationConfig.targetRoles = req.body.targetRoles;
    }

    config.updatedBy = req.user?.id || req.user?.registrationNumber || "superadmin";
    await config.save();

    // Preserve active delivery ledgers and notify worker of schedule change
    const { clearFiredMealBroadcasts } = require("../services/messReminderScheduler");
    clearFiredMealBroadcasts();

    await recordAudit({
      req,
      action: "MESS_NOTIFICATION_SCHEDULE_UPDATED",
      targetType: "SYSTEM_CONFIG",
      targetId: config._id,
      summary: `Super Admin updated mess auto-notification schedule (Status: ${config.messNotificationConfig.enabled ? "ENABLED" : "DISABLED"})`,
      details: {
        enabled: config.messNotificationConfig.enabled,
        frequencies: config.messNotificationConfig.frequencies,
        workingDays: config.messNotificationConfig.workingDays,
        sundayAndHolidays: config.messNotificationConfig.sundayAndHolidays,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Mess auto-notification schedule updated successfully.",
      config: config.messNotificationConfig,
    });
  } catch (error) {
    console.error("updateMessNotificationSchedule error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update mess auto-notification schedule",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/superadmin/mess-notifications/test
 * Triggers an isolated manual test broadcast for a meal slot without altering scheduled production dispatches
 */
async function testMessNotificationBroadcast(req, res) {
  try {
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Super Admin can trigger test broadcasts.",
      });
    }

    const { slotKey = "breakfast", pingMyPhone = false } = req.body;
    const validSlots = ["breakfast", "lunch", "snacks", "dinner"];
    if (!validSlots.includes(slotKey)) {
      return res.status(400).json({
        success: false,
        message: `Invalid slot key: ${slotKey}. Must be one of: ${validSlots.join(", ")}`,
      });
    }

    const { broadcastMealReminder } = require("../services/messReminderScheduler");
    // Pass isManualTest: true to guarantee separation from production dispatch ledger
    const result = await broadcastMealReminder(slotKey, {
      isManualTest: true,
      isTest: true,
      targetUserId: pingMyPhone ? req.user?._id : null,
    });

    await recordAudit({
      req,
      action: "MESS_NOTIFICATION_TEST_TRIGGERED",
      targetType: "NOTIFICATION",
      summary: `Super Admin triggered manual test alert for ${slotKey} (${pingMyPhone ? "Admin Device Only" : "Universal Broadcast"}, Targets: ${result.targets || 0})`,
      details: {
        slotKey,
        pingMyPhone,
        targets: result.targets,
        report: result.report,
      },
    });

    return res.status(200).json({
      success: true,
      message: pingMyPhone
        ? `Direct Test Alert sent to your phone for ${slotKey.toUpperCase()} (Targets: ${result.targets || 0}).`
        : `Manual test notification for ${slotKey.toUpperCase()} broadcasted successfully to ${result.targets || 0} active devices.`,
      result,
    });
  } catch (error) {
    console.error("testMessNotificationBroadcast error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to broadcast test mess notification",
      error: error.message,
    });
  }
}

/**
 * DELETE /api/v1/superadmin/mess-notifications/dispatches
 * Clears recorded mess notification dispatches so Super Admin can cancel repeats, clear logs, or re-test cleanly
 */
async function purgeMessNotificationDispatches(req, res) {
  try {
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }
    const { dateStr } = req.query;
    const MessNotificationDispatch = require("../models/messNotificationDispatch.model");
    const filter = dateStr ? { dateStr } : {};
    const result = await MessNotificationDispatch.deleteMany(filter);

    await recordAudit({
      req,
      action: "MESS_NOTIFICATION_DISPATCHES_PURGED",
      targetType: "NOTIFICATION",
      summary: `Super Admin purged ${result.deletedCount} mess notification dispatch records${dateStr ? ` for ${dateStr}` : ""}`,
      details: { deletedCount: result.deletedCount, dateStr },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully purged ${result.deletedCount} mess notification record(s).`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("purgeMessNotificationDispatches error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to purge dispatches",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/superadmin/mess-notifications/auto-fire-simulator
 * Executes or schedules an immediate simulation of the production auto-cron pipeline.
 * Allows Super Admin to trigger auto-broadcasts with optional countdown delay (e.g. 15s) so they can lock their phone and see wake-lock in action.
 */
async function simulateAutoFireMessAlert(req, res) {
  try {
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { slotKey = "snacks", delaySeconds = 0, reArm = true } = req.body;
    const validSlots = ["breakfast", "lunch", "snacks", "dinner"];
    if (!validSlots.includes(slotKey)) {
      return res.status(400).json({
        success: false,
        message: `Invalid slotKey: ${slotKey}. Must be one of: ${validSlots.join(", ")}`,
      });
    }

    const { getKolkataTime, broadcastMealReminder } = require("../services/messReminderScheduler");
    const MessNotificationDispatch = require("../models/messNotificationDispatch.model");
    const SystemConfig = require("../models/systemConfig.model");
    const timeInfo = getKolkataTime();

    if (reArm) {
      await MessNotificationDispatch.deleteMany({
        dateStr: timeInfo.dateStr,
        mealSlot: slotKey,
      }).catch(() => {});
    }

    const delay = Math.max(0, Math.min(300, Number(delaySeconds) || 0));

    if (delay > 0) {
      setTimeout(async () => {
        try {
          console.log(`⏱️ [AutoFireSimulator] Delayed auto-fire triggering now for ${slotKey} (${delay}s delay elapsed)...`);
          const config = await SystemConfig.getEffectiveConfig();
          const effective = config?.messNotificationConfig || {};

          await broadcastMealReminder(slotKey, {
            alertIndex: 1,
            occurrence: 1,
            isManualTest: false,
            isSimulatedAuto: true,
            customTemplate: effective.customTemplates?.[slotKey] || {},
            targetBlocks: effective.targetBlocks || [],
            targetRoles: effective.targetRoles || ["student"],
          });
        } catch (simErr) {
          console.error("⏱️ [AutoFireSimulator] Background timer error:", simErr.message);
        }
      }, delay * 1000);

      await recordAudit({
        req,
        action: "MESS_AUTO_FIRE_SCHEDULED",
        targetType: "NOTIFICATION",
        summary: `Super Admin armed delayed auto-fire simulation for ${slotKey.toUpperCase()} in ${delay} seconds`,
        details: { slotKey, delaySeconds: delay, reArm },
      });

      return res.status(200).json({
        success: true,
        scheduled: true,
        delaySeconds: delay,
        message: `⚡ Auto-fire armed! Server will automatically broadcast ${slotKey.toUpperCase()} alert in ${delay} seconds. Lock your phone now to test heads-up wake-lock!`,
      });
    }

    const config = await SystemConfig.getEffectiveConfig();
    const effective = config?.messNotificationConfig || {};

    const result = await broadcastMealReminder(slotKey, {
      alertIndex: 1,
      occurrence: 1,
      isManualTest: false,
      isSimulatedAuto: true,
      customTemplate: effective.customTemplates?.[slotKey] || {},
      targetBlocks: effective.targetBlocks || [],
      targetRoles: effective.targetRoles || ["student"],
    });

    await recordAudit({
      req,
      action: "MESS_AUTO_FIRE_EXECUTED",
      targetType: "NOTIFICATION",
      summary: `Super Admin executed immediate auto-fire simulation for ${slotKey.toUpperCase()} (Targets: ${result.targets || 0})`,
      details: { slotKey, targets: result.targets, report: result.report },
    });

    return res.status(200).json({
      success: true,
      scheduled: false,
      message: `⚡ Auto-fire broadcast completed for ${slotKey.toUpperCase()}! Dispatched to ${result.targets || 0} active devices.`,
      result,
    });
  } catch (error) {
    console.error("simulateAutoFireMessAlert error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to simulate auto-fire alert",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/superadmin/mess-notifications/rearm-slot
 * Clears today's dispatch lock for a specific slot or all slots so that auto-cron can fire again.
 */
async function rearmMessSlotForToday(req, res) {
  try {
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { slotKey = "all" } = req.body;
    const { getKolkataTime } = require("../services/messReminderScheduler");
    const MessNotificationDispatch = require("../models/messNotificationDispatch.model");
    const timeInfo = getKolkataTime();

    const query = { dateStr: timeInfo.dateStr };
    if (slotKey !== "all") {
      query.mealSlot = slotKey;
    }

    const result = await MessNotificationDispatch.deleteMany(query);

    await recordAudit({
      req,
      action: "MESS_SLOT_REARMED",
      targetType: "NOTIFICATION",
      summary: `Super Admin re-armed ${slotKey.toUpperCase()} for today (${timeInfo.dateStr}). Removed ${result.deletedCount} dispatch locks.`,
      details: { slotKey, deletedCount: result.deletedCount, dateStr: timeInfo.dateStr },
    });

    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: slotKey === "all"
        ? `All meal slots for today (${timeInfo.dateStr}) re-armed! Auto-cron locks cleared.`
        : `${slotKey.toUpperCase()} re-armed for today! Auto-cron lock cleared.`,
    });
  } catch (error) {
    console.error("rearmMessSlotForToday error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to re-arm meal slot",
      error: error.message,
    });
  }
}

// ─── GLOBAL EMERGENCY / ANNOUNCEMENT NOTICES ─────────────────────────────────
const getGlobalNotices = async (req, res) => {
  try {
    const notices = await GlobalNotice.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({ success: true, notices });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch notices", error: error.message });
  }
};

const getActiveGlobalNotice = async (req, res) => {
  try {
    const notice = await GlobalNotice.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, notice: notice || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch active notice", error: error.message });
  }
};

const createGlobalNotice = async (req, res) => {
  try {
    const { title, message, priority = "urgent", targetRole = "ALL", deactivatePrevious = true } = req.body;
    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Notice title and message are required." });
    }

    if (deactivatePrevious) {
      await GlobalNotice.updateMany({ isActive: true }, { $set: { isActive: false } });
    }

    const notice = await GlobalNotice.create({
      title: title.trim(),
      message: message.trim(),
      priority,
      targetRole,
      isActive: true,
      createdBy: req.user.id,
      createdByName: req.user.name || "Super Admin",
    });

    await recordAudit({
      req,
      action: "NOTIFICATION_SENT",
      targetType: "NOTIFICATION",
      targetId: notice._id,
      summary: `Super Admin published Global Notice: "${notice.title}"`,
      details: { priority, targetRole },
    });

    // Real-time Socket broadcast
    try {
      const { getChatIO } = require("../sockets/chatSocket");
      const io = getChatIO ? getChatIO() : null;
      if (io) {
        io.emit("global_notice_published", notice);
      }
    } catch (e) {
      console.warn("Notice socket broadcast warning:", e.message);
    }

    // Multi-Channel Push broadcast (So older installed APKs & background phones receive it in Android notification bar)
    try {
      const { sendPushToSessions } = require("../services/notificationService");
      const Session = require("../models/session.model");
      let sessionQuery = { status: "active" };
      if (targetRole && targetRole !== "ALL") {
        const User = require("../models/user.model");
        const userMatches = await User.find({ role: targetRole }).select("_id");
        sessionQuery.userId = { $in: userMatches.map((u) => u._id) };
      }
      const targetSessions = await Session.find(sessionQuery).select("+pushToken +webPushSubscription");
      if (targetSessions && targetSessions.length > 0) {
        sendPushToSessions(targetSessions, {
          title: `${priority === "urgent" ? "🚨" : "📢"} ${notice.title}`,
          body: notice.message,
          route: "/dashboard",
          data: {
            noticeId: notice._id.toString(),
            priority: notice.priority,
          },
        }).catch((err) => console.warn("Global notice push dispatch error:", err.message));
      }
    } catch (pushErr) {
      console.warn("Global notice push broadcast warning:", pushErr.message);
    }

    return res.status(201).json({ success: true, message: "Global Notice published successfully", notice });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create notice", error: error.message });
  }
};

const toggleGlobalNoticeStatus = async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { isActive } = req.body;
    const notice = await GlobalNotice.findByIdAndUpdate(noticeId, { isActive: Boolean(isActive) }, { new: true });
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }
    return res.status(200).json({ success: true, message: "Notice status updated", notice });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update notice status", error: error.message });
  }
};

const deleteGlobalNotice = async (req, res) => {
  try {
    const { noticeId } = req.params;
    const notice = await GlobalNotice.findByIdAndDelete(noticeId);
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }
    return res.status(200).json({ success: true, message: "Notice deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete notice", error: error.message });
  }
};

/**
 * GET /api/v1/superadmin/device-registry
 * Searchable, filterable list of all registered hardware devices
 */
async function getDeviceRegistryDirectory(req, res) {
  try {
    const DeviceRegistry = require("../models/deviceRegistry.model");
    const { search = "", platform, isMuted, isActive, page = 1, limit = 20 } = req.query;

    const query = {};
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { studentName: regex },
        { regNo: regex },
        { roomNumber: regex },
        { hostelBlock: regex },
        { deviceId: regex },
      ];
    }
    if (platform) query.platform = platform;
    if (isMuted !== undefined) query.isMuted = isMuted === "true";
    if (isActive !== undefined) query.isActive = isActive === "true";

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (p - 1) * l;

    const [devices, total] = await Promise.all([
      DeviceRegistry.find(query).sort({ lastSeenAt: -1 }).skip(skip).limit(l).lean(),
      DeviceRegistry.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      devices,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch device registry", error: error.message });
  }
}

/**
 * POST /api/v1/superadmin/device-registry/:deviceId/toggle-mute
 * Granular mute/unmute of mess alerts for a single student device
 */
async function toggleDeviceMuteStatus(req, res) {
  try {
    const DeviceRegistry = require("../models/deviceRegistry.model");
    const { deviceId } = req.params;
    const { isMuted, reason = "" } = req.body;

    const device = await DeviceRegistry.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found in registry" });
    }

    const nextMuted = isMuted !== undefined ? Boolean(isMuted) : !device.isMuted;
    device.isMuted = nextMuted;
    if (reason) device.mutedReason = reason;
    await device.save();

    await recordAudit({
      req,
      action: "DEVICE_MUTE_TOGGLED",
      targetType: "DEVICE",
      targetIdentifier: deviceId,
      summary: `${nextMuted ? "Muted" : "Unmuted"} mess notifications for student ${device.studentName || device.regNo || deviceId}`,
      details: { deviceId, isMuted: nextMuted, reason },
    });

    return res.status(200).json({
      success: true,
      message: `Device for ${device.studentName || device.regNo || "Student"} ${nextMuted ? "MUTED (Alerts skipped)" : "UNMUTED (Alerts enabled)"}`,
      device,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to toggle device mute status", error: error.message });
  }
}

/**
 * POST /api/v1/superadmin/device-registry/:deviceId/ping
 * 1-click test ping to a single student device only
 */
async function pingSingleDevice(req, res) {
  try {
    const DeviceRegistry = require("../models/deviceRegistry.model");
    const { broadcastMealReminder } = require("../services/messReminderScheduler");
    const { deviceId } = req.params;
    const { customTitle, customBody, slotKey = "breakfast" } = req.body;

    const device = await DeviceRegistry.findOne({ deviceId }).lean();
    if (!device) {
      return res.status(404).json({ success: false, message: "Target device not found" });
    }

    const result = await broadcastMealReminder(slotKey, {
      isManualTest: true,
      isTest: true,
      targetDeviceId: deviceId,
      customTitle: customTitle || `🎯 Direct Alert for ${device.studentName || device.regNo || "Student"}`,
      customBody: customBody || `Meal Alert: Today's ${slotKey.toUpperCase()} is active. Sent directly by Super Admin.`,
    });

    return res.status(200).json({
      success: true,
      message: `Direct ping delivered to device of ${device.studentName || device.regNo || deviceId}`,
      result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to ping single device", error: error.message });
  }
}

/**
 * DELETE /api/v1/superadmin/device-registry/:deviceId
 * Unregisters / prunes a device from hardware vault
 */
async function deleteDeviceRegistryEntry(req, res) {
  try {
    const DeviceRegistry = require("../models/deviceRegistry.model");
    const { deviceId } = req.params;
    await DeviceRegistry.deleteOne({ deviceId });
    return res.status(200).json({ success: true, message: "Device successfully pruned from hardware registry" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to remove device", error: error.message });
  }
}

/**
 * POST /api/v1/superadmin/mess-notifications/broadcast-custom
 * 1-click emergency mess announcement broadcast to targeted blocks/roles
 */
async function broadcastCustomMessAlert(req, res) {
  try {
    const { title, body, imageUrl, targetBlocks = [], targetRoles = ["student"] } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Title and body are required for custom announcement broadcast" });
    }

    const { broadcastMealReminder } = require("../services/messReminderScheduler");
    const result = await broadcastMealReminder("breakfast", {
      isManualTest: true,
      isTest: true,
      customTitle: title,
      customBody: body,
      imageUrl: imageUrl || null,
      targetBlocks,
      targetRoles,
    });

    await recordAudit({
      req,
      action: "CUSTOM_MESS_ALERT_BROADCASTED",
      targetType: "NOTIFICATION",
      summary: `Custom Announcement Broadcast: "${title}" (Targets: ${result.targets || 0})`,
      details: { title, body, imageUrl, targetBlocks, targetRoles, targets: result.targets },
    });

    return res.status(200).json({
      success: true,
      message: `Custom announcement broadcasted successfully to ${result.targets || 0} nodes.`,
      result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to broadcast custom alert", error: error.message });
  }
}

// ─── TEMPORARY SUB-ADMIN DELEGATION ───────────────────────────────────────────
const Delegation = require("../models/delegation.model");

// GET /api/v1/superadmin/delegations
const getDelegationsList = async (req, res) => {
  try {
    const now = new Date();

    // Auto-expire any past delegations that are not indefinite
    const expiredActive = await Delegation.find({
      status: "active",
      isIndefinite: false,
      expiresAt: { $lte: now },
    });

    if (expiredActive.length > 0) {
      for (const d of expiredActive) {
        d.status = "expired";
        await d.save();
        await User.findByIdAndUpdate(d.userId, {
          isDelegatedSubAdmin: false,
          delegatedRole: null,
          delegationId: null,
        }).catch(() => {});
      }
    }

    const delegations = await Delegation.find()
      .sort({ createdAt: -1 })
      .lean();

    const formatted = delegations.map((d) => {
      let isExpired = false;
      let timeRemainingMinutes = null;

      if (!d.isIndefinite && d.expiresAt) {
        const diffMs = new Date(d.expiresAt).getTime() - now.getTime();
        if (diffMs <= 0 && d.status === "active") {
          isExpired = true;
          timeRemainingMinutes = 0;
        } else if (diffMs > 0) {
          timeRemainingMinutes = Math.round(diffMs / (1000 * 60));
        }
      }

      return {
        ...d,
        isExpired,
        timeRemainingMinutes,
      };
    });

    const activeCount = formatted.filter((d) => d.status === "active" && !d.isExpired).length;
    const indefiniteCount = formatted.filter((d) => d.status === "active" && d.isIndefinite).length;

    return res.status(200).json({
      success: true,
      delegations: formatted,
      stats: {
        total: formatted.length,
        active: activeCount,
        indefinite: indefiniteCount,
      },
    });
  } catch (error) {
    console.error("getDelegationsList error:", error);
    return res.status(500).json({ success: false, message: "Failed to load delegations", error: error.message });
  }
};

// POST /api/v1/superadmin/delegations
const createDelegation = async (req, res) => {
  try {
    const {
      userId,
      title = "Acting Sub-Admin",
      durationMode = "indefinite",
      customExpiresAt,
      isIndefinite = false,
      scopes = ["all"],
      notes = "",
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Target userId is required for delegation" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Target user not found" });
    }

    if (user.role === "superadmin") {
      return res.status(400).json({ success: false, message: "User is already a permanent Super Admin" });
    }

    let calculatedExpiresAt = null;
    let effectiveIndefinite = durationMode === "indefinite" || isIndefinite === true;

    if (!effectiveIndefinite) {
      const nowMs = Date.now();
      if (durationMode === "24h") {
        calculatedExpiresAt = new Date(nowMs + 24 * 3600 * 1000);
      } else if (durationMode === "3d") {
        calculatedExpiresAt = new Date(nowMs + 3 * 24 * 3600 * 1000);
      } else if (durationMode === "7d") {
        calculatedExpiresAt = new Date(nowMs + 7 * 24 * 3600 * 1000);
      } else if (durationMode === "30d") {
        calculatedExpiresAt = new Date(nowMs + 30 * 24 * 3600 * 1000);
      } else if (durationMode === "custom") {
        if (!customExpiresAt) {
          return res.status(400).json({ success: false, message: "customExpiresAt date is required for custom duration" });
        }
        calculatedExpiresAt = new Date(customExpiresAt);
        if (isNaN(calculatedExpiresAt.getTime()) || calculatedExpiresAt <= new Date()) {
          return res.status(400).json({ success: false, message: "Custom expiry date must be in the future" });
        }
      } else {
        effectiveIndefinite = true;
      }
    }

    // Revoke any previous active delegation for this user
    await Delegation.updateMany(
      { userId: user._id, status: "active" },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revokedBy: req.user.registrationNumber,
          revocationReason: "Superseded by new delegation grant",
        },
      }
    );

    const delegation = await Delegation.create({
      userId: user._id,
      userRegistrationNumber: user.registrationNumber,
      userName: user.name,
      originalRole: user.role,
      delegatedBy: req.user._id || req.user.id,
      delegatedByRegistrationNumber: req.user.registrationNumber,
      title: title.trim() || "Acting Sub-Admin",
      scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : ["all"],
      durationMode,
      isIndefinite: effectiveIndefinite,
      expiresAt: calculatedExpiresAt,
      status: "active",
      notes: notes.trim(),
    });

    // Update user record
    user.isDelegatedSubAdmin = true;
    user.delegatedRole = "superadmin";
    user.delegationId = delegation._id;
    user.delegationTitle = delegation.title;
    user.delegationScopes = delegation.scopes;
    user.delegationExpiresAt = calculatedExpiresAt;
    user.delegationIndefinite = effectiveIndefinite;
    await user.save();

    await recordAudit({
      req,
      action: "SUB_ADMIN_DELEGATED",
      targetType: "USER",
      targetId: user._id,
      targetIdentifier: user.registrationNumber,
      summary: `Delegated Sub-Admin powers to ${user.name} (${user.registrationNumber}, ${user.role}) with mode: ${durationMode}${effectiveIndefinite ? " (Until Manually Revoked)" : ` (Expires: ${calculatedExpiresAt.toISOString()})`}`,
      details: {
        delegationId: delegation._id,
        durationMode,
        isIndefinite: effectiveIndefinite,
        expiresAt: calculatedExpiresAt,
        title: delegation.title,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Sub-Admin powers successfully delegated to ${user.name} (${user.registrationNumber})! Mode: ${effectiveIndefinite ? "Until Manually Revoked" : durationMode}`,
      delegation,
    });
  } catch (error) {
    console.error("createDelegation error:", error);
    return res.status(500).json({ success: false, message: "Failed to delegate sub-admin powers", error: error.message });
  }
};

// POST /api/v1/superadmin/delegations/:delegationId/revoke
const revokeDelegation = async (req, res) => {
  try {
    const { delegationId } = req.params;
    const { reason = "Revoked by Super Admin" } = req.body;

    const delegation = await Delegation.findById(delegationId);
    if (!delegation) {
      return res.status(404).json({ success: false, message: "Delegation record not found" });
    }

    delegation.status = "revoked";
    delegation.revokedAt = new Date();
    delegation.revokedBy = req.user.registrationNumber;
    delegation.revocationReason = reason;
    await delegation.save();

    // Restore user original state
    await User.findByIdAndUpdate(delegation.userId, {
      isDelegatedSubAdmin: false,
      delegatedRole: null,
      delegationId: null,
      delegationExpiresAt: null,
      delegationIndefinite: false,
    });

    await recordAudit({
      req,
      action: "SUB_ADMIN_DELEGATION_REVOKED",
      targetType: "USER",
      targetId: delegation.userId,
      targetIdentifier: delegation.userRegistrationNumber,
      summary: `Revoked Sub-Admin delegation from ${delegation.userName} (${delegation.userRegistrationNumber}). Reason: ${reason}`,
      details: { delegationId, reason },
    });

    return res.status(200).json({
      success: true,
      message: `Sub-Admin powers for ${delegation.userName} (${delegation.userRegistrationNumber}) revoked successfully.`,
      delegation,
    });
  } catch (error) {
    console.error("revokeDelegation error:", error);
    return res.status(500).json({ success: false, message: "Failed to revoke delegation", error: error.message });
  }
};

// PATCH /api/v1/superadmin/delegations/:delegationId/duration
const updateDelegationDuration = async (req, res) => {
  try {
    const { delegationId } = req.params;
    const { durationMode = "indefinite", customExpiresAt, isIndefinite = false } = req.body;

    const delegation = await Delegation.findById(delegationId);
    if (!delegation) {
      return res.status(404).json({ success: false, message: "Delegation record not found" });
    }

    let calculatedExpiresAt = null;
    let effectiveIndefinite = durationMode === "indefinite" || isIndefinite === true;

    if (!effectiveIndefinite) {
      const nowMs = Date.now();
      if (durationMode === "24h") {
        calculatedExpiresAt = new Date(nowMs + 24 * 3600 * 1000);
      } else if (durationMode === "3d") {
        calculatedExpiresAt = new Date(nowMs + 3 * 24 * 3600 * 1000);
      } else if (durationMode === "7d") {
        calculatedExpiresAt = new Date(nowMs + 7 * 24 * 3600 * 1000);
      } else if (durationMode === "30d") {
        calculatedExpiresAt = new Date(nowMs + 30 * 24 * 3600 * 1000);
      } else if (durationMode === "custom") {
        if (!customExpiresAt) {
          return res.status(400).json({ success: false, message: "customExpiresAt is required" });
        }
        calculatedExpiresAt = new Date(customExpiresAt);
      }
    }

    if (Array.isArray(req.body.scopes) && req.body.scopes.length > 0) {
      delegation.scopes = req.body.scopes;
      await User.findByIdAndUpdate(delegation.userId, {
        delegationScopes: req.body.scopes,
      });
    }

    delegation.durationMode = durationMode;
    delegation.isIndefinite = effectiveIndefinite;
    delegation.expiresAt = calculatedExpiresAt;
    delegation.status = "active";
    await delegation.save();

    await User.findByIdAndUpdate(delegation.userId, {
      isDelegatedSubAdmin: true,
      delegatedRole: "superadmin",
      delegationExpiresAt: calculatedExpiresAt,
      delegationIndefinite: effectiveIndefinite,
    });

    await recordAudit({
      req,
      action: "SUB_ADMIN_DURATION_UPDATED",
      targetType: "USER",
      targetId: delegation.userId,
      targetIdentifier: delegation.userRegistrationNumber,
      summary: `Updated Sub-Admin duration for ${delegation.userName} (${delegation.userRegistrationNumber}) to mode: ${durationMode}`,
      details: { delegationId, durationMode, isIndefinite: effectiveIndefinite, expiresAt: calculatedExpiresAt, scopes: delegation.scopes },
    });

    return res.status(200).json({
      success: true,
      message: `Delegation duration updated to: ${effectiveIndefinite ? "Until Manually Revoked (Jab Super Admin Chahe)" : durationMode}`,
      delegation,
    });
  } catch (error) {
    console.error("updateDelegationDuration error:", error);
    return res.status(500).json({ success: false, message: "Failed to update delegation duration", error: error.message });
  }
};

// PATCH /api/v1/superadmin/delegations/:delegationId/scopes
const updateDelegationScopes = async (req, res) => {
  try {
    const { delegationId } = req.params;
    const { scopes } = req.body;

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ success: false, message: "Valid scopes array is required" });
    }

    const delegation = await Delegation.findById(delegationId);
    if (!delegation) {
      return res.status(404).json({ success: false, message: "Delegation record not found" });
    }

    const previousScopes = [...(delegation.scopes || [])];
    delegation.scopes = scopes;
    await delegation.save();

    await User.findByIdAndUpdate(delegation.userId, {
      delegationScopes: scopes,
    });

    await recordAudit({
      req,
      action: "SUB_ADMIN_SCOPES_UPDATED",
      targetType: "USER",
      targetId: delegation.userId,
      targetIdentifier: delegation.userRegistrationNumber,
      summary: `Updated feature permission scopes for Sub-Admin ${delegation.userName} (${delegation.userRegistrationNumber})`,
      details: { delegationId, previousScopes, updatedScopes: scopes },
    });

    return res.status(200).json({
      success: true,
      message: `Feature scopes for ${delegation.userName} updated successfully`,
      delegation,
    });
  } catch (error) {
    console.error("updateDelegationScopes error:", error);
    return res.status(500).json({ success: false, message: "Failed to update delegation scopes", error: error.message });
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
};


