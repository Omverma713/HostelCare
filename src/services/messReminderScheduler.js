/**
 * messReminderScheduler.js
 * 
 * Server-side autonomous cron / heartbeat scheduler for Mess Menu meal start alerts.
 * Continuously evaluates Kolkata Time (Asia/Kolkata).
 * When Breakfast, Lunch, Snacks, or Dinner start timing matches:
 *  - Formats rich push notification payload with current menu items
 *  - Dispatches multi-channel push (FCM + WebPush) to all active registered devices
 *  - Deduplicates per date & slot to avoid multiple broadcasts
 */

const { sendPushToSessions } = require("./pushService");
const { DEFAULT_MESS_DATA } = require("../constants/defaultMessMenu");

// Map of slot keys to display names & icons
const SLOT_METADATA = {
  breakfast: { title: "🌅 Breakfast is starting now!", icon: "🌅" },
  lunch:     { title: "☀️ Lunch is now being served!", icon: "☀️" },
  snacks:    { title: "☕ Evening Snacks is starting now!", icon: "☕" },
  dinner:    { title: "🌙 Dinner is now being served!", icon: "🌙" },
};

// Official start hours and minutes in IST
const OFFICIAL_START_TIMINGS = {
  working: {
    breakfast: { hour: 7,  minute: 0,  timing: "07:00 AM – 09:15 AM" },
    lunch:     { hour: 12, minute: 30, timing: "12:30 PM – 02:30 PM" },
    snacks:    { hour: 17, minute: 45, timing: "05:45 PM – 07:30 PM" },
    dinner:    { hour: 20, minute: 30, timing: "08:30 PM – 10:00 PM" },
  },
  sundayAndHolidays: {
    breakfast: { hour: 8,  minute: 0,  timing: "08:00 AM – 10:00 AM" },
    lunch:     { hour: 12, minute: 30, timing: "12:30 PM – 02:30 PM" },
    snacks:    { hour: 17, minute: 30, timing: "05:30 PM – 07:00 PM" },
    dinner:    { hour: 20, minute: 30, timing: "08:30 PM – 10:00 PM" },
  },
};

// In-memory set of already fired meal alerts (key format: "YYYY-MM-DD_slotKey_alertN")
const firedBroadcastsToday = new Set();
const lastBroadcastTimestampPerSlot = new Map();
let schedulerInterval = null;

/**
 * Resolves effective meal start timings from SystemConfig (or fallback to defaults)
 */
async function getEffectiveStartTimings() {
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const SystemConfig = require("../models/systemConfig.model");
      const config = await SystemConfig.getEffectiveConfig();
      if (config && config.messNotificationConfig) {
        const mc = config.messNotificationConfig;
        return {
          enabled: mc.enabled !== false,
          alertCountPerMeal: Math.max(1, Math.min(3, Number(mc.alertCountPerMeal || 1))),
          working: {
            breakfast: { hour: mc.workingDays?.breakfast?.startHour ?? 7, minute: mc.workingDays?.breakfast?.startMinute ?? 0, timing: mc.workingDays?.breakfast?.timing || "07:00 AM – 09:15 AM" },
            lunch:     { hour: mc.workingDays?.lunch?.startHour ?? 12,    minute: mc.workingDays?.lunch?.startMinute ?? 30, timing: mc.workingDays?.lunch?.timing || "12:30 PM – 02:30 PM" },
            snacks:    { hour: mc.workingDays?.snacks?.startHour ?? 17,   minute: mc.workingDays?.snacks?.startMinute ?? 45, timing: mc.workingDays?.snacks?.timing || "05:45 PM – 07:30 PM" },
            dinner:    { hour: mc.workingDays?.dinner?.startHour ?? 20,   minute: mc.workingDays?.dinner?.startMinute ?? 30, timing: mc.workingDays?.dinner?.timing || "08:30 PM – 10:00 PM" },
          },
          sundayAndHolidays: {
            breakfast: { hour: mc.sundayAndHolidays?.breakfast?.startHour ?? 8, minute: mc.sundayAndHolidays?.breakfast?.startMinute ?? 0, timing: mc.sundayAndHolidays?.breakfast?.timing || "08:00 AM – 10:00 AM" },
            lunch:     { hour: mc.sundayAndHolidays?.lunch?.startHour ?? 12,    minute: mc.sundayAndHolidays?.lunch?.startMinute ?? 30, timing: mc.sundayAndHolidays?.lunch?.timing || "12:30 PM – 02:30 PM" },
            snacks:    { hour: mc.sundayAndHolidays?.snacks?.startHour ?? 17,   minute: mc.sundayAndHolidays?.snacks?.startMinute ?? 30, timing: mc.sundayAndHolidays?.snacks?.timing || "05:30 PM – 07:00 PM" },
            dinner:    { hour: mc.sundayAndHolidays?.dinner?.startHour ?? 20,   minute: mc.sundayAndHolidays?.dinner?.startMinute ?? 30, timing: mc.sundayAndHolidays?.dinner?.timing || "08:30 PM – 10:00 PM" },
          },
        };
      }
    }
  } catch (e) {
    // Fall back to defaults on error
  }
  return { enabled: true, alertCountPerMeal: 1, ...OFFICIAL_START_TIMINGS };
}

