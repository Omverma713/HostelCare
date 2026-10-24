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

    const DEFAULT_SLOT_DEFAULTS = {
      breakfast: { name: "Breakfast", timing: "07:00 AM – 09:15 AM", startHour: 7, startMinute: 0, endHour: 9, endMinute: 15, dietary: "veg", items: [], options: [] },
      lunch:     { name: "Lunch", timing: "12:30 PM – 02:30 PM", startHour: 12, startMinute: 30, endHour: 14, endMinute: 30, dietary: "veg", items: [], options: [] },
      snacks:    { name: "Evening Snacks", timing: "05:45 PM – 07:30 PM", startHour: 17, startMinute: 45, endHour: 19, endMinute: 30, dietary: "veg", items: [], options: [] },
      dinner:    { name: "Dinner", timing: "08:30 PM – 10:00 PM", startHour: 20, startMinute: 30, endHour: 22, endMinute: 0, dietary: "veg", items: [], options: [] },
    };

    const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const day of validDays) {
      if (schedule[day]) {
        schedule[day].day = day;
        schedule[day].label = schedule[day].label || day.charAt(0).toUpperCase() + day.slice(1);
        if (!schedule[day].meals) {
          schedule[day].meals = {};
        }
        const meals = schedule[day].meals;
        for (const slot of ["breakfast", "lunch", "snacks", "dinner"]) {
          const fallback = DEFAULT_MESS_DATA.schedule?.[day]?.meals?.[slot] || DEFAULT_SLOT_DEFAULTS[slot];
          if (!meals[slot]) {
            meals[slot] = { ...fallback };
          } else {
            const m = meals[slot];
            m.name = m.name || fallback.name;
            m.timing = m.timing || fallback.timing;
            m.startHour = Number.isInteger(Number(m.startHour)) ? Number(m.startHour) : fallback.startHour;
            m.startMinute = Number.isInteger(Number(m.startMinute)) ? Number(m.startMinute) : fallback.startMinute;
            m.endHour = Number.isInteger(Number(m.endHour)) ? Number(m.endHour) : fallback.endHour;
            m.endMinute = Number.isInteger(Number(m.endMinute)) ? Number(m.endMinute) : fallback.endMinute;
            m.items = Array.isArray(m.items) ? m.items.map((s) => String(s).trim()).filter(Boolean) : (fallback.items || []);
            m.dietary = m.dietary || fallback.dietary || "veg";
            m.options = Array.isArray(m.options) ? m.options : (fallback.options || []);
            m.notes = typeof m.notes === "string" ? m.notes : (fallback.notes || "");
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
      menu.guidelines = guidelines.map((g) => String(g).trim()).filter(Boolean);
    }
    menu.schedule = schedule;
    menu.version = (menu.version || 1) + 1;
    menu.isPublished = true;
    menu.publishedAt = new Date();
    menu.lastUpdatedBy = {
      id: req.staffUser?._id || req.user?.id,
      registrationNumber: req.staffUser?.registrationNumber || req.user?.registrationNumber || "SUPERADMIN",
      name: req.staffUser?.name || req.user?.name || "Campus Administration",
      role: req.staffUser?.role || req.user?.role || "superadmin",
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
