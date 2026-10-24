const MessMenu = require("../models/messMenu.model");
const AuditLog = require("../models/auditLog.model");
const { DEFAULT_MESS_DATA } = require("../constants/defaultMessMenu");

/**
 * Public Read-Only: Get current active published mess schedule
 * Accessible to students, staff, and unauthenticated guests.
 */
const getPublicMessMenu = async (req, res) => {
  try {
    const menu = await MessMenu.getActiveMenu();
    return res.status(200).json({
      success: true,
      menu,
    });
  } catch (error) {
    console.warn("[MESS_MENU] DB query error, serving bundled fallback:", error.message);
    // Graceful offline/error fallback with official bundled timetable
    return res.status(200).json({
      success: true,
      menu: DEFAULT_MESS_DATA,
      isFallback: true,
    });
  }
};

/**
 * Staff Protected: Update & Publish weekly mess menu
 * Allowed roles: superadmin, caretaker, warden, superintendent, chiefHostelWarden
 */
const updateMessMenu = async (req, res) => {
  try {
    const { title, season, hostel, schedule, guidelines } = req.body;

    if (!schedule || typeof schedule !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid menu payload: 'schedule' object is required.",
      });
    }

    const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const day of validDays) {
      if (schedule[day]) {
        const meals = schedule[day].meals;
        if (!meals) {
          return res.status(400).json({
            success: false,
            message: `Malformed schedule for ${day}: 'meals' are required.`,
          });
        }
        for (const slot of ["breakfast", "lunch", "snacks", "dinner"]) {
          if (meals[slot]) {
            const m = meals[slot];
            if (m.startHour < 0 || m.startHour > 23 || m.endHour < 0 || m.endHour > 23) {
              return res.status(400).json({
                success: false,
                message: `Invalid meal hours for ${day} ${slot}. Must be 0-23.`,
              });
            }
          }
        }
      }
    }

    let menu = await MessMenu.findOne({ key: "boys_hostel_default" });
    if (!menu) {
      menu = new MessMenu({ key: "boys_hostel_default" });
    }

    if (title) menu.title = String(title).trim();
    if (season) menu.season = String(season).trim();
    if (hostel) menu.hostel = String(hostel).trim();
    if (guidelines && Array.isArray(guidelines)) {
      menu.guidelines = guidelines.map(g => String(g).trim()).filter(Boolean);
    }
    menu.schedule = schedule;
    menu.version = (menu.version || 1) + 1;
    menu.isPublished = true;
    menu.publishedAt = new Date();
    menu.lastUpdatedBy = {
      id: req.staffUser._id,
      registrationNumber: req.staffUser.registrationNumber,
      name: req.staffUser.name,
      role: req.staffUser.role,
    };

    await menu.save();

    // Create Audit Log entry
    try {
      await AuditLog.create({
        adminId: req.staffUser._id,
        adminRegistrationNumber: req.staffUser.registrationNumber,
        adminName: req.staffUser.name || "Staff Member",
        action: "MESS_MENU_UPDATED",
        targetType: "MESS_MENU",
        targetId: menu._id.toString(),
        targetIdentifier: `v${menu.version} (${menu.season || "2026"})`,
        summary: `Mess menu v${menu.version} published by ${req.staffUser.role} ${req.staffUser.registrationNumber}`,
        details: {
          version: menu.version,
          updatedRole: req.staffUser.role,
          title: menu.title,
        },
      });
    } catch (auditErr) {
      console.warn("[AUDIT] Failed to record mess menu audit log:", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Mess menu published successfully!",
      menu,
    });
  } catch (error) {
    console.error("[MESS_MENU] Update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to publish mess menu changes.",
      error: error.message,
    });
  }
};

/**
 * Staff Protected: Reset Menu back to official verified 2026 timetable
 */
const resetMessMenuToDefault = async (req, res) => {
  try {
    let menu = await MessMenu.findOne({ key: "boys_hostel_default" });
    if (!menu) {
      menu = new MessMenu({ key: "boys_hostel_default" });
    }

    menu.title = DEFAULT_MESS_DATA.title;
    menu.season = DEFAULT_MESS_DATA.season;
    menu.hostel = DEFAULT_MESS_DATA.hostel;
    menu.schedule = DEFAULT_MESS_DATA.schedule;
    menu.guidelines = DEFAULT_MESS_DATA.guidelines;
    menu.version = (menu.version || 1) + 1;
    menu.isPublished = true;
    menu.publishedAt = new Date();
    menu.lastUpdatedBy = {
      id: req.staffUser._id,
      registrationNumber: req.staffUser.registrationNumber,
      name: req.staffUser.name,
      role: req.staffUser.role,
    };

    await menu.save();

    // Audit Log
    try {
      await AuditLog.create({
        adminId: req.staffUser._id,
        adminRegistrationNumber: req.staffUser.registrationNumber,
        adminName: req.staffUser.name || "Staff Member",
        action: "MESS_MENU_RESET",
        targetType: "MESS_MENU",
        targetId: menu._id.toString(),
        targetIdentifier: `v${menu.version} (Reset to Official 2026 Default)`,
        summary: `Mess menu reset to official 2026 timetable by ${req.staffUser.role} ${req.staffUser.registrationNumber}`,
        details: {
          version: menu.version,
          resetByRole: req.staffUser.role,
        },
      });
    } catch (auditErr) {
      console.warn("[AUDIT] Mess menu reset log error:", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Mess menu restored to official 2026 timetable.",
      menu,
    });
  } catch (error) {
    console.error("[MESS_MENU] Reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset mess menu.",
      error: error.message,
    });
  }
};

module.exports = {
  getPublicMessMenu,
  updateMessMenu,
  resetMessMenuToDefault,
};
