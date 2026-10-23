const mongoose = require("mongoose");

const notificationCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    targetAudience: {
      type: String,
      enum: ["SINGLE_DEVICE", "SINGLE_USER", "ROLE_GROUP", "HOSTEL_GROUP", "ALL_DEVICES"],
      required: true,
    },

    targetCriteria: {
      sessionId: { type: String, default: null },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      registrationNumber: { type: String, default: null },
      role: { type: String, default: null },
      hostel: { type: String, default: null },
    },

    route: {
      type: String,
      default: "/",
      trim: true,
      maxlength: 150,
    },

    imageUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sentByRegistrationNumber: {
      type: String,
      required: true,
    },

    targetCount: {
      type: Number,
      default: 0,
    },

    successCount: {
      type: Number,
      default: 0,
    },

    failureCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "queued",
        "attempted",
        "accepted_by_provider",
        "failed",
        "partially_failed",
      ],
      default: "attempted",
    },

    providerSummary: {
      fcm: { attempted: { type: Number, default: 0 }, accepted: { type: Number, default: 0 }, failed: { type: Number, default: 0 } },
      webpush: { attempted: { type: Number, default: 0 }, accepted: { type: Number, default: 0 }, failed: { type: Number, default: 0 } },
      notes: { type: String, default: "" },
    },

    deliveryErrors: [
      {
        provider: String,
        recipient: String,
        error: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],

    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationCampaignSchema.index({ sentAt: -1 });
notificationCampaignSchema.index({ targetAudience: 1, sentAt: -1 });

module.exports = mongoose.model("NotificationCampaign", notificationCampaignSchema);
