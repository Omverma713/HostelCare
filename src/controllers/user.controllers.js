const User = require("../models/user.model");
const Session = require("../models/session.model");
const DeviceRegistry = require("../models/deviceRegistry.model");
const SystemConfig = require("../models/systemConfig.model");
const Argon = require("argon2");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const argonLimiter = require("../../utils/argonLimiter");
const { recordClientIdentity } = require("../utils/clientTracker");

/**
 * Safely parse User Agent string into device category, OS, and browser
 */
function parseClientInfo(userAgent = "") {
  let deviceType = "browser";
  let os = "Unknown OS";
  let browser = "Unknown Browser";

  const ua = (userAgent || "").toLowerCase();

  // OS Detection
  if (ua.includes("android")) {
    os = "Android";
    deviceType = "android";
  } else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
    os = "iOS";
    deviceType = "browser";
  } else if (ua.includes("windows")) {
    os = "Windows";
    deviceType = "desktop";
  } else if (ua.includes("mac os") || ua.includes("macintosh")) {
    os = "macOS";
    deviceType = "desktop";
  } else if (ua.includes("linux")) {
    os = "Linux";
    deviceType = "desktop";
  }

  // Capacitor / Native App Detection
  if (ua.includes("capacitor") || ua.includes("hostelcare-mobile")) {
    deviceType = "android";
  }

  // Browser Detection
  if (ua.includes("edg/")) {
    browser = "Edge";
  } else if (ua.includes("chrome") && !ua.includes("chromium")) {
    browser = "Chrome";
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari";
  }

  return { deviceType, os, browser };
}

