const User = require("../models/user.model");
const Session = require("../models/session.model");
const DeviceRegistry = require("../models/deviceRegistry.model");
const SystemConfig = require("../models/systemConfig.model");
const Argon = require("argon2");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const argonLimiter = require("../../utils/argonLimiter");
const { recordClientIdentity } = require("../utils/clientTracker");
const { sendPasswordResetEmail } = require("../utils/mailer");

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
    const isDelegated = Boolean(
      user.isDelegatedSubAdmin &&
      user.delegatedRole === "superadmin" &&
      (user.delegationIndefinite || (user.delegationExpiresAt && new Date(user.delegationExpiresAt) > new Date()))
    );

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
        isDelegatedSubAdmin: isDelegated,
        delegationTitle: isDelegated ? user.delegationTitle : undefined,
        delegationScopes: isDelegated ? user.delegationScopes : undefined,
        delegationExpiresAt: isDelegated ? user.delegationExpiresAt : undefined,
        delegationIndefinite: isDelegated ? user.delegationIndefinite : undefined,
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

      const effectiveUserId = req.user.id || req.user._id;
      const fullUser = await User.findById(effectiveUserId).select("name registrationNumber hostelBlock roomNumber role").lean();

      // Compute stable hardware identifier
      const stableDeviceId =
        clientDeviceId ||
        (pushToken
          ? `android-${crypto.createHash("md5").update(pushToken).digest("hex").slice(0, 16)}`
          : webPushSubscription?.endpoint
          ? `web-${crypto.createHash("md5").update(webPushSubscription.endpoint).digest("hex").slice(0, 16)}`
          : `usr-${effectiveUserId}`);

      const detectedPlatform =
        clientPlatform ||
        (pushToken ? "android" : webPushSubscription ? "web" : "unknown");

      await DeviceRegistry.findOneAndUpdate(
        { deviceId: stableDeviceId },
        {
          $set: {
            deviceId: stableDeviceId,
            userId: effectiveUserId,
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

      // Auto-Clean: Deactivate any other older device registrations for this same user on this platform
      // so reinstallations and token rotations never leave phantom dead tokens behind
      if (pushToken) {
        await DeviceRegistry.updateMany(
          {
            userId: effectiveUserId,
            deviceId: { $ne: stableDeviceId },
            platform: detectedPlatform,
            isActive: true,
          },
          {
            $set: {
              isActive: false,
              "metadata.cleanedReason": "superseded_by_newer_device_token",
              "metadata.cleanedAt": new Date(),
            },
          }
        ).catch(() => {});
      }
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

/**
 * Verify user's current account password
 * Used for sensitive security actions (e.g., enabling Biometric Fingerprint Lock)
 */
const verifyUserPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const isValid = await Argon.verify(user.password, String(password));
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Incorrect account password" });
    }
    return res.status(200).json({ success: true, message: "Password verified successfully" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Password verification error",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/users/test-my-device
 * Allows student/user to instantly trigger a test push notification to their own current phone
 */
const testMyDevice = async (req, res) => {
  try {
    const { slotKey = "snacks", targetDay, customTitle, customBody } = req.body;
    const userId = req.user._id;
    const { broadcastMealReminder } = require("../services/messReminderScheduler");

    const simDay = (targetDay || "").toLowerCase();
    const dayLabel = simDay ? simDay.charAt(0).toUpperCase() + simDay.slice(1) : "Today";

    if (slotKey === "all" || slotKey === "full_day") {
      const slots = ["breakfast", "lunch", "snacks", "dinner"];
      const selfResults = {};
      for (const slot of slots) {
        selfResults[slot] = await broadcastMealReminder(slot, {
          isManualTest: true,
          isTest: true,
          targetDay: simDay || undefined,
          targetUserId: userId,
        });
        await new Promise((r) => setTimeout(r, 800));
      }
      return res.status(200).json({
        success: true,
        message: `Full-day 4-meal cycle for ${dayLabel} delivered to your device!`,
        simulatedDay: dayLabel,
        results: selfResults,
      });
    }

    const result = await broadcastMealReminder(slotKey, {
      isManualTest: true,
      isTest: true,
      targetDay: simDay || undefined,
      targetUserId: userId,
      customTitle: customTitle || `📱 Self Test Alert: ${dayLabel} ${slotKey.toUpperCase()}`,
      customBody: customBody,
    });

    return res.status(200).json({
      success: true,
      message: `Test push notification for ${dayLabel} ${slotKey.toUpperCase()} dispatched to your registered device`,
      simulatedDay: dayLabel,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send test push to device",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/users/my-room
 * Returns dynamic room allocation, roommates, and warden/caretaker contacts
 */
const getMyRoomInfo = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const currentUser = await User.findById(userId).select("name registrationNumber hostel roomNumber email role");
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hostel = (currentUser.hostel || "").trim();
    const roomNumber = (currentUser.roomNumber || "").trim();

    let roommates = [];
    let warden = null;
    let caretaker = null;

    if (hostel && roomNumber) {
      roommates = await User.find(
        {
          hostel: { $regex: new RegExp(`^${hostel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
          roomNumber: { $regex: new RegExp(`^${roomNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
          _id: { $ne: currentUser._id },
          accountStatus: "active",
        },
        "name registrationNumber email"
      ).lean();
    }

    if (hostel) {
      warden = await User.findOne(
        {
          hostel: { $regex: new RegExp(`^${hostel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
          role: "warden",
          accountStatus: "active",
        },
        "name email"
      ).lean();

      caretaker = await User.findOne(
        {
          hostel: { $regex: new RegExp(`^${hostel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
          role: "caretaker",
          accountStatus: "active",
        },
        "name email"
      ).lean();
    }

    return res.status(200).json({
      success: true,
      user: {
        name: currentUser.name,
        registrationNumber: currentUser.registrationNumber,
        hostel: currentUser.hostel,
        roomNumber: currentUser.roomNumber,
      },
      roommates: roommates.map((r) => ({
        name: r.name,
        registrationNumber: r.registrationNumber,
        email: r.email,
      })),
      warden: warden ? { name: warden.name, contact: warden.email } : null,
      caretaker: caretaker ? { name: caretaker.name, contact: caretaker.email } : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room details",
      error: error.message,
    });
  }
};

// ─── forgotPassword ─────────────────────────────────────────────────────────
// POST /api/v1/users/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { registrationNumber, isResend = false, resendType = "otp" } = req.body;
    const cleanReg = typeof registrationNumber === "string" ? registrationNumber.trim().toUpperCase() : "";

    if (!cleanReg) {
      return res.status(400).json({ success: false, message: "Registration number is required." });
    }

    const user = await User.findOne({
      registrationNumber: { $regex: new RegExp(`^${cleanReg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).select("+resetPasswordOtp +resetPasswordToken +resetPasswordExpiresAt +password");

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this Registration Number." });
    }

    if (user.accountStatus === "deactivated" || user.accountStatus === "suspended") {
      return res.status(403).json({ success: false, message: "This account has been deactivated or suspended. Please contact Warden." });
    }

    // Check if user has no email in database
    if (!user.email || !user.email.trim()) {
      return res.status(200).json({
        success: false,
        code: "NO_EMAIL_LINKED",
        requiresCampusVerification: true,
        message: "No email is linked to this account yet. Please verify your hostel & room to link your email.",
      });
    }

    // ENFORCE STRICT RESEND LIMIT (MAX 2 RESENDS ALLOWED)
    if (isResend) {
      if ((user.resetPasswordResendCount || 0) >= 2) {
        if (!user.resetPasswordHistory) user.resetPasswordHistory = [];
        user.resetPasswordHistory.push({
          action: "blocked",
          email: user.email,
          timestamp: new Date(),
          ip: req.ip || req.headers["x-forwarded-for"] || "Unknown IP",
          note: "Resend limit exceeded (Max 2 resends)",
        });
        await user.save();

        return res.status(429).json({
          success: false,
          code: "RESEND_LIMIT_EXCEEDED",
          resendsRemaining: 0,
          resendCount: user.resetPasswordResendCount,
          message: "Resend limit exceeded (Max 2 resends). Please visit the Hostel Administration Office to reset your passcode.",
        });
      }
      user.resetPasswordResendCount = (user.resetPasswordResendCount || 0) + 1;
    } else {
      // If initial request and already blocked from previous attempts without admin reset
      if ((user.resetPasswordResendCount || 0) >= 2) {
        return res.status(429).json({
          success: false,
          code: "RESEND_LIMIT_EXCEEDED",
          resendsRemaining: 0,
          resendCount: user.resetPasswordResendCount,
          message: "Account recovery limit exceeded. Please visit the Hostel Administration Office to reset your passcode.",
        });
      }
      user.resetPasswordResendCount = 0;
    }

    // Generate 6-digit OTP & 32-byte secure token
    const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    const rawToken = crypto.randomBytes(24).toString("hex");

    const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.resetPasswordAttempts = 0;
    user.pendingResetEmail = null;

    if (!user.resetPasswordHistory) user.resetPasswordHistory = [];
    user.resetPasswordHistory.push({
      action: isResend ? (resendType === "link" ? "resend_link" : "resend_otp") : "requested",
      email: user.email,
      timestamp: new Date(),
      ip: req.ip || req.headers["x-forwarded-for"] || "Unknown IP",
      note: isResend ? `Resend attempt ${user.resetPasswordResendCount}/2 (${resendType})` : "Initial password reset request",
    });

    await user.save();

    const baseUrl = process.env.FRONTEND_URL || "https://hostelcare.omverma-dev.workers.dev";
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}&reg=${encodeURIComponent(user.registrationNumber)}`;

    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        name: user.name,
        registrationNumber: user.registrationNumber,
        otp: rawOtp,
        resetLink,
      });
    } catch (mailErr) {
      console.error("[FORGOT_PASSWORD_EMAIL_ERROR]", mailErr.message);

      if (mailErr.code === "BREVO_DAILY_QUOTA_EXCEEDED") {
        return res.status(429).json({
          success: false,
          code: "BREVO_DAILY_QUOTA_EXCEEDED",
          message: "Daily email quota reached (300 limit). Please visit the Hostel Administration Office for immediate passcode reset.",
        });
      }

      if (mailErr.code === "BREVO_IP_UNAUTHORISED") {
        return res.status(503).json({
          success: false,
          code: "BREVO_IP_UNAUTHORISED",
          message: "Email service IP restriction active. Please contact administration.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to dispatch reset email via Brevo. Please check mail service or try again later.",
      });
    }

    const maskedEmail = user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${"*".repeat(Math.max(2, Math.min(b.length, 5)))}${c}`);
    const resendsRemaining = Math.max(0, 2 - (user.resetPasswordResendCount || 0));

    return res.status(200).json({
      success: true,
      message: `Password reset instructions sent to ${maskedEmail}`,
      maskedEmail,
      resendCount: user.resetPasswordResendCount || 0,
      resendsRemaining,
    });
  } catch (err) {
    console.error("[FORGOT_PASSWORD_ERROR]", err);
    return res.status(500).json({ success: false, message: "Internal server error during password reset request." });
  }
};

// ─── forgotPasswordWithCampusVerification ──────────────────────────────────
// POST /api/v1/users/forgot-password/verify-campus
const forgotPasswordWithCampusVerification = async (req, res) => {
  try {
    const { registrationNumber, hostel, roomNumber, newEmail } = req.body;
    const cleanReg = typeof registrationNumber === "string" ? registrationNumber.trim().toUpperCase() : "";
    const cleanHostel = typeof hostel === "string" ? hostel.trim() : "";
    const cleanRoom = typeof roomNumber === "string" ? roomNumber.trim() : "";
    const cleanEmail = typeof newEmail === "string" ? newEmail.trim().toLowerCase() : "";

    if (!cleanReg || !cleanHostel || !cleanRoom || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Registration number, hostel, room number, and email are all required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const user = await User.findOne({
      registrationNumber: { $regex: new RegExp(`^${cleanReg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).select("+resetPasswordOtp +resetPasswordToken +resetPasswordExpiresAt +password");

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this Registration Number." });
    }

    // Verify hostel & room match registered records
    const userHostel = String(user.hostel || "").trim().toLowerCase();
    const userRoom = String(user.roomNumber || "").trim().toLowerCase();

    if (userHostel !== cleanHostel.toLowerCase() || userRoom !== cleanRoom.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Hostel or Room Number does not match resident records for this registration number.",
      });
    }

    // Generate 6-digit OTP & 32-byte secure token
    const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    const rawToken = crypto.randomBytes(24).toString("hex");

    const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.resetPasswordAttempts = 0;
    user.resetPasswordResendCount = 0;
    user.pendingResetEmail = cleanEmail;

    if (!user.resetPasswordHistory) user.resetPasswordHistory = [];
    user.resetPasswordHistory.push({
      action: "requested",
      email: cleanEmail,
      timestamp: new Date(),
      ip: req.ip || req.headers["x-forwarded-for"] || "Unknown IP",
      note: "Campus verification initiated with new email",
    });

    await user.save();

    const baseUrl = process.env.FRONTEND_URL || "https://hostelcare.omverma-dev.workers.dev";
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}&reg=${encodeURIComponent(user.registrationNumber)}`;

    try {
      await sendPasswordResetEmail({
        toEmail: cleanEmail,
        name: user.name,
        registrationNumber: user.registrationNumber,
        otp: rawOtp,
        resetLink,
      });
    } catch (mailErr) {
      console.error("[CAMPUS_VERIFICATION_EMAIL_ERROR]", mailErr.message);

      if (mailErr.code === "BREVO_DAILY_QUOTA_EXCEEDED") {
        return res.status(429).json({
          success: false,
          code: "BREVO_DAILY_QUOTA_EXCEEDED",
          message: "Daily email quota reached (300 limit). Please visit the Hostel Administration Office for immediate passcode reset.",
        });
      }

      if (mailErr.code === "BREVO_IP_UNAUTHORISED") {
        return res.status(503).json({
          success: false,
          code: "BREVO_IP_UNAUTHORISED",
          message: "Email service IP restriction active. Please contact administration.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to dispatch verification email via Brevo. Please check email address or try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Campus verification successful! Reset OTP & link sent to ${cleanEmail}`,
      maskedEmail: cleanEmail,
      resendCount: 0,
      resendsRemaining: 2,
    });
  } catch (err) {
    console.error("[CAMPUS_VERIFICATION_ERROR]", err);
    return res.status(500).json({ success: false, message: "Internal server error during campus verification." });
  }
};

// ─── verifyResetOtp ─────────────────────────────────────────────────────────
// POST /api/v1/users/verify-reset-otp
const verifyResetOtp = async (req, res) => {
  try {
    const { registrationNumber, otp } = req.body;
    const cleanReg = typeof registrationNumber === "string" ? registrationNumber.trim().toUpperCase() : "";
    const cleanOtp = typeof otp === "string" ? otp.trim() : "";

    if (!cleanReg || !cleanOtp) {
      return res.status(400).json({ success: false, message: "Registration number and 6-digit OTP are required." });
    }

    const user = await User.findOne({
      registrationNumber: { $regex: new RegExp(`^${cleanReg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).select("+resetPasswordOtp +resetPasswordExpiresAt");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.resetPasswordOtp || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Reset code has expired. Please request a new one." });
    }

    if (user.resetPasswordAttempts >= 5) {
      user.resetPasswordOtp = null;
      user.resetPasswordExpiresAt = null;
      await user.save();
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new reset code." });
    }

    const hashedInputOtp = crypto.createHash("sha256").update(cleanOtp).digest("hex");

    if (hashedInputOtp !== user.resetPasswordOtp) {
      user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP code. (${5 - user.resetPasswordAttempts} attempts remaining)`,
      });
    }

    // Generate short-lived reset authorization token (valid 10 mins)
    const resetAuthToken = jwt.sign(
      { registrationNumber: user.registrationNumber, purpose: "password_reset" },
      process.env.JWT_SECRET || "hc_fallback_secret",
      { expiresIn: "10m" }
    );

    if (!user.resetPasswordHistory) user.resetPasswordHistory = [];
    user.resetPasswordHistory.push({
      action: "otp_verified",
      email: user.email,
      timestamp: new Date(),
      ip: req.ip || req.headers["x-forwarded-for"] || "Unknown IP",
      note: "6-digit OTP code successfully verified",
    });
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now set your new password.",
      resetAuthToken,
    });
  } catch (err) {
    console.error("[VERIFY_RESET_OTP_ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to verify reset OTP." });
  }
};

// ─── resetPassword ─────────────────────────────────────────────────────────
// POST /api/v1/users/reset-password
const resetPassword = async (req, res) => {
  try {
    const { registrationNumber, token, resetAuthToken, newPassword, confirmPassword } = req.body;
    const cleanReg = typeof registrationNumber === "string" ? registrationNumber.trim().toUpperCase() : "";

    if (!cleanReg) {
      return res.status(400).json({ success: false, message: "Registration number is required." });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    let isAuthorized = false;

    // Method 1: Verified OTP session token
    if (resetAuthToken) {
      try {
        const decoded = jwt.verify(resetAuthToken, process.env.JWT_SECRET || "hc_fallback_secret");
        if (decoded.purpose === "password_reset" && decoded.registrationNumber.toUpperCase() === cleanReg) {
          isAuthorized = true;
        }
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: "Reset authorization has expired. Please verify OTP again." });
      }
    }

    const user = await User.findOne({
      registrationNumber: { $regex: new RegExp(`^${cleanReg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).select("+resetPasswordOtp +resetPasswordToken +resetPasswordExpiresAt +password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Method 2: Direct 1-Click Link Token
    if (!isAuthorized && token) {
      const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");
      if (user.resetPasswordToken && user.resetPasswordToken === hashedToken) {
        if (user.resetPasswordExpiresAt && user.resetPasswordExpiresAt > new Date()) {
          isAuthorized = true;
        } else {
          return res.status(400).json({ success: false, message: "Reset link has expired. Please request a new one." });
        }
      }
    }

    if (!isAuthorized) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset credentials." });
    }

    // Hash new password with Argon2
    const hashedPassword = await argonLimiter(() =>
      Argon.hash(newPassword, {
        type: Argon.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      })
    );

    user.password = hashedPassword;
    user.isActivated = true;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.sessionsRevokedAt = new Date();

    // If student verified a pending email during campus recovery, link it permanently!
    if (user.pendingResetEmail) {
      user.email = user.pendingResetEmail;
      user.pendingResetEmail = null;
    }

    // Clear reset credentials and reset resend count on successful password change
    user.resetPasswordOtp = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    user.resetPasswordAttempts = 0;
    user.resetPasswordResendCount = 0;
    user.lastPasswordResetAt = new Date();

    if (!user.resetPasswordHistory) user.resetPasswordHistory = [];
    user.resetPasswordHistory.push({
      action: "completed",
      email: user.email,
      timestamp: new Date(),
      ip: req.ip || req.headers["x-forwarded-for"] || "Unknown IP",
      note: isAuthorized && token ? "Completed via 1-Click Email Link" : "Completed via OTP verification",
    });

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully! You can now log in with your new passcode.",
    });
  } catch (err) {
    console.error("[RESET_PASSWORD_ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to reset password." });
  }
};

// ─── changePassword (When Old Password is Known) ───────────────────────────
// POST /api/v1/users/change-password
const changePassword = async (req, res) => {
  try {
    const { registrationNumber, oldPassword, newPassword, confirmPassword } = req.body;
    const cleanReg = typeof registrationNumber === "string" ? registrationNumber.trim().toUpperCase() : "";

    if (!cleanReg || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Registration number, current password, and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match." });
    }

    const user = await User.findOne({
      registrationNumber: { $regex: new RegExp(`^${cleanReg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).select("+password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.accountStatus === "deactivated" || user.accountStatus === "suspended") {
      return res.status(403).json({ success: false, message: "This account has been deactivated or suspended." });
    }

    // Verify old password
    const isOldMatch = await argonLimiter(() => Argon.verify(user.password, oldPassword));
    if (!isOldMatch) {
      return res.status(400).json({ success: false, message: "Incorrect current passcode. Please try again." });
    }

    // Hash new password
    const hashedPassword = await argonLimiter(() =>
      Argon.hash(newPassword, {
        type: Argon.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      })
    );

    user.password = hashedPassword;
    user.sessionsRevokedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Passcode changed successfully! Please log in with your new passcode.",
    });
  } catch (err) {
    console.error("[CHANGE_PASSWORD_ERROR]", err);
    return res.status(500).json({ success: false, message: "Failed to change passcode." });
  }
};

module.exports = {
  activateUser,
  loggedInUser,
  getMySessions,
  revokeMySession,
  logoutUser,
  registerPushToken,
  verifyUserPassword,
  testMyDevice,
  getMyRoomInfo,
  forgotPassword,
  forgotPasswordWithCampusVerification,
  verifyResetOtp,
  resetPassword,
  changePassword,
};