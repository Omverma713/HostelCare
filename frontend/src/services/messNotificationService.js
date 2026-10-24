/**
 * messNotificationService.js
 * 
 * Offline-first, autonomous meal notification engine for HostelCare.
 * Automatically schedules OS-level system alerts for meal start timings:
 *  - Breakfast (07:00 AM Working / 08:00 AM Sunday)
 *  - Lunch     (12:30 PM Daily)
 *  - Snacks    (05:45 PM Working / 05:30 PM Sunday)
 *  - Dinner    (08:30 PM Daily)
 * 
 * Operates independent of authentication state (works whether user is logged in or logged out).
 * On Android, utilizes Capacitor LocalNotifications with High-Priority AlarmManager channel.
 * On Web, utilizes standard W3C Notification API with heartbeat schedule watcher.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from './api';
import {
  DEFAULT_MESS_DATA,
  OFFICIAL_MESS_TIMINGS,
  DAYS_ORDER,
  MEAL_SLOTS,
} from '../constants/messMenuData';

export const MESS_CHANNEL_ID = 'hostelcare_mess_meals';
const SETTING_KEY = 'hostelcare_meal_reminders_enabled';
const LAST_FIRED_KEY = 'hostelcare_last_fired_meal_web';

let channelInitialized = false;
let webWatcherInterval = null;
let listenersRegistered = false;

/**
 * Check if meal reminders are enabled in local storage (defaults to true)
 */
export function areMealRemindersEnabled() {
  try {
    const val = localStorage.getItem(SETTING_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Toggle meal reminders enabled state
 */
export async function setMealRemindersEnabled(enabled, menuData = null) {
  try {
    localStorage.setItem(SETTING_KEY, String(enabled));
    if (enabled) {
      await scheduleWeeklyMealReminders(menuData);
    } else {
      await cancelAllMealReminders();
    }
    return true;
  } catch (err) {
    console.error('Failed to update meal reminder settings:', err);
    return false;
  }
}

/**
 * Initialize high-importance Android notification channel for mess meal alerts
 */
export async function initializeMessChannel() {
  if (!Capacitor.isNativePlatform()) return;
  if (channelInitialized) return;

  try {
    await LocalNotifications.createChannel({
      id: MESS_CHANNEL_ID,
      name: 'HostelCare Mess Meal Alerts',
      description: 'Automatic notifications when Breakfast, Lunch, Snacks, and Dinner start',
      importance: 5, // High Importance (Heads-up banner & alert)
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#10B981', // Emerald green brand color
    });
    channelInitialized = true;
  } catch (err) {
    console.warn('Mess notification channel initialization warning:', err);
  }
}

/**
 * Register notification click handlers to navigate to the Mess Menu screen
 */
export function registerNotificationClickListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  if (Capacitor.isNativePlatform()) {
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const route = notification.notification?.extra?.route || '/mess-menu';
        if (route && window.location.pathname !== route) {
          window.location.href = route;
        }
      });
    } catch (err) {
      console.warn('Could not attach local notification action listener:', err);
    }
  }
}

/**
 * Generate a 32-bit positive integer ID for a scheduled meal
 * Format: YYMMDD + slotIndex (e.g. 26102401 for 2026-10-24 Breakfast)
 */
function getMealNotificationId(date, slotKey) {
  const yy = date.getFullYear() % 100;
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const slotIndexMap = { breakfast: 1, lunch: 2, snacks: 3, dinner: 4 };
  const slotIdx = slotIndexMap[slotKey] || 9;
  return yy * 1000000 + mm * 10000 + dd * 100 + slotIdx;
}

/**
 * Cancel previously scheduled meal notifications
 */