// ─── activateUser ─────────────────────────────────────────────────────────────
// POST /api/v1/users/activate
const activateUser = async (req, res) => {
  try {
    const {
      registrationNumber,
      hostel,
      roomNumber,
      newPassword,
      confirmPassword,
      activationToken,
    } = req.body;

    const cleanRegNum = typeof registrationNumber === "string" ? registrationNumber.trim() : "";
    const cleanHostel = typeof hostel === "string" ? hostel.trim() : "";

    if (!cleanRegNum || !cleanHostel) {
      return res.status(400).json({
        success: false,
        message: "Registration number and hostel are required for account activation.",
      });
    }

    const user = await User.findOne({
      registrationNumber: cleanRegNum,
      hostel: cleanHostel,
    }).select("+activationToken +activationTokenExpiresAt");

    if (user == null) {
      return res.status(404).json({
        success: false,
        message: "User not found with matching registration number and hostel.",
      });
    }

    if (user.accountStatus === "deactivated" || user.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message: "This account has been deactivated or suspended.",
      });
    }

    if (user.isActivated === true) {
      return res.status(400).json({
        success: false,
        message: "User account is already activated.",
      });
    }

    // Verify single-use setup token if configured on the account
    if (user.activationToken) {
      if (!activationToken || typeof activationToken !== "string" || !activationToken.trim()) {
        return res.status(401).json({
          success: false,
          code: "ACTIVATION_TOKEN_REQUIRED",
          message: "A single-use activation setup token is required to activate this account.",
        });
      }

      if (user.activationTokenExpiresAt && new Date() > user.activationTokenExpiresAt) {
        return res.status(400).json({
          success: false,
          code: "ACTIVATION_TOKEN_EXPIRED",
          message: "This activation token has expired. Please contact an administrator.",
        });
      }

      if (activationToken.trim() !== user.activationToken) {
        return res.status(401).json({
          success: false,
          code: "INVALID_ACTIVATION_TOKEN",
          message: "Invalid activation token provided.",
        });
      }

      // Consume the single-use token upon successful verification
      user.activationToken = null;
      user.activationTokenExpiresAt = null;
    }

    // Check maintenance mode for non-superadmin users
    if (user.role !== "superadmin") {
      const config = await SystemConfig.getEffectiveConfig();
      const maintenance = config.maintenance || {};
      const globalMaint = maintenance.global || {};
      const selectiveMaint = maintenance.selective || {};

      if (globalMaint.enabled) {
        return res.status(503).json({
          success: false,
          code: "MAINTENANCE_MODE_ACTIVE",
          message:
            globalMaint.message ||
            "HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.",
          maintenance: {
            mode: "global",
            title: globalMaint.title || "System Maintenance in Progress",
            message:
              globalMaint.message ||
              "HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.",
            plannedStart: globalMaint.plannedStart || null,
            plannedEnd: globalMaint.plannedEnd || null,
          },
        });
      }

      if (selectiveMaint.enabled) {
        const affectedRoles = Array.isArray(selectiveMaint.affectedRoles)
          ? selectiveMaint.affectedRoles
          : [];
        const affectedRegs = Array.isArray(selectiveMaint.affectedRegistrationNumbers)
          ? selectiveMaint.affectedRegistrationNumbers
          : [];

        if (affectedRoles.includes(user.role) || affectedRegs.includes(user.registrationNumber)) {
          return res.status(503).json({
            success: false,
            code: "MAINTENANCE_MODE_ACTIVE",
            message:
              selectiveMaint.message ||
              "Access for your account or user group is currently paused for scheduled system maintenance.",
            maintenance: {
              mode: "selective",
              title: selectiveMaint.title || "Service Temporarily Unavailable",
              message:
                selectiveMaint.message ||
                "Access for your account or user group is currently paused for scheduled system maintenance.",
              affectedRoles,
              affectedRegistrationNumbers: affectedRegs,
              plannedStart: selectiveMaint.plannedStart || null,
              plannedEnd: selectiveMaint.plannedEnd || null,
            },
          });
        }
      }
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    const minLength = user.role === "student" ? 6 : 8;
    if (newPassword.length < minLength) {
      return res.status(400).json({
        success: false,
        message: `Password for ${user.role} must be at least ${minLength} characters long.`,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const hashPass = await argonLimiter.schedule(() => Argon.hash(newPassword));
    user.password = hashPass;
    user.isActivated = true;
    user.accountStatus = "active";

    if (roomNumber && roomNumber !== "null") {
      user.roomNumber = typeof roomNumber === "string" ? roomNumber.trim() : roomNumber;
    }

    // Role cannot be modified or escalated via activation
    await user.save();

    // Audit log for privileged account activations
    if (user.role !== "student") {
      try {
        const AuditLog = require("../models/auditLog.model");
        const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
        const userAgent = (req.headers["user-agent"] || "").slice(0, 512);

        await AuditLog.create({
          adminId: user._id,
          adminRegistrationNumber: user.registrationNumber,
          adminName: user.name || "Self-Activated Admin",
          action: "ACCOUNT_ACTIVATED",
          targetType: "USER",
          targetId: user._id.toString(),
          targetIdentifier: user.registrationNumber,
          outcome: "SUCCESS",
          summary: `${user.role.toUpperCase()} account ${user.registrationNumber} activated successfully by owner.`,
          details: { role: user.role, hostel: user.hostel },
          ip,
          userAgent,
        });
      } catch (logErr) {
        console.error("Failed to write activation audit log:", logErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Account activated successfully. You can now log in.",
      role: user.role,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to activate user.",
      error: error.message,
    });
  }
};

// ─── loggedInUser ─────────────────────────────────────────────────────────────
// POST /api/v1/users/login
const loggedInUser = async (req, res) => {
  try {
    const {
      registrationNumber,
      password,
      deviceNickname,
      installationId,
      pushToken,
      webPushSubscription,
      deviceTypeOverride,
    } = req.body;

    if (!registrationNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const user = await User.findOne({ registrationNumber });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 1. Account Status and Lockout Verification (SuperAdmin accounts are permanently exempt from lockout)
    if (user.accountStatus === "deactivated" || user.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message: "Account has been deactivated or suspended by an administrator.",
      });
    }

    if (user.role !== "superadmin" && user.lockUntil && user.lockUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockUntil - new Date()) / (60 * 1000));
      return res.status(429).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${waitMinutes} minute(s).`,
      });
    }

    if (user.isActivated === false) {
      return res.status(403).json({
        success: false,
        message: "Please activate your account first",
      });
    }

    // 2. Rate-limited Argon2 verification
    const isPasswordCorrect = await argonLimiter.schedule(() =>
      Argon.verify(user.password, password)
    );

    if (!isPasswordCorrect) {
      // SuperAdmin accounts are exempt from login lockouts
      if (user.role !== "superadmin") {
        const config = await SystemConfig.getEffectiveConfig();
        const maxAttempts = config.failedLoginThreshold || 5;
        const lockoutMinutes = config.lockoutDurationMinutes || 15;

        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= maxAttempts) {
          user.lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        }
        await user.save();
      }

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Reset failed login counter on successful authentication
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    // 3. Client & Device Metadata Extraction
    const userAgent = req.headers["user-agent"] || "";
    const parsed = parseClientInfo(userAgent);
    const finalDeviceType = deviceTypeOverride || parsed.deviceType;
    const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown IP";

    // 4. Enforce Configurable Concurrent Session & Device Limits
    const config = await SystemConfig.getEffectiveConfig();

    // Enforce maintenance mode on login for non-superadmin users
    if (user.role !== "superadmin") {
      const maintenance = config.maintenance || {};
      const globalMaint = maintenance.global || {};
      const selectiveMaint = maintenance.selective || {};

      // Precedence: Global maintenance takes precedence
      if (globalMaint.enabled) {
        return res.status(503).json({
          success: false,
          code: "MAINTENANCE_MODE_ACTIVE",
          message:
            globalMaint.message ||
            "HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.",
          maintenance: {
            mode: "global",
            title: globalMaint.title || "System Maintenance in Progress",
            message:
              globalMaint.message ||
              "HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.",
            plannedStart: globalMaint.plannedStart || null,
            plannedEnd: globalMaint.plannedEnd || null,
          },
        });
      }

      if (selectiveMaint.enabled) {
        const affectedRoles = Array.isArray(selectiveMaint.affectedRoles)
          ? selectiveMaint.affectedRoles
          : [];
        const affectedRegs = Array.isArray(selectiveMaint.affectedRegistrationNumbers)
          ? selectiveMaint.affectedRegistrationNumbers
          : [];

        if (affectedRoles.includes(user.role) || affectedRegs.includes(user.registrationNumber)) {
          return res.status(503).json({
            success: false,
            code: "MAINTENANCE_MODE_ACTIVE",
            message:
              selectiveMaint.message ||
              "Access for your account or user group is currently paused for scheduled system maintenance.",
            maintenance: {
              mode: "selective",
              title: selectiveMaint.title || "Service Temporarily Unavailable",
              message:
                selectiveMaint.message ||
                "Access for your account or user group is currently paused for scheduled system maintenance.",
              affectedRoles,
              affectedRegistrationNumbers: affectedRegs,
              plannedStart: selectiveMaint.plannedStart || null,
              plannedEnd: selectiveMaint.plannedEnd || null,
            },
          });
        }
      }
    }

    // 4. Enforce Configurable Concurrent Session & Device Limits
    // Super Admins are exempt from concurrent session limits to allow simultaneous multi-user / multi-device management
    const isSuperAdmin = user.role === "superadmin";

    // 4a. Same-Device session replacement:
    // If user is logging in again on the same device/browser installation, supersede previous session on that device
    // so repeated logins on the same device do NOT count against the concurrent device limit.
    if (!isSuperAdmin && installationId) {
      await Session.updateMany(
        { userId: user._id, installationId, status: "active" },
        { $set: { status: "expired", revokedAt: new Date(), revokedBy: "device_relogin" } }
      ).catch(() => {});
    }

    if (!isSuperAdmin) {
      // Per-user device limit override (maxDevices) takes precedence over system default
      const effectiveLimit =
        typeof user.maxDevices === "number" && user.maxDevices > 0
          ? user.maxDevices
          : config.maxConcurrentSessions;

      const activeSessions = await Session.find({
        userId: user._id,
        status: "active",
      }).sort({ lastActivityAt: 1 });

      if (activeSessions.length >= effectiveLimit) {
        if (config.revokeOldestOnLimit) {
          const excessCount = activeSessions.length - effectiveLimit + 1;
          const toRevoke = activeSessions.slice(0, excessCount);
          const revokeIds = toRevoke.map((s) => s._id);

          await Session.updateMany(
            { _id: { $in: revokeIds } },
            {
              $set: {
                status: "revoked",
                revokedAt: new Date(),
                revokedBy: "system_limit",
              },
            }
          );
        } else {
          return res.status(403).json({
            success: false,
            code: "SESSION_LIMIT_EXCEEDED",
            message: `Maximum concurrent session limit reached (${effectiveLimit}). Please log out from another device first.`,
          });
        }
      }
    }

    // 5. Create Persistent Session Record
    const sessionId = crypto.randomUUID();
    const timeoutMinutes = config.sessionInactivityTimeoutMinutes || 43200; // 30 days default
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    const newSession = await Session.create({
      sessionId,
      userId: user._id,
      registrationNumber: user.registrationNumber,
      deviceNickname: (deviceNickname || `${parsed.browser} on ${parsed.os}`).slice(0, 80),
      installationId: installationId || sessionId,
      deviceType: finalDeviceType,
      os: parsed.os,
      browser: parsed.browser,
      userAgent: userAgent.slice(0, 512),
      ip: clientIp,
      status: "active",
      expiresAt,
      pushToken: pushToken || null,
      webPushSubscription: webPushSubscription || null,
      pushProvider: pushToken ? "fcm" : webPushSubscription ? "webpush" : "none",
      pushRegisteredAt: pushToken || webPushSubscription ? new Date() : null,
      loginAt: new Date(),
      lastActivityAt: new Date(),
    });

    // 5b. Concurrency safety check: Ensure concurrent logins did not exceed effectiveLimit (skipped for superadmin)
    if (!isSuperAdmin && config.revokeOldestOnLimit) {
      const effectiveLimit =
        typeof user.maxDevices === "number" && user.maxDevices > 0
          ? user.maxDevices
          : config.maxConcurrentSessions;

      const postActiveSessions = await Session.find({
        userId: user._id,
        status: "active",
      }).sort({ lastActivityAt: 1, createdAt: 1 });

      if (postActiveSessions.length > effectiveLimit) {
        const concurrentExcess = postActiveSessions.length - effectiveLimit;
        const excessRevokeIds = postActiveSessions.slice(0, concurrentExcess).map((s) => s._id);
        await Session.updateMany(
          { _id: { $in: excessRevokeIds } },
          {
            $set: {
              status: "revoked",
              revokedAt: new Date(),
              revokedBy: "system_limit",
            },
          }
        );
      }
    }

    // 6. Sign JWT with embedded sessionId for immediate revocation enforcement
    const jwtLifespan = config.jwtLifespanDays ? `${config.jwtLifespanDays}d` : "90d";
    const token = jwt.sign(
      {
        id: user._id,
        sessionId: newSession.sessionId,
        name: user.name,
        registrationNumber: user.registrationNumber,
        role: user.role,
        hostel: user.hostel,
        roomNumber: user.roomNumber,
      },
      process.env.JWT_SECRET,
      { expiresIn: jwtLifespan }
    );

    // Track client IP to user identity for legacy app version check recognition
    recordClientIdentity(clientIp, user.registrationNumber);

    return res.status(200).json({
      success: true,
      message: "user logged in successfully",
      token,
      session: {
        sessionId: newSession.sessionId,
        deviceType: newSession.deviceType,
        deviceNickname: newSession.deviceNickname,
        expiresAt: newSession.expiresAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "due to system failure failed to login user",
      error: error.message,
    });
  }
};

// ─── getMySessions ────────────────────────────────────────────────────────────
// GET /api/v1/users/my-sessions
const getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id })
      .select("-pushToken -webPushSubscription")
      .sort({ lastActivityAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      currentSessionId: req.user.sessionId || null,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sessions",
      error: error.message,
    });
  }
};

// ─── revokeMySession ──────────────────────────────────────────────────────────
// DELETE /api/v1/users/my-sessions/:sessionId
const revokeMySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      sessionId,
      userId: req.user.id,
      status: "active",
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Active session not found or already revoked",
      });
    }

    session.status = "revoked";
    session.revokedAt = new Date();
    session.revokedBy = "user";
    await session.save();

    return res.status(200).json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to revoke session",
      error: error.message,
    });
  }
};

// ─── logoutUser ───────────────────────────────────────────────────────────────
// POST /api/v1/users/logout
const logoutUser = async (req, res) => {
  try {
    if (req.user && req.user.sessionId) {
      await Session.updateOne(
        { sessionId: req.user.sessionId, status: "active" },
        {
          $set: {
            status: "revoked",
            revokedAt: new Date(),
            revokedBy: "user",
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
};

// ─── registerPushToken ────────────────────────────────────────────────────────
// POST /api/v1/users/register-push-token
const registerPushToken = async (req, res) => {
  try {
    const { pushToken, webPushSubscription, provider = "fcm" } = req.body;

    if (!pushToken && !webPushSubscription) {
      return res.status(400).json({
        success: false,
        message: "pushToken or webPushSubscription is required",
      });
    }

    if (!req.user || !req.user.sessionId) {
      return res.status(400).json({
        success: false,
        message: "No active session associated with this token",
      });
    }

    const session = await Session.findOne({ sessionId: req.user.sessionId, status: "active" });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Active session not found",
      });
    }

    if (pushToken) {
      // Clear this FCM push token from other sessions to avoid multi-session duplication
      await Session.updateMany(
        { pushToken, _id: { $ne: session._id } },
        { $set: { pushToken: null, pushProvider: "none" } }
      ).catch(() => {});

      session.pushToken = pushToken;
      session.pushProvider = "fcm";
    }

    if (webPushSubscription) {
      session.webPushSubscription = webPushSubscription;
      session.pushProvider = "webpush";
    }

    session.pushRegisteredAt = new Date();
    await session.save();

    // ─── Permanent Device Vault (Layer 1) ───────────────────────────────────
    // Persist hardware device registration permanently, decoupled from session expiry
    try {
      const {
        deviceId: clientDeviceId,
        platform: clientPlatform,
        hardwareModel,
        appVersion,
      } = req.body;

      const fullUser = await User.findById(req.user._id).select("name registrationNumber hostelBlock roomNumber role").lean();

      // Compute stable hardware identifier
      const stableDeviceId =
        clientDeviceId ||
        (pushToken
          ? `android-${crypto.createHash("md5").update(pushToken).digest("hex").slice(0, 16)}`
          : webPushSubscription?.endpoint
          ? `web-${crypto.createHash("md5").update(webPushSubscription.endpoint).digest("hex").slice(0, 16)}`
          : `usr-${req.user._id}`);

      const detectedPlatform =
        clientPlatform ||
        (pushToken ? "android" : webPushSubscription ? "web" : "unknown");

      await DeviceRegistry.findOneAndUpdate(
        { deviceId: stableDeviceId },
        {
          $set: {
            deviceId: stableDeviceId,
            userId: req.user._id,
            userRole: fullUser?.role || req.user.role || "student",
            studentName: fullUser?.name || req.user.name || "",
            regNo: fullUser?.registrationNumber || req.user.registrationNumber || "",
            hostelBlock: fullUser?.hostelBlock || session.hostelBlock || "",
            roomNumber: fullUser?.roomNumber || session.roomNumber || "",
            pushToken: pushToken || null,
            pushProvider: pushToken ? "fcm" : webPushSubscription ? "webpush" : "none",
            platform: detectedPlatform,
            webPushSubscription: webPushSubscription || null,
            isActive: true,
            lastSeenAt: new Date(),
            appVersion: appVersion || "1.0.0",
            hardwareModel: hardwareModel || (detectedPlatform === "android" ? "Android Device" : "Browser WebPush"),
          },
        },
        { upsert: true, new: true }
      );
    } catch (vaultErr) {
      console.error("[DeviceRegistry] Vault upsert non-blocking error:", vaultErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Push notification token registered successfully in permanent hardware vault",
      provider: session.pushProvider,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to register push token",
      error: error.message,
    });
  }
};

module.exports = {
  activateUser,
  loggedInUser,
  getMySessions,
  revokeMySession,
  logoutUser,
  registerPushToken,
};