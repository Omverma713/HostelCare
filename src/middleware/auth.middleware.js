const jwt = require("jsonwebtoken");
const Session = require("../models/session.model");
const User = require("../models/user.model");

/**
 * Authentication Middleware with Real-Time Session Validation & Revocation Check
 * 
 * 1. Validates JWT signature and expiration.
 * 2. If token contains a `sessionId`, validates active session state in MongoDB.
 * 3. Enforces user-level revocation (`sessionsRevokedAt`) and account status.
 * 4. Throttles `lastActivityAt` updates to maintain database performance.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 1. Check if token contains a sessionId (session-aware token)
    if (decoded.sessionId) {
      const session = await Session.findOne({ sessionId: decoded.sessionId });

      if (!session || session.status !== "active") {
        return res.status(401).json({
          success: false,
          code: "SESSION_REVOKED",
          message: "Session has been revoked or expired. Please log in again.",
        });
      }

      // Check session expiration
      if (session.expiresAt && new Date() > session.expiresAt) {
        session.status = "expired";
        await session.save();
        return res.status(401).json({
          success: false,
          code: "SESSION_EXPIRED",
          message: "Session has expired. Please log in again.",
        });
      }

      // Update lastActivityAt and slide session expiresAt forward once every 60 seconds
      const now = Date.now();
      if (!session.lastActivityAt || now - new Date(session.lastActivityAt).getTime() > 60_000) {
        // Slide session expiration forward 30 days so active users are never logged out
        const slideMs = 30 * 24 * 60 * 60 * 1000;
        const newExpiresAt = new Date(now + slideMs);
        Session.updateOne(
          { _id: session._id },
          { $set: { lastActivityAt: new Date(), expiresAt: newExpiresAt } }
        ).catch((err) =>
          console.error("Failed to update session activity:", err.message)
        );
      }

      req.session = session;
    }

    // 2. Fast check for account deactivation or global force-logout
    if (decoded.id) {
      const userDoc = await User.findById(decoded.id).select(
        "accountStatus isActivated sessionsRevokedAt role"
      );

      if (!userDoc) {
        return res.status(401).json({
          success: false,
          message: "User account no longer exists",
        });
      }

      if (userDoc.accountStatus === "deactivated" || userDoc.accountStatus === "suspended") {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_SUSPENDED",
          message: "Account has been deactivated or suspended by an administrator.",
        });
      }

      // Check if global force logout occurred after this token was issued
      if (userDoc.sessionsRevokedAt && decoded.iat) {
        const tokenIssuedAt = decoded.iat * 1000;
        if (tokenIssuedAt < new Date(userDoc.sessionsRevokedAt).getTime()) {
          return res.status(401).json({
            success: false,
            code: "SESSION_REVOKED",
            message: "All sessions have been revoked by an administrator. Please log in again.",
          });
        }
      }

      // Keep role synced in case of administrative update
      decoded.role = userDoc.role;
    }

    req.user = decoded;

    // 3. Enforce maintenance mode on active sessions (non-superadmins only)
    if (decoded.role !== "superadmin") {
      const SystemConfig = require("../models/systemConfig.model");
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

        const isRoleAffected = affectedRoles.includes(decoded.role);
        const isRegAffected = affectedRegs.includes(decoded.registrationNumber);

        if (isRoleAffected || isRegAffected) {
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

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Failed to authenticate user",
      error: error.message,
    });
  }
};

module.exports = authMiddleware;