import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'hostelcare_custom_channel';
let channelInitialized = false;

/**
 * Initializes the Android Notification Channel with High Importance.
 * Required for Android 8.0+ (API 26+) so notifications produce visual alerts in the shade.
 */
export async function initializeNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;
  if (channelInitialized) return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'HostelCare Notifications',
      description: 'HostelCare real-time Android system notifications',
      importance: 5, // High importance (heads-up shade notification)
      visibility: 1, // Public visibility on lockscreen & shade
      vibration: true,
      lights: true,
      lightColor: '#4361EE',
    });
    channelInitialized = true;
  } catch (err) {
    console.warn('Notification channel initialization notice:', err);
  }
}

/**
 * Checks current notification permission status.
 * @returns {Promise<{ granted: boolean, status: string, platform: string }>}
 */
export async function checkNotificationPermission() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const status = await LocalNotifications.checkPermissions();
      return {
        granted: status.display === 'granted',
        status: status.display,
        platform: 'native',
      };
    } catch (err) {
      console.error('Error checking native notification permissions:', err);
      return { granted: false, status: 'error', platform: 'native' };
    }
  }

  // Web Browser fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return {
      granted: window.Notification.permission === 'granted',
      status: window.Notification.permission,
      platform: 'web',
    };
  }

  return { granted: false, status: 'unsupported', platform: 'web' };
}

/**
 * Requests notification permission from user.
 * On Android 13+ (API 33+), prompts the native POST_NOTIFICATIONS dialog.
 * @returns {Promise<{ granted: boolean, status: string, platform: string }>}
 */
export async function requestNotificationPermission() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      await initializeNotificationChannel();
      const result = await LocalNotifications.requestPermissions();
      return {
        granted: result.display === 'granted',
        status: result.display,
        platform: 'native',
      };
    } catch (err) {
      console.error('Error requesting native notification permission:', err);
      return { granted: false, status: 'error', platform: 'native' };
    }
  }

  // Web Browser fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await window.Notification.requestPermission();
      return {
        granted: permission === 'granted',
        status: permission,
        platform: 'web',
      };
    } catch (err) {
      return { granted: false, status: 'error', platform: 'web' };
    }
  }

  return { granted: false, status: 'unsupported', platform: 'web' };
}

/**
 * Sends a real Android system notification with title 'HostelCare' and the specified text message.
 * Supports multiple concurrent notifications via unique 32-bit integer IDs.
 * 
 * @param {string} message - The text content to display in the notification body
 * @returns {Promise<{ success: boolean, id: number, platform: string, message: string }>}
 */
export async function sendCustomNotification(message) {
  const trimmed = (message || '').trim();
  if (!trimmed) {
    throw new Error('Please enter notification text before sending.');
  }

  const isNative = Capacitor.isNativePlatform();

  // Generate safe 32-bit positive integer ID for Android system notification
  const notificationId = Math.floor(Math.random() * 2000000000) + 1;

  if (isNative) {
    // 1. Ensure channel is ready
    await initializeNotificationChannel();

    // 2. Verify or request permission
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') {
        throw new Error('Notification permission was denied. Please allow notifications in Android Settings.');
      }
    }

    // 3. Schedule immediate notification to Android system shade
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: 'HostelCare',
          body: trimmed,
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher_round',
          iconColor: '#4361EE',
          schedule: { at: new Date(Date.now() + 100) },
          extra: {
            sentAt: new Date().toISOString(),
            source: 'custom_notification_screen',
          },
        },
      ],
    });

    return {
      success: true,
      id: notificationId,
      platform: 'native',
      message: trimmed,
    };
  }

  // Web Browser fallback for previewing in dev mode
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission !== 'granted') {
      const requested = await window.Notification.requestPermission();
      if (requested !== 'granted') {
        throw new Error('Web notification permission was denied in your browser.');
      }
    }

    new window.Notification('HostelCare', {
      body: trimmed,
      icon: '/apple-touch-icon.png',
      tag: `hostelcare-${notificationId}`,
    });

    return {
      success: true,
      id: notificationId,
      platform: 'web',
      message: trimmed,
    };
  }

  throw new Error('Notifications are not supported in this browser environment. Test inside the HostelCare Android APK.');
}
