/**
 * notificationScheduler.js
 * 
 * Autonomous background daemon for scheduled push notifications.
 * Runs on a 15-second heartbeat loop.
 * 
 * When a scheduled notification's time arrives (scheduledFor <= Date.now()):
 *  - Atomically claims the task in MongoDB ({ status: "scheduled" } -> { status: "processing" })
 *  - Resolves target sessions across all devices / roles / hostels / specific users
 *  - Dispatches multi-channel push (FCM BigPicture Android shade + WebPush)
 *  - Updates execution status, delivery metrics, and immutable audit logs
 */

const NotificationCampaign = require("../models/notification.model");
const Session = require("../models/session.model");
const User = require("../models/user.model");
const AuditLog = require("../models/auditLog.model");
const { sendPushToSessions } = require("./pushService");

let schedulerInterval = null;

/**
 * Resolves active target sessions based on targetAudience and targetCriteria
 * 
 * @param {string} targetAudience - "ALL_DEVICES" | "ROLE_GROUP" | "HOSTEL_GROUP" | "SINGLE_USER" | "SINGLE_DEVICE"
 * @param {Object} targetCriteria - { sessionId, userId, registrationNumber, role, hostel }
 * @returns {Promise<Array<Object>>} List of active sessions with push tokens
 */
async function resolveTargetSessions(targetAudience, targetCriteria = {}) {
  let targetSessions = [];

  switch (targetAudience) {
    case "SINGLE_DEVICE": {
      if (!targetCriteria.sessionId) return [];
      targetSessions = await Session.find({
        sessionId: targetCriteria.sessionId,
        status: "active",
      }).select("+pushToken +webPushSubscription");
      break;
    }

    case "SINGLE_USER": {
      let userFilter = null;
      if (targetCriteria.userId) {
        userFilter = { userId: targetCriteria.userId };
      } else if (targetCriteria.registrationNumber) {
        userFilter = { registrationNumber: targetCriteria.registrationNumber };
      } else {
        return [];
      }
      targetSessions = await Session.find({
        ...userFilter,
        status: "active",
      }).select("+pushToken +webPushSubscription");
      break;
    }

    case "ROLE_GROUP": {
      if (!targetCriteria.role) return [];
      const matchingUsers = await User.find({ role: targetCriteria.role }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);
      targetSessions = await Session.find({
        userId: { $in: userIds },
        status: "active",
      }).select("+pushToken +webPushSubscription");
      break;
    }

    case "HOSTEL_GROUP": {
      if (!targetCriteria.hostel) return [];
      const matchingUsers = await User.find({ hostel: targetCriteria.hostel }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);
      targetSessions = await Session.find({
        userId: { $in: userIds },
        status: "active",
      }).select("+pushToken +webPushSubscription");
      break;
    }

    case "ALL_DEVICES":
    default: {
      targetSessions = await Session.find({
        status: "active",
      }).select("+pushToken +webPushSubscription");
      break;
    }
  }

  return targetSessions;
}

/**
 * Core dispatch worker: executes push delivery for a specific campaign record
 * 
 * @param {Object} campaign - The NotificationCampaign document
 * @returns {Promise<Object>} Execution result report
 */
