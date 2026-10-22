const User = require("../models/user.model");

/**
 * Super Admin Role Verification Middleware
 * 
 * Ensures the requesting user has an authenticated session AND is verified
 * in the database as having the 'superadmin' role with an active account status.
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Super Admin access privileges required",
      });
    }

    // Server-side database verification to prevent stale JWT privilege escalation
    const dbUser = await User.findById(req.user.id).select("role accountStatus isActivated");

    if (!dbUser || dbUser.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Super Admin privileges are not assigned to this account",
      });
    }

    if (dbUser.accountStatus !== "active" || dbUser.isActivated === false) {
      return res.status(403).json({
        success: false,
        message: "Super Admin account is deactivated or suspended",
      });
    }

    req.superAdminUser = dbUser;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify Super Admin authorization",
      error: error.message,
    });
  }
};

module.exports = requireSuperAdmin;
