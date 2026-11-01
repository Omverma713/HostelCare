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
  const DeviceRegistry = require("../models/deviceRegistry.model");

  // Track unique tokens and endpoints to ensure exactly 1 push per device
  const seenFcmTokens = new Set();
  const seenWebPushEndpoints = new Set();
  const fcmTargets = [];
  const webPushTargets = [];

  for (const session of sessions) {
    const { pushToken, webPushSubscription, pushProvider, _id: sessionId } = session;

    // Collect FCM Targets
    if (pushToken && (pushProvider === "fcm" || pushProvider === "none" || !pushProvider)) {
      const normalizedToken = typeof pushToken === "string" ? pushToken.trim() : "";
      if (normalizedToken && !seenFcmTokens.has(normalizedToken)) {
        seenFcmTokens.add(normalizedToken);
        fcmTargets.push({ token: normalizedToken, sessionId });
      }
    }

    // Collect WebPush Targets
    if (webPushSubscription && pushProvider === "webpush") {
      const endpoint = webPushSubscription.endpoint;
      if (endpoint && !seenWebPushEndpoints.has(endpoint)) {
        seenWebPushEndpoints.add(endpoint);
        webPushTargets.push({ subscription: webPushSubscription, sessionId });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Android FCM High-Priority Multicast Batch Delivery (Phase 1 Turbo Boost)
  // ──────────────────────────────────────────────────────────────────────────
  if (fcmTargets.length > 0) {
    report.attempted += fcmTargets.length;
    report.fcm.attempted += fcmTargets.length;

    if (!isFcmReady) {
      report.failed += fcmTargets.length;
      report.fcm.failed += fcmTargets.length;
      report.errors.push({
        provider: "fcm",
        error: "FCM provider credentials not configured on server",
      });
    } else {
      const staleTokensToClean = [];

      // Construct High Priority Android FCM payload designed to penetrate Android Deep Doze Mode
      const baseFcmPayload = {
        notification: {
          title: payload.title || "HostelCare",
          body: payload.body || "",
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: {
          route: payload.route || "/",
          imageUrl: payload.imageUrl || "",
          sentAt: new Date().toISOString(),
          ...(payload.data || {}),
        },
        android: {
          priority: "high",
          ttl: 7200, // 2-hour TTL to ensure delivery as soon as device surfaces
          notification: {
            channelId: payload.channelId || "hostelcare_custom_channel",
            sound: "default",
            icon: "ic_stat_hostelcare",
            color: "#00f3ff",
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationPriority: "PRIORITY_MAX",
            visibility: "PUBLIC",
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
        },
      };

      // Case A: Single Target Optimization
      if (fcmTargets.length === 1) {
        const { token, sessionId } = fcmTargets[0];
        try {
          const singleMsg = { token, ...baseFcmPayload };
          if (messagingInstance) {
            await messagingInstance.send(singleMsg);
          } else if (typeof admin.messaging === "function") {
            await admin.messaging().send(singleMsg);
          } else {
            throw new Error("FCM messaging instance not available");
          }
          report.accepted++;
          report.fcm.accepted++;
        } catch (err) {
          report.failed++;
          report.fcm.failed++;
          report.errors.push({
            sessionId: sessionId ? sessionId.toString() : "",
            provider: "fcm",
            error: err.message,
          });
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            staleTokensToClean.push(token);
          }
        }
      } 
      // Case B: Multicast Batching (up to 500 devices per Google FCM call)
      else {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < fcmTargets.length; i += CHUNK_SIZE) {
          const chunk = fcmTargets.slice(i, i + CHUNK_SIZE);
          const chunkTokens = chunk.map((t) => t.token);

          try {
            if (messagingInstance && typeof messagingInstance.sendEachForMulticast === "function") {
              const multicastMsg = { tokens: chunkTokens, ...baseFcmPayload };
              const batchRes = await messagingInstance.sendEachForMulticast(multicastMsg);

              report.accepted += batchRes.successCount;
              report.fcm.accepted += batchRes.successCount;
              report.failed += batchRes.failureCount;
              report.fcm.failed += batchRes.failureCount;

              batchRes.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  const err = resp.error;
                  report.errors.push({
                    token: chunkTokens[idx].slice(0, 15) + "...",
                    provider: "fcm",
                    error: err?.message || "Delivery failed",
                  });
                  if (
                    err?.code === "messaging/registration-token-not-registered" ||
                    err?.code === "messaging/invalid-registration-token"
                  ) {
                    staleTokensToClean.push(chunkTokens[idx]);
                  }
                }
              });
            } else {
              // Fallback to concurrent single sends if sendEachForMulticast is not exposed
              await Promise.allSettled(
                chunk.map(async ({ token, sessionId }) => {
                  try {
                    const singleMsg = { token, ...baseFcmPayload };
                    await (messagingInstance ? messagingInstance.send(singleMsg) : admin.messaging().send(singleMsg));
                    report.accepted++;
                    report.fcm.accepted++;
                  } catch (err) {
                    report.failed++;
                    report.fcm.failed++;
                    if (
                      err.code === "messaging/registration-token-not-registered" ||
                      err.code === "messaging/invalid-registration-token"
                    ) {
                      staleTokensToClean.push(token);
                    }
                  }
                })
              );
            }
          } catch (batchErr) {
            report.failed += chunk.length;
            report.fcm.failed += chunk.length;
            report.errors.push({ provider: "fcm", error: batchErr.message });
          }
        }
      }

      // Automatically prune stale / uninstalled device tokens
      if (staleTokensToClean.length > 0) {
        try {
          await DeviceRegistry.updateMany(
            { pushToken: { $in: staleTokensToClean } },
            { $set: { isActive: false, "metadata.cleanedReason": "unregistered_token", "metadata.cleanedAt": new Date() } }
          );
          await Session.updateMany(
            { pushToken: { $in: staleTokensToClean } },
            { $set: { pushToken: null, pushProvider: "none" } }
          );
          report.staleTokensRemoved += staleTokensToClean.length;
        } catch (_) {}
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Web Push Notifications (Parallelized)
  // ──────────────────────────────────────────────────────────────────────────
  if (webPushTargets.length > 0) {
    report.attempted += webPushTargets.length;
    report.webpush.attempted += webPushTargets.length;

    if (!isWebPushReady) {
      report.failed += webPushTargets.length;
      report.webpush.failed += webPushTargets.length;
      report.errors.push({
        provider: "webpush",
        error: "Web Push VAPID keys not configured on server",
      });
    } else {
      const pushPayload = JSON.stringify({
        title: payload.title || "HostelCare",
        body: payload.body || "",
        image: payload.imageUrl || undefined,
        data: {
          route: payload.route || "/",
          imageUrl: payload.imageUrl || "",
          sentAt: new Date().toISOString(),
        },
      });

      await Promise.allSettled(
        webPushTargets.map(async ({ subscription, sessionId }) => {
          try {
            await webpush.sendNotification(subscription, pushPayload);
            report.accepted++;
            report.webpush.accepted++;
          } catch (err) {
            report.failed++;
            report.webpush.failed++;
            report.errors.push({
              sessionId: sessionId ? sessionId.toString() : "",
              provider: "webpush",
              error: err.message,
            });
            if (err.statusCode === 404 || err.statusCode === 410) {
              await Session.updateOne(
                { _id: sessionId },
                { $set: { webPushSubscription: null, pushProvider: "none" } }
              ).catch(() => {});
              report.staleTokensRemoved++;
            }
          }
        })
      );
    }
  }

  return report;
}

module.exports = {
  initFirebase,
  initWebPush,
  sendPushToSessions,
};
