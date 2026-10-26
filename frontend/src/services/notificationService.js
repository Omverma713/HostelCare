import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

const CHANNEL_ID = 'hostelcare_custom_channel';
let channelInitialized = false;
let pushRegistered = false;

/**
 * Initializes FCM Push Notifications inside the Android Capacitor wrapper.
 * Registers the device token with the backend and handles foreground alerts.
 */
export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  if (pushRegistered) return;

  try {
    await initializeNotificationChannel();

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    await PushNotifications.register();

    // Ensure clean state without duplicate listeners
    await PushNotifications.removeAllListeners().catch(() => {});

    PushNotifications.addListener('registration', async (token) => {
      console.log('FCM Device Token registered:', token.value);
      try {
        await api.registerPushToken(token.value, 'fcm', {
          platform: 'android',
          hardwareModel: 'Android Mobile App',
        });
        pushRegistered = true;
      } catch (err) {
        console.warn('Failed to send push token to backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('FCM registration error:', err);
    });

    // Foreground push notification received:
    // Capacitor's PushNotifications plugin automatically presents the system notification banner
    // according to presentationOptions: ["badge", "sound", "alert"].
    // Do NOT schedule a LocalNotification here as that causes duplicate notifications in the shade.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received in foreground:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const route = notification.notification?.data?.route;
      if (route && window.location.pathname !== route) {
        window.location.href = route;
      }
    });

    pushRegistered = true;
  } catch (err) {
    console.warn('Push notifications initialization notice:', err);
  }
}

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
          smallIcon: 'ic_stat_hostelcare',
          largeIcon: 'ic_launcher',
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