export async function cancelAllMealReminders() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending && pending.notifications && pending.notifications.length > 0) {
      // Filter out notifications that belong to our meal ID scheme (20000000 - 99999999)
      const mealNotifications = pending.notifications.filter(
        (n) => n.id >= 20000000 && n.id <= 99999999
      );
      if (mealNotifications.length > 0) {
        await LocalNotifications.cancel({ notifications: mealNotifications });
      }
    }
  } catch (err) {
    console.warn('Error cancelling pending meal reminders:', err);
  }
}

/**
 * Formats a clean list of meal dishes for notification body
 */
function formatMealSummary(mealObj) {
  if (!mealObj) return '';
  const items = mealObj.items || [];
  if (items.length === 0) return '';
  if (items.length <= 4) {
    return items.join(', ');
  }
  return items.slice(0, 3).join(', ') + ' & more';
}

/**
 * Schedule weekly meal alerts for the next 7 days in Android OS
 * 
 * Works 100% offline and triggers whether the user is logged in or logged out.
 */
export async function scheduleWeeklyMealReminders(customMenu = null, customConfig = null) {
  if (!areMealRemindersEnabled()) return { scheduled: 0, reason: 'disabled' };

  let activeConfig = customConfig;
  if (!activeConfig) {
    try {
      const scheduleRes = await api.getPublicMessNotificationSchedule();
      if (scheduleRes?.success && scheduleRes.config) {
        activeConfig = scheduleRes.config;
      }
    } catch (_) {}
  }

  // If engine is disabled by administrator, cancel local alarms
  if (activeConfig && activeConfig.enabled === false) {
    await cancelAllMealReminders();
    return { scheduled: 0, reason: 'admin_muted' };
  }

  const menu = customMenu || DEFAULT_MESS_DATA;
  const schedule = menu.schedule || DEFAULT_MESS_DATA.schedule;
  const isNative = Capacitor.isNativePlatform();

  const workingTimings = activeConfig?.workingDays || OFFICIAL_MESS_TIMINGS.workingDays;
  const sundayTimings = activeConfig?.sundayAndHolidays || OFFICIAL_MESS_TIMINGS.sundayAndHolidays;

  if (isNative) {
    await initializeMessChannel();
    registerNotificationClickListeners();

    // Verify or request notification permission
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') {
          return { scheduled: 0, reason: 'permission_denied' };
        }
      }
    } catch (e) {
      console.warn('Permission check error in scheduleWeeklyMealReminders:', e);
    }

    // Cancel existing scheduled meal reminders before rescheduling fresh set
    await cancelAllMealReminders();

    const notificationsToSchedule = [];
    const now = Date.now();

    // Schedule for the next 7 days (today through day + 6)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      targetDate.setSeconds(0, 0);

      // Determine day key in lowercase ('sunday', 'monday', etc.)
      const dayIndex = targetDate.getDay(); // 0 is Sunday, 1 is Monday...
      const dayKey = DAYS_ORDER.find((_, idx) => (idx + 1) % 7 === dayIndex)?.key || 'monday';
      const isSunday = dayIndex === 0;

      const daySchedule = schedule[dayKey] || schedule.monday;
      const meals = daySchedule.meals || {};
      const timingSource = isSunday ? sundayTimings : workingTimings;

      const slotConfigs = [
        {
          key: 'breakfast',
          title: '🌅 Breakfast is now starting!',
          config: timingSource.breakfast || OFFICIAL_MESS_TIMINGS.workingDays.breakfast,
          icon: '🌅',
        },
        {
          key: 'lunch',
          title: '☀️ Lunch is now being served!',
          config: timingSource.lunch || OFFICIAL_MESS_TIMINGS.workingDays.lunch,
          icon: '☀️',
        },
        {
          key: 'snacks',
          title: '☕ Evening Snacks is starting now!',
          config: timingSource.snacks || OFFICIAL_MESS_TIMINGS.workingDays.snacks,
          icon: '☕',
        },
        {
          key: 'dinner',
          title: '🌙 Dinner is now being served!',
          config: timingSource.dinner || OFFICIAL_MESS_TIMINGS.workingDays.dinner,
          icon: '🌙',
        },
      ];

      for (const slot of slotConfigs) {
        const mealData = meals[slot.key];
        const startHour = Number(slot.config.startHour ?? slot.config.hour ?? 7);
        const startMinute = Number(slot.config.startMinute ?? slot.config.minute ?? 0);
        const displayTiming = slot.config.timing || '';

        const scheduledAt = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          startHour,
          startMinute,
          0,
          0
        );

        // Only schedule for future timings
        if (scheduledAt.getTime() > now + 1000) {
          const itemsSummary = formatMealSummary(mealData);
          const bodyText = itemsSummary
            ? `Today's Menu: ${itemsSummary} (${displayTiming}). Tap to see full menu.`
            : `Meal timing: ${displayTiming}. Tap to see details.`;

          notificationsToSchedule.push({
            id: getMealNotificationId(scheduledAt, slot.key),
            title: slot.title,
            body: bodyText,
            channelId: MESS_CHANNEL_ID,
            smallIcon: 'ic_stat_hostelcare',
            largeIcon: 'ic_launcher',
            iconColor: '#10B981',
            schedule: {
              at: scheduledAt,
              allowWhileIdle: true,
            },
            extra: {
              route: '/mess-menu',
              slotKey: slot.key,
              dayKey,
              scheduledAt: scheduledAt.toISOString(),
            },
          });
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      try {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule,
        });
        console.log(`✅ [MessAutoNotice] Successfully scheduled ${notificationsToSchedule.length} meal start alarms with OS AlarmManager (allowWhileIdle: true).`);
        return { scheduled: notificationsToSchedule.length, success: true };
      } catch (scheduleErr) {
        console.error('Failed to schedule local meal notifications:', scheduleErr);
        return { scheduled: 0, error: scheduleErr.message };
      }
    }

    return { scheduled: 0, success: true };
  }

  // Web Browser fallback
  startWebMealWatcher(menu, activeConfig);
  return { scheduled: 0, platform: 'web', success: true };
}

