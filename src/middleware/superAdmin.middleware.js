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

    // Server-side database verification to prevent stale JWT privilege escalation
    const dbUser = await User.findById(req.user.id);

    if (!dbUser) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: User account not found",
      });
    }

    if (dbUser.accountStatus !== "active" || dbUser.isActivated === false) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated or suspended",
      });
    }

    // 1. Permanent Super Admin Check
    if (dbUser.role === "superadmin") {
      req.superAdminUser = dbUser;
      req.isDelegatedSubAdmin = false;
      return next();
    }

    // 2. Active Temporary Sub-Admin Delegation Check
    if (dbUser.isDelegatedSubAdmin && dbUser.delegatedRole === "superadmin") {
      const isIndefinite = Boolean(dbUser.delegationIndefinite);
      const isTimeValid = isIndefinite || (dbUser.delegationExpiresAt && new Date(dbUser.delegationExpiresAt) > new Date());

      if (isTimeValid) {
        req.superAdminUser = dbUser;
        req.isDelegatedSubAdmin = true;
        req.delegationScopes = dbUser.delegationScopes || ["all"];
        req.delegationTitle = dbUser.delegationTitle || "Acting Sub-Admin";
        return next();
      } else {
        // Automatically cleanup expired delegation
        dbUser.isDelegatedSubAdmin = false;
        dbUser.delegatedRole = null;
        await dbUser.save();
        try {
          const Delegation = require("../models/delegation.model");
          if (dbUser.delegationId) {
            await Delegation.findByIdAndUpdate(dbUser.delegationId, { status: "expired" });
          }
        } catch (_) {}
      }
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden: Super Admin access privileges required",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify Super Admin authorization",
      error: error.message,
    });
  }
};

module.exports = requireSuperAdmin;
