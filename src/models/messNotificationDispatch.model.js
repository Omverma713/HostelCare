const mongoose = require("mongoose");

/**
 * MessNotificationDispatch Schema
 * 
 * Persistent ledger for automated mess menu push notifications.
 * Enforces strict idempotency and distributed atomic claiming via unique MongoDB index.
 * 
 * Key format: `${dateStr}_${mealSlot}_${occurrence}` (e.g., "2026-10-25_breakfast_1")
 */
const messNotificationDispatchSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    mealSlot: {
      type: String,
      required: true,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
      index: true,
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
    },
    occurrence: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    status: {
      type: String,
      required: true,
      enum: ["claimed", "dispatched", "failed", "skipped", "no_devices"],
      default: "claimed",
      index: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    claimExpiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 3 * 60 * 1000), // 3-minute lock
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    targets: {
      type: Number,
      default: 0,
    },
    report: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    failureDetails: {
      type: String,
      default: null,
    },
    isManualTest: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically prune historical dispatch logs after 45 days
messNotificationDispatchSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 45 * 24 * 60 * 60 }
);

/**
 * Atomically claims a scheduled meal notification occurrence.
 * If already claimed, dispatched, or failed, returns null to guarantee single delivery.
 * 
 * @param {Object} params
 * @param {string} params.idempotencyKey
 * @param {string} params.mealSlot
 * @param {string} params.dateStr
 * @param {number} params.occurrence
 * @param {Date} params.scheduledFor
 * @returns {Promise<Object|null>} The claimed record or null if already exists
 */
messNotificationDispatchSchema.statics.claimOccurrence = async function ({
  idempotencyKey,
  mealSlot,
  dateStr,
  occurrence,
  scheduledFor,
}) {
  try {
    const claimExpiresAt = new Date(Date.now() + 3 * 60 * 1000);
    const doc = await this.create({
      idempotencyKey,
      mealSlot,
      dateStr,
      occurrence,
      status: "claimed",
      scheduledFor: scheduledFor || new Date(),
      claimedAt: new Date(),
      claimExpiresAt,
      isManualTest: false,
    });
    return doc;
  } catch (err) {
    if (err.code === 11000) {
      // Idempotency key already exists. Fetch existing record.
      const existing = await this.findOne({ idempotencyKey }).lean();
      if (!existing) return null;

      // If already dispatched, NEVER re-send!
      if (existing.status === "dispatched" || existing.status === "skipped") {
        return null;
      }

      // If still within active claim window, another process is working on it
      if (existing.status === "claimed" && existing.claimExpiresAt > new Date()) {
        return null;
      }

      // If claim expired without being dispatched (e.g. process crashed), atomically attempt re-claim
      const reclaimed = await this.findOneAndUpdate(
        {
          idempotencyKey,
          status: { $in: ["claimed", "failed"] },
          claimExpiresAt: { $lte: new Date() },
        },
        {
          $set: {
            status: "claimed",
            claimedAt: new Date(),
            claimExpiresAt: new Date(Date.now() + 3 * 60 * 1000),
          },
        },
        { new: true }
      );
      return reclaimed;
    }
    throw err;
  }
};

/**
 * Marks a claimed occurrence as successfully dispatched with delivery metrics.
 */
messNotificationDispatchSchema.statics.markDispatched = async function (idempotencyKey, { targets, report }) {
  return this.findOneAndUpdate(
    { idempotencyKey },
    {
      $set: {
        status: "dispatched",
        dispatchedAt: new Date(),
        targets: targets || 0,
        report: report || null,
      },
    },
    { new: true }
  );
};

/**
 * Marks a claimed occurrence as failed with error details.
 */
messNotificationDispatchSchema.statics.markFailed = async function (idempotencyKey, error) {
  const safeMessage = error?.message ? String(error.message).slice(0, 1000) : "Unknown error";
  return this.findOneAndUpdate(
    { idempotencyKey },
    {
      $set: {
        status: "failed",
        failureDetails: safeMessage,
      },
    },
    { new: true }
  );
};

module.exports = mongoose.model("MessNotificationDispatch", messNotificationDispatchSchema);
