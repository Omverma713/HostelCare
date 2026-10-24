const User = require("../models/user.model");

// The 4 authorized staff roles explicitly granted mess management authority:
// 1. Super Admin
// 2. Caretaker
// 3. Warden
// 4. Superintendent
// (+ chiefHostelWarden)
const AUTHORIZED_MESS_ROLES = [
  "superadmin",
  "caretaker",
  "warden",
  "superintendent",
  "chiefHostelWarden",
];

/**
 * Middleware that strictly verifies user has active staff privileges to modify mess menu.
 * Rejects students, guests, or unauthorized roles.
 */
const requireMessStaff = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to modify mess menu",
      });
    }

    if (!AUTHORIZED_MESS_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Only authorized staff (Super Admin, Caretaker, Warden, Superintendent) can manage the mess menu.",
      });
    }

    // Server-side DB verification to prevent stale JWT privilege escalation
    const dbUser = await User.findById(req.user.id).select(
      "role accountStatus isActivated name registrationNumber"
    );

    if (!dbUser || !AUTHORIZED_MESS_ROLES.includes(dbUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Verified staff permissions required to update mess menu.",
      });
    }

    if (dbUser.accountStatus === "deactivated" || dbUser.accountStatus === "suspended" || dbUser.isActivated === false) {
      return res.status(403).json({
        success: false,
        message: "Staff account is suspended or inactive.",
      });
    }

    req.staffUser = dbUser;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify mess staff authorization",
      error: error.message,
    });
  }
};

module.exports = {
  requireMessStaff,
  AUTHORIZED_MESS_ROLES,
};