/**
 * Web Browser Heartbeat Watcher
 * When the app is open in any web browser, checks current Kolkata minute
 * and presents a Notification if a meal has just started.
 */
export function startWebMealWatcher(customMenu = null, customConfig = null) {
  if (typeof window === 'undefined') return;
  if (webWatcherInterval) {
    clearInterval(webWatcherInterval);
    webWatcherInterval = null;
  }

  const menu = customMenu || DEFAULT_MESS_DATA;
  const schedule = menu.schedule || DEFAULT_MESS_DATA.schedule;
  const workingTimings = customConfig?.workingDays || OFFICIAL_MESS_TIMINGS.workingDays;
  const sundayTimings = customConfig?.sundayAndHolidays || OFFICIAL_MESS_TIMINGS.sundayAndHolidays;

  const runWatcher = () => {
    if (!areMealRemindersEnabled()) return;
    if (!('Notification' in window) || window.Notification.permission !== 'granted') return;

    const now = new Date();
    // Get Indian Standard Time
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const dayIndex = istDate.getDay();
    const isSunday = dayIndex === 0;
    const hour = istDate.getHours();
    const minute = istDate.getMinutes();

    const dayKey = DAYS_ORDER.find((_, idx) => (idx + 1) % 7 === dayIndex)?.key || 'monday';
    const daySchedule = schedule[dayKey] || schedule.monday;
    const meals = daySchedule.meals || {};
    const timingSource = isSunday ? sundayTimings : workingTimings;

    const slots = [
      { key: 'breakfast', title: '🌅 Breakfast is now starting!', config: timingSource.breakfast || OFFICIAL_MESS_TIMINGS.workingDays.breakfast },
      { key: 'lunch', title: '☀️ Lunch is now being served!', config: timingSource.lunch || OFFICIAL_MESS_TIMINGS.workingDays.lunch },
      { key: 'snacks', title: '☕ Evening Snacks is starting now!', config: timingSource.snacks || OFFICIAL_MESS_TIMINGS.workingDays.snacks },
      { key: 'dinner', title: '🌙 Dinner is now being served!', config: timingSource.dinner || OFFICIAL_MESS_TIMINGS.workingDays.dinner },
    ];

    for (const slot of slots) {
      const startHour = Number(slot.config.startHour ?? slot.config.hour ?? 7);
      const startMinute = Number(slot.config.startMinute ?? slot.config.minute ?? 0);
      if (startHour === hour && startMinute === minute) {
        const fireKey = `${istDate.toDateString()}_${slot.key}_${hour}:${minute}`;
        const lastFired = sessionStorage.getItem(LAST_FIRED_KEY);
        if (lastFired === fireKey) continue;

        sessionStorage.setItem(LAST_FIRED_KEY, fireKey);
        const mealData = meals[slot.key];
        const summary = formatMealSummary(mealData);
        const displayTiming = slot.config.timing || '';

        const body = summary
          ? `Today's Menu: ${summary} (${displayTiming}). Click to view.`
          : `Serving now (${displayTiming}). Click to view.`;

        try {
          const notification = new window.Notification(slot.title, {
            body,
            icon: '/apple-touch-icon.png',
            tag: `hostelcare-meal-${slot.key}`,
          });

          notification.onclick = () => {
            window.focus();
            if (window.location.pathname !== '/mess-menu') {
              window.location.href = '/mess-menu';
            }
          };
        } catch (_) {}
      }
    }
  };

  // Run initial check and then every 15 seconds
  runWatcher();
  webWatcherInterval = setInterval(runWatcher, 15000);
}

