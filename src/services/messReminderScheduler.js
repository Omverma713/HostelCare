/**
 * messReminderScheduler.js
 * 
 * Server-side autonomous cron / heartbeat scheduler for Mess Menu meal start alerts.
 * Evaluates Indian Standard Time (Asia/Kolkata).
 * When Breakfast, Lunch, Snacks, or Dinner start timing or offset matches:
 *  - Formats rich push notification payload with current menu items
 *  - Dispatches multi-channel push (FCM + WebPush) to active registered devices
 *  - Atomically claims scheduled occurrence in MongoDB via unique idempotencyKey
 *    to strictly prevent duplicate notifications across restarts, ticks, and multi-instance clusters.
 */

const { sendPushToSessions } = require("./pushService");
const { DEFAULT_MESS_DATA } = require("../constants/defaultMessMenu");
const MessNotificationDispatch = require("../models/messNotificationDispatch.model");

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

// In-memory fallback tracking for unit tests or when MongoDB is offline
const inMemoryFiredLedger = new Set();
let schedulerInterval = null;

/**
 * Resolves effective meal start timings and independent per-meal frequencies from SystemConfig
 */
async function getEffectiveStartTimings() {
  try {
    const SystemConfig = require("../models/systemConfig.model");
    const config = await SystemConfig.getEffectiveConfig();
    if (config && config.messNotificationConfig) {
      const mc = config.messNotificationConfig;
      const defaultAlertCount = Math.max(1, Math.min(3, Number(mc.alertCountPerMeal || 1)));

        // Independent per-meal frequencies (defaults to 1 unless Super Admin explicitly configured)
        const rawFreq = mc.frequencies || {};
        const frequencies = {
          breakfast: Math.max(1, Math.min(3, Number(rawFreq.breakfast ?? defaultAlertCount))),
          lunch:     Math.max(1, Math.min(3, Number(rawFreq.lunch ?? defaultAlertCount))),
          snacks:    Math.max(1, Math.min(3, Number(rawFreq.snacks ?? defaultAlertCount))),
          dinner:    Math.max(1, Math.min(3, Number(rawFreq.dinner ?? defaultAlertCount))),
        };

        return {
          enabled: mc.enabled !== false,
          alertCountPerMeal: defaultAlertCount,
          frequencies,
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
  } catch (e) {
    // Fall back to defaults on error
  }

  return {
    enabled: true,
    alertCountPerMeal: 1,
    frequencies: { breakfast: 1, lunch: 1, snacks: 1, dinner: 1 },
    ...OFFICIAL_START_TIMINGS,
  };
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
    weekday,
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
 * @param {Object} options - { alertIndex, occurrence, idempotencyKey, isTest }
 */
async function broadcastMealReminder(slotKey, options = {}) {
  const metadata = SLOT_METADATA[slotKey];
  if (!metadata) {
    throw new Error(`Invalid meal slot key: ${slotKey}`);
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
  const occurrence = options.occurrence || options.alertIndex || 1;
  const isReminder = occurrence > 1;

  let title = metadata.title;
  if (occurrence === 2) {
    title = `🔔 Reminder (+15m): ${metadata.title}`;
  } else if (occurrence === 3) {
    title = `📢 Final Call (+30m): ${metadata.title}`;
  }

  const payload = {
    title,
    body: `Today's Menu: ${itemsText}${items.length > 4 ? " & more" : ""} (${timingText}). Tap to view full timetable.`,
    route: "/mess-menu",
    data: {
      route: "/mess-menu",
      slotKey,
      day: timeInfo.weekday,
      broadcastType: options.isTest ? "mess_manual_test" : "mess_auto_reminder",
      alertIndex: String(occurrence),
      occurrence: String(occurrence),
      idempotencyKey: options.idempotencyKey || "",
      timestamp: new Date().toISOString(),
    },
  };

  // Find all active devices from permanent hardware vault (Layer 1) + fallback sessions
  const mongoose = require("mongoose");
  const DeviceRegistry = require("../models/deviceRegistry.model");
  let targets = [];

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const deviceQuery = {
        isActive: true,
        $or: [
          { pushToken: { $exists: true, $ne: null, $ne: "" } },
          { "webPushSubscription.endpoint": { $exists: true, $ne: null } },
        ],
      };

      const sessionQuery = {
        status: "active",
        $or: [
          { pushToken: { $exists: true, $ne: null, $ne: "" } },
          { "webPushSubscription.endpoint": { $exists: true, $ne: null } },
        ],
      };

      if (options.targetUserId) {
        deviceQuery.userId = options.targetUserId;
        sessionQuery.userId = options.targetUserId;
      }

      const devices = await DeviceRegistry.find(deviceQuery).lean();
      const sessions = await Session.find(sessionQuery)
        .select("+pushToken +webPushSubscription")
        .lean();

      // Deduplicate targets across vault and legacy sessions
      const seenTokens = new Set();
      const seenEndpoints = new Set();

      for (const d of devices) {
        if (d.pushToken) seenTokens.add(d.pushToken);
        if (d.webPushSubscription?.endpoint) seenEndpoints.add(d.webPushSubscription.endpoint);
        targets.push(d);
      }

      for (const s of sessions) {
        if (s.pushToken && !seenTokens.has(s.pushToken)) {
          seenTokens.add(s.pushToken);
          targets.push(s);
        } else if (s.webPushSubscription?.endpoint && !seenEndpoints.has(s.webPushSubscription.endpoint)) {
          seenEndpoints.add(s.webPushSubscription.endpoint);
          targets.push(s);
        }
      }
    } catch (dbErr) {
      console.error("[MessReminderWorker] Error fetching push targets from vault:", dbErr.message);
    }
  }

  if (targets.length === 0) {
    console.log(`⚠️ [MessReminderWorker] No active push devices or sessions registered for ${slotKey}. Dispatch halted.`);
    return { success: false, targets: 0, report: null, payload, reason: "no_devices" };
  }

  const report = await sendPushToSessions(targets, payload);
  console.log(`[MessReminderWorker] Broadcasted ${slotKey} alert #${occurrence} to ${targets.length} devices (FCM accepted: ${report.fcm?.accepted || 0}).`);

  return {
    success: true,
    slotKey,
    targets: targets.length,
    report,
    payload,
  };
}

/**
 * Single heartbeat check: compares current Kolkata minute with meal start timings and repeat offsets.
 * Atomically claims each scheduled occurrence before dispatching.
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

  const mongoose = require("mongoose");
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  for (const [slotKey, cfg] of Object.entries(timings)) {
    // Retrieve independent frequency for this specific meal slot (1, 2, or 3)
    const mealFrequency = Math.max(
      1,
      Math.min(3, Number(effective.frequencies?.[slotKey] ?? effective.alertCountPerMeal ?? 1))
    );

    // Occurrence offsets in minutes:
    // 1st: 0m (exact meal start)
    // 2nd: +15m (polite reminder)
    // 3rd: +30m (final call)
    const offsets = [0];
    if (mealFrequency >= 2) offsets.push(15);
    if (mealFrequency >= 3) offsets.push(30);

    for (let i = 0; i < offsets.length; i++) {
      const occurrence = i + 1;
      const offsetMinutes = offsets[i];
      const totalStartMinutes = cfg.hour * 60 + cfg.minute + offsetMinutes;
      const targetHour = Math.floor(totalStartMinutes / 60) % 24;
      const targetMinute = totalStartMinutes % 60;

      if (targetHour === kt.hour && targetMinute === kt.minute) {
        const idempotencyKey = `${kt.dateStr}_${slotKey}_${occurrence}`;

        // 1. Database-backed atomic claim when connected
        if (isDbConnected) {
          const scheduledFor = new Date();
          const claim = await MessNotificationDispatch.claimOccurrence({
            idempotencyKey,
            mealSlot: slotKey,
            dateStr: kt.dateStr,
            occurrence,
            scheduledFor,
          });

          if (!claim) {
            // Already claimed, dispatched, or active lock held by another worker instance.
            continue;
          }

          try {
            console.log(`⏰ [MessReminderWorker] Claimed meal alert #${occurrence} for ${slotKey} (${idempotencyKey}). Dispatching push...`);
            const broadcastResult = await broadcastMealReminder(slotKey, {
              alertIndex: occurrence,
              occurrence,
              idempotencyKey,
            });

            if (broadcastResult.targets === 0) {
              await MessNotificationDispatch.findOneAndUpdate(
                { idempotencyKey },
                {
                  $set: {
                    status: "no_devices",
                    dispatchedAt: new Date(),
                    targets: 0,
                    failureDetails: "0 active registered devices found in DeviceRegistry. Alert aborted to prevent false-positive status.",
                  },
                }
              );
              console.log(`⚠️ [MessReminderWorker] Marked ${idempotencyKey} as 'no_devices' (0 reachable hardware nodes).`);
            } else {
              await MessNotificationDispatch.markDispatched(idempotencyKey, {
                targets: broadcastResult.targets,
                report: broadcastResult.report,
              });
            }
          } catch (err) {
            console.error(`[MessReminderWorker] Error broadcasting ${slotKey} reminder (${idempotencyKey}):`, err);
            await MessNotificationDispatch.markFailed(idempotencyKey, err);
          }
        } else {
          // 2. In-memory fallback (for unit test environments without MongoDB)
          if (inMemoryFiredLedger.has(idempotencyKey)) {
            continue;
          }
          inMemoryFiredLedger.add(idempotencyKey);
          try {
            await broadcastMealReminder(slotKey, {
              alertIndex: occurrence,
              occurrence,
              idempotencyKey,
            });
          } catch (err) {
            console.error(`[MessReminderWorker] In-memory broadcast error for ${slotKey}:`, err);
          }
        }
      }
    }
  }
}

/**
 * Informational hook for schedule timing updates.
 * Preserves the persistent MongoDB dispatch records so existing deliveries are never resent.
 */
function clearFiredMealBroadcasts() {
  console.log("[MessReminderWorker] Timing schedule saved. Persistent dispatch records preserved to prevent duplicate deliveries.");
}

/**
 * Starts the background auto-notification daemon.
 * Idempotent: ensures only a single scheduler instance runs in this process.
 */
function startMessReminderScheduler() {
  if (schedulerInterval) {
    return;
  }

  console.log("🍱 [MessReminderWorker] Auto-notification service initialized. Monitoring IST meal start timings...");

  // Run initial check
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
  checkAndTriggerMealAlerts,
  getKolkataTime,
  getEffectiveStartTimings,
  OFFICIAL_START_TIMINGS,
};
