const webpush = require("web-push");
let admin = null;

try {
  admin = require("firebase-admin");
} catch (err) {
  // Graceful fallback if not available
}

let fcmInitialized = false;
let webPushInitialized = false;

let messagingInstance = null;

/**
 * Initialize Firebase Admin SDK if service account credentials exist
 */
function initFirebase() {
  if (fcmInitialized) return true;
  if (!admin) return false;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    let credential = null;
    if (serviceAccountJson) {
      const creds = JSON.parse(serviceAccountJson);
      credential = admin.cert ? admin.cert(creds) : admin.credential.cert(creds);
    } else if (serviceAccountPath) {
      credential = admin.applicationDefault
        ? admin.applicationDefault()
        : admin.credential.applicationDefault();
    }

    if (credential) {
      const app = admin.initializeApp({ credential });
      try {
        const { getMessaging } = require("firebase-admin/messaging");
        messagingInstance = getMessaging(app);
      } catch {
        messagingInstance = typeof admin.messaging === "function" ? admin.messaging() : null;
      }
      fcmInitialized = true;
      console.log("✅ Firebase Cloud Messaging (FCM) initialized successfully.");
      return true;
    }
  } catch (err) {
    console.warn("⚠️ Firebase Admin initialization failed:", err.message);
  }
  return false;
}

/**
 * Initialize Web Push VAPID keys if provided in environment
 */
function initWebPush() {
  if (webPushInitialized) return true;

  const subject = process.env.VAPID_SUBJECT || "mailto:admin@hostelcare.local";
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      webPushInitialized = true;
      console.log("✅ Web Push VAPID configuration initialized successfully.");
      return true;
    } catch (err) {
      console.warn("⚠️ Web Push configuration failed:", err.message);
    }
  }
  return false;
}

// Auto-run initialization check on load
initFirebase();
initWebPush();

/**
 * Dispatch notification to a list of target sessions across FCM and Web Push
 * 
 * @param {Array<Object>} sessions - Target sessions populated with pushToken and webPushSubscription
 * @param {Object} payload - { title, body, route, data }
 * @returns {Promise<Object>} Delivery report
 */
async function sendPushToSessions(sessions, payload) {
  const isFcmReady = initFirebase();
  const isWebPushReady = initWebPush();

  const report = {
    totalTargets: sessions.length,
    attempted: 0,
    accepted: 0,
    failed: 0,
    staleTokensRemoved: 0,
    fcm: { attempted: 0, accepted: 0, failed: 0 },
    webpush: { attempted: 0, accepted: 0, failed: 0 },
    errors: [],
    providerNotes: [],
  };

  if (!isFcmReady && !isWebPushReady) {
    report.providerNotes.push(
      "Neither Firebase Admin (FIREBASE_SERVICE_ACCOUNT_JSON) nor Web Push (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) is configured in environment. Notifications were logged but not dispatched to external push gateways."
    );
  }

  const Session = require("../models/session.model");

  for (const session of sessions) {
    const { pushToken, webPushSubscription, pushProvider, _id: sessionId } = session;

    // 1. Android FCM Notification
    if (pushToken && (pushProvider === "fcm" || pushProvider === "none")) {
      report.attempted++;
      report.fcm.attempted++;

      if (!isFcmReady) {
        report.failed++;
        report.fcm.failed++;
        report.errors.push({
          sessionId: sessionId.toString(),
          provider: "fcm",
          error: "FCM provider credentials not configured on server",
        });
        continue;
      }

      try {
        const message = {
          token: pushToken,
          notification: {
            title: payload.title || "HostelCare",
            body: payload.body || "",
          },
          data: {
            route: payload.route || "/",
            sentAt: new Date().toISOString(),
            ...(payload.data || {}),
          },
          android: {
            priority: "high",
            notification: {
              channelId: "hostelcare_custom_channel",
              sound: "default",
            },
          },
        };

        if (messagingInstance) {
          await messagingInstance.send(message);
        } else if (typeof admin.messaging === "function") {
          await admin.messaging().send(message);
        } else {
          throw new Error("FCM messaging instance not available");
        }
        report.accepted++;
        report.fcm.accepted++;
      } catch (err) {
        report.failed++;
        report.fcm.failed++;
        report.errors.push({
          sessionId: sessionId.toString(),
          provider: "fcm",
          error: err.message,
        });

        // Automatically clean up stale or invalid registration tokens
        if (
          err.code === "messaging/registration-token-not-registered" ||
          err.code === "messaging/invalid-registration-token"
        ) {
          await Session.updateOne(
            { _id: sessionId },
            { $set: { pushToken: null, pushProvider: "none" } }
          ).catch(() => {});
          report.staleTokensRemoved++;
        }
      }
    }

    // 2. Web Push Notification
    else if (webPushSubscription && pushProvider === "webpush") {
      report.attempted++;
      report.webpush.attempted++;

      if (!isWebPushReady) {
        report.failed++;
        report.webpush.failed++;
        report.errors.push({
          sessionId: sessionId.toString(),
          provider: "webpush",
          error: "Web Push VAPID keys not configured on server",
        });
        continue;
      }

      try {
        const pushPayload = JSON.stringify({
          title: payload.title || "HostelCare",
          body: payload.body || "",
          data: {
            route: payload.route || "/",
            sentAt: new Date().toISOString(),
          },
        });

        await webpush.sendNotification(webPushSubscription, pushPayload);
        report.accepted++;
        report.webpush.accepted++;
      } catch (err) {
        report.failed++;
        report.webpush.failed++;
        report.errors.push({
          sessionId: sessionId.toString(),
          provider: "webpush",
          error: err.message,
        });

        // 404 or 410 Gone indicates expired or unsubscribed endpoint
        if (err.statusCode === 404 || err.statusCode === 410) {
          await Session.updateOne(
            { _id: sessionId },
            { $set: { webPushSubscription: null, pushProvider: "none" } }
          ).catch(() => {});
          report.staleTokensRemoved++;
        }
      }
    }
  }

  return report;
}

module.exports = {
  initFirebase,
  initWebPush,
  sendPushToSessions,
};
