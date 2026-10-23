const jwt = require("jsonwebtoken");
const SystemConfig = require("../models/systemConfig.model");

/**
 * Maintenance Mode Middleware
 * 
 * Enforces two distinct maintenance modes:
 * Mode 1: Global Maintenance - HostelCare is unavailable to normal users; Super Admin retains access.
 * Mode 2: Selective / Role-Based Maintenance - Restricts specific roles or registration numbers; unaffected users continue.
 * Precedence Rule: If both are enabled, Global Maintenance strictly takes precedence.
 * 
 * Safe Recovery Path:
 * - /health and /api/v1/maintenance/status are always open.
 * - /api/v1/superadmin/* routes are always accessible to authenticated Super Admins.
 * - Login (/api/v1/users/login) passes through to verify credentials: Super Admin can log in; affected normal users receive 503.
 */
const maintenanceMiddleware = async (req, res, next) => {
  // 1. Skip preflight CORS requests
  if (req.method === "OPTIONS") {
    return next();
  }

  const path = req.path || req.originalUrl || "";

  // 2. Unrestricted paths for infrastructure, status checks, and Super Admin portal APIs
  if (
    path === "/health" ||
    path === "/api/v1/maintenance/status" ||
    path.startsWith("/api/v1/app-version") ||
    path.startsWith("/api/v1/superadmin")
  ) {
    return next();
  }

  // 3. User login and activation are inspected in user.controllers.js so Super Admin
  // can authenticate without an authentication bypass.
  if (path === "/api/v1/users/login" || path === "/api/v1/users/activate") {
    return next();
  }

  try {
    const config = await SystemConfig.getEffectiveConfig();
    const maintenance = config.maintenance || {};
    const globalMaint = maintenance.global || {};
    const selectiveMaint = maintenance.selective || {};

    const isGlobalActive = Boolean(globalMaint.enabled);
    const isSelectiveActive = Boolean(selectiveMaint.enabled);

    // If neither mode is active, proceed immediately
    if (!isGlobalActive && !isSelectiveActive) {
      return next();
    }

    // Helper to decode token safely if present in Authorization header
    let decodedUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && process.env.JWT_SECRET) {
        try {
          decodedUser = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decodedUser;
        } catch {
          // Token invalid or expired; leave decodedUser as null
        }
      }
    }

    // 4. Super Admin is always exempt from both maintenance modes
    if (decodedUser && decodedUser.role === "superadmin") {
      return next();
    }

    // 5. Precedence: Global Maintenance takes precedence over Selective Maintenance
    if (isGlobalActive) {
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

    // 6. Selective Maintenance Enforcement
    if (isSelectiveActive) {
      const affectedRoles = Array.isArray(selectiveMaint.affectedRoles)
        ? selectiveMaint.affectedRoles
        : [];
      const affectedRegs = Array.isArray(selectiveMaint.affectedRegistrationNumbers)
        ? selectiveMaint.affectedRegistrationNumbers
        : [];

      // If user is authenticated, check role and registration number
      if (decodedUser) {
        const isRoleAffected = affectedRoles.includes(decodedUser.role);
        const isRegAffected = affectedRegs.includes(decodedUser.registrationNumber);

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

      // If user is not affected by selective maintenance, proceed
      return next();
    }

    return next();
  } catch (err) {
    console.error("Maintenance middleware error:", err.message);
    return next(); // Fail-safe: don't crash the server on config read error
  }
};

module.exports = maintenanceMiddleware;