/**
 * Get current time and day in Asia/Kolkata timezone
 */
function getKolkataTime() {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = istFormatter.formatToParts(now);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);
  const weekday = (partMap.weekday || "").toLowerCase();

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday, // 'monday', 'sunday', etc.
    isSunday: weekday === "sunday",
    dateStr,
  };
}

/**
 * Retrieves the currently active mess menu from database (or fallback)
 */
async function fetchCurrentMessMenu() {
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const MessMenu = require("../models/messMenu.model");
      const doc = await MessMenu.findOne({ key: "boys_hostel_default" }).lean();
      if (doc && doc.schedule) {
        return doc;
      }
    }
  } catch (err) {
    // Non-blocking fallback to offline dataset
  }
  return DEFAULT_MESS_DATA;
}

/**
 * Broadcasts an auto-reminder for a specific meal slot to all active devices
 * 
 * @param {string} slotKey - 'breakfast' | 'lunch' | 'snacks' | 'dinner'
 * @param {Object} options - Optional manual override
 */
async function broadcastMealReminder(slotKey, options = {}) {
  const metadata = SLOT_METADATA[slotKey];
  if (!metadata) {
    throw new Error(`Invalid meal slot key: ${slotKey}`);
  }

  // Deduplication guard: prevent double-firing for the same slot within 8 minutes
  if (!options.isTest) {
    const lastSent = lastBroadcastTimestampPerSlot.get(slotKey);
    if (lastSent && Date.now() - lastSent < 8 * 60 * 1000) {
      console.log(`[MessReminderWorker] Duplicate suppression: ${slotKey} alert was already sent ${Math.round((Date.now() - lastSent) / 1000)}s ago. Skipping.`);
      return { success: true, targets: 0, suppressed: true };
    }
    lastBroadcastTimestampPerSlot.set(slotKey, Date.now());
  }

  const Session = require("../models/session.model");
  const menu = await fetchCurrentMessMenu();
  const timeInfo = getKolkataTime();
  const daySchedule = menu.schedule?.[timeInfo.weekday] || menu.schedule?.monday || DEFAULT_MESS_DATA.schedule.monday;
  const meal = daySchedule.meals?.[slotKey] || {};

  const items = meal.items || [];
  const itemsText = items.length > 0 ? items.slice(0, 4).join(", ") : "Special menu items";

  const timingConfig = timeInfo.isSunday
    ? OFFICIAL_START_TIMINGS.sundayAndHolidays[slotKey]
    : OFFICIAL_START_TIMINGS.working[slotKey];

  const timingText = timingConfig?.timing || meal.timing || "";
  const isReminder = options.alertIndex && options.alertIndex > 1;

  const payload = {
    title: isReminder ? `🔔 Reminder: ${metadata.title}` : metadata.title,
    body: `Today's Menu: ${itemsText}${items.length > 4 ? " & more" : ""} (${timingText}). Tap to view full timetable.`,
    route: "/mess-menu",
    data: {
      route: "/mess-menu",
      slotKey,
      day: timeInfo.weekday,
      broadcastType: "mess_auto_reminder",
      alertIndex: String(options.alertIndex || 1),
      timestamp: new Date().toISOString(),
    },
  };

  // Find all active sessions with push tokens (FCM or Web Push)
  const mongoose = require("mongoose");
  let sessions = [];
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    sessions = await Session.find({
      status: "active",
      $or: [
        { pushToken: { $exists: true, $ne: null, $ne: "" } },
        { "webPushSubscription.endpoint": { $exists: true, $ne: null } },
      ],
    })
      .select("+pushToken +webPushSubscription")
      .lean();
  }

  if (sessions.length === 0) {
    console.log(`[MessReminderWorker] No active push sessions found for ${slotKey}.`);
    return { success: true, targets: 0, report: null };
  }

  const report = await sendPushToSessions(sessions, payload);
  console.log(`[MessReminderWorker] Broadcasted ${slotKey} alert #${options.alertIndex || 1} to ${sessions.length} devices (FCM accepted: ${report.fcm?.accepted || 0}).`);

  return {
    success: true,
    slotKey,
    targets: sessions.length,
    report,
    payload,
  };
}