/**
 * Triggers an immediate test meal notification for demonstration
 */
export async function triggerTestMealNotification(slotKey = 'breakfast') {
  const isNative = Capacitor.isNativePlatform();
  const slotTitles = {
    breakfast: '🌅 Breakfast is now starting!',
    lunch: '☀️ Lunch is now being served!',
    snacks: '☕ Evening Snacks is starting now!',
    dinner: '🌙 Dinner is now being served!',
  };

  const title = slotTitles[slotKey] || '🍱 Meal Time at HostelCare!';
  const body = `Sample alert: Meal is being served right now. Tap to view today's complete verified timetable.`;

  if (isNative) {
    await initializeMessChannel();
    const testId = 99990000 + Math.floor(Math.random() * 9999);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title,
          body,
          channelId: MESS_CHANNEL_ID,
          smallIcon: 'ic_stat_hostelcare',
          largeIcon: 'ic_launcher',
          iconColor: '#10B981',
          schedule: { at: new Date(Date.now() + 500) },
          extra: { route: '/mess-menu', isTest: true },
        },
      ],
    });
    return { success: true, platform: 'native' };
  }

  // Web Browser
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission !== 'granted') {
      const res = await window.Notification.requestPermission();
      if (res !== 'granted') {
        throw new Error('Notification permission denied in browser.');
      }
    }

    const n = new window.Notification(title, {
      body,
      icon: '/apple-touch-icon.png',
    });
    n.onclick = () => {
      window.focus();
      if (window.location.pathname !== '/mess-menu') {
        window.location.href = '/mess-menu';
      }
    };
    return { success: true, platform: 'web' };
  }

  throw new Error('Notifications not supported in current environment.');
}

/**
 * Master initializer called at app startup (App.jsx)
 * Ensures meal alarms are registered whether the user is logged in or logged out.
 */
export async function initMessAutoNotifications(customMenu = null) {
  try {
    registerNotificationClickListeners();
    const res = await scheduleWeeklyMealReminders(customMenu);
    return res;
  } catch (err) {
    console.warn('initMessAutoNotifications notice:', err);
    return { success: false, error: err.message };
  }
}