async function executeNotificationDispatch(campaign) {
  const targetSessions = await resolveTargetSessions(
    campaign.targetAudience,
    campaign.targetCriteria
  );

  const report = await sendPushToSessions(targetSessions, {
    title: campaign.title,
    body: campaign.body,
    route: campaign.route || "/",
    imageUrl: campaign.imageUrl || null,
    data: {
      sender: campaign.sentByRegistrationNumber || "system_scheduler",
      campaignId: campaign._id.toString(),
      scheduledFor: campaign.scheduledFor ? campaign.scheduledFor.toISOString() : null,
      dispatchedAt: new Date().toISOString(),
    },
  });

  const campaignStatus =
    report.failed === 0
      ? "accepted_by_provider"
      : report.accepted > 0
        ? "partially_failed"
        : "failed";

  campaign.targetCount = targetSessions.length;
  campaign.successCount = report.accepted;
  campaign.failureCount = report.failed;
  campaign.status = campaignStatus;
  campaign.providerSummary = {
    fcm: report.fcm,
    webpush: report.webpush,
    notes: report.providerNotes.join("; "),
  };
  campaign.deliveryErrors = report.errors.slice(0, 50);
  campaign.sentAt = new Date();
  await campaign.save();

  // Record audit log entry
  try {
    await AuditLog.create({
      actor: campaign.sentBy,
      actorRegistrationNumber: campaign.sentByRegistrationNumber,
      action: "SCHEDULED_NOTIFICATION_DISPATCHED",
      targetType: "NOTIFICATION",
      targetId: campaign._id,
      outcome: campaignStatus === "failed" ? "FAILURE" : "SUCCESS",
      summary: `Autonomous scheduler dispatched '${campaign.title}' to ${campaign.targetAudience} (${report.accepted} delivered, ${report.failed} failed)`,
      details: {
        campaignId: campaign._id,
        scheduledFor: campaign.scheduledFor,
        actualSentAt: campaign.sentAt,
        targetSessionsCount: targetSessions.length,
        accepted: report.accepted,
        failed: report.failed,
      },
    });
  } catch (auditErr) {
    console.warn("[NotificationScheduler] AuditLog record failed:", auditErr.message);
  }

  return { success: true, accepted: report.accepted, failed: report.failed, status: campaignStatus };
}

/**
 * Heartbeat polling loop: claims and dispatches all due scheduled notifications
 */
async function checkAndDispatchScheduledNotifications() {
  try {
    const now = new Date();

    // Find campaigns due for dispatch
    const dueCampaigns = await NotificationCampaign.find({
      deliveryType: "SCHEDULED",
      status: "scheduled",
      scheduledFor: { $lte: now },
    }).sort({ scheduledFor: 1 }).limit(10);

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return;
    }

    console.log(`⏰ [NotificationScheduler] Found ${dueCampaigns.length} scheduled notification(s) due for dispatch.`);

    for (const campaign of dueCampaigns) {
      // Atomic claim to strictly prevent duplicate dispatches in concurrent environments
      const claimed = await NotificationCampaign.findOneAndUpdate(
        { _id: campaign._id, status: "scheduled" },
        { $set: { status: "processing" } },
        { new: true }
      );

      if (!claimed) {
        continue; // Already claimed by another worker tick
      }

      console.log(`🚀 [NotificationScheduler] Dispatching scheduled alert: "${claimed.title}" (ID: ${claimed._id})...`);
      try {
        await executeNotificationDispatch(claimed);
        console.log(`✅ [NotificationScheduler] Successfully dispatched alert: "${claimed.title}"`);
      } catch (dispatchErr) {
        console.error(`❌ [NotificationScheduler] Error dispatching alert ${claimed._id}:`, dispatchErr);
        claimed.status = "failed";
        claimed.providerSummary = {
          fcm: { attempted: 0, accepted: 0, failed: 0 },
          webpush: { attempted: 0, accepted: 0, failed: 0 },
          notes: dispatchErr.message,
        };
        await claimed.save();
      }
    }
  } catch (err) {
    console.error("[NotificationScheduler] Poll error:", err.message);
  }
}

/**
 * Starts the notification scheduler daemon
 */
function startNotificationScheduler() {
  if (schedulerInterval) {
    return;
  }

  console.log("⏰ [NotificationScheduler] Background notification scheduler daemon started (15s heartbeat).");

  // Run initial poll
  checkAndDispatchScheduledNotifications().catch(() => {});

  // Polling heartbeat every 15 seconds
  schedulerInterval = setInterval(() => {
    checkAndDispatchScheduledNotifications().catch((err) => {
      console.error("[NotificationScheduler] Heartbeat poll error:", err.message);
    });
  }, 15000);
}

/**
 * Stops the notification scheduler daemon
 */
function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[NotificationScheduler] Scheduler daemon stopped.");
  }
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  checkAndDispatchScheduledNotifications,
  resolveTargetSessions,
  executeNotificationDispatch,
};