/**
 * Single heartbeat check: compares current Kolkata minute with meal start timings and repeat offsets
 */
async function checkAndTriggerMealAlerts() {
  const effective = await getEffectiveStartTimings();
  if (!effective.enabled) {
    return;
  }

  const kt = getKolkataTime();
  const timings = kt.isSunday
    ? effective.sundayAndHolidays
    : effective.working;
  const alertCount = effective.alertCountPerMeal || 1;

  for (const [slotKey, cfg] of Object.entries(timings)) {
    // Generate trigger minute offsets based on alertCount:
    // Alert 1: 0m (exact meal start)
    // Alert 2: +15m (polite reminder)
    // Alert 3: +30m (final reminder)
    const offsets = [0];
    if (alertCount >= 2) offsets.push(15);
    if (alertCount >= 3) offsets.push(30);

    for (let i = 0; i < offsets.length; i++) {
      const offsetMinutes = offsets[i];
      const totalStartMinutes = cfg.hour * 60 + cfg.minute + offsetMinutes;
      const targetHour = Math.floor(totalStartMinutes / 60) % 24;
      const targetMinute = totalStartMinutes % 60;

      if (targetHour === kt.hour && targetMinute === kt.minute) {
        const broadcastKey = `${kt.dateStr}_${slotKey}_alert_${i + 1}_${targetHour}:${targetMinute}`;
        if (firedBroadcastsToday.has(broadcastKey)) {
          continue;
        }

        firedBroadcastsToday.add(broadcastKey);

        if (firedBroadcastsToday.size > 100) {
          const oldest = firedBroadcastsToday.values().next().value;
          firedBroadcastsToday.delete(oldest);
        }

        try {
          console.log(`⏰ [MessReminderWorker] Meal start alert #${i + 1} detected: ${slotKey} on ${kt.weekday} (${kt.dateStr} ${kt.hour}:${kt.minute} IST). Initiating broadcast...`);
          await broadcastMealReminder(slotKey, { alertIndex: i + 1 });
        } catch (err) {
          console.error(`[MessReminderWorker] Error broadcasting ${slotKey} reminder:`, err);
        }
      }
    }
  }
}

/**
 * Clear cached fired broadcasts safely without wiping current hour's deliveries
 */
function clearFiredMealBroadcasts() {
  console.log("[MessReminderWorker] Schedule timings refreshed. Active delivery ledger preserved to prevent duplicate alerts.");
}

/**
 * Starts the background auto-notification daemon
 */
function startMessReminderScheduler() {
  if (schedulerInterval) return;

  console.log("🍱 [MessReminderWorker] Auto-notification service initialized. Monitoring IST meal start timings...");

  // Run initial check immediately
  checkAndTriggerMealAlerts().catch(() => {});

  // Run heartbeat check every 30 seconds
  schedulerInterval = setInterval(() => {
    checkAndTriggerMealAlerts().catch((err) => {
      console.error("[MessReminderWorker] Heartbeat error:", err.message);
    });
  }, 30000);
}

/**
 * Stops the background auto-notification daemon (for clean shutdown / testing)
 */
function stopMessReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[MessReminderWorker] Scheduler stopped.");
  }
}

module.exports = {
  startMessReminderScheduler,
  stopMessReminderScheduler,
  clearFiredMealBroadcasts,
  broadcastMealReminder,
  getKolkataTime,
  getEffectiveStartTimings,
  OFFICIAL_START_TIMINGS,
};
