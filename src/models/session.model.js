const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    registrationNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    deviceNickname: {
      type: String,
      default: "Personal Device",
      trim: true,
      maxlength: 80,
    },

    installationId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    deviceType: {
      type: String,
      enum: ["android", "browser", "desktop", "unknown"],
      default: "unknown",
      index: true,
    },

    os: {
      type: String,
      default: "Unknown OS",
      trim: true,
    },

    browser: {
      type: String,
      default: "Unknown Browser",
      trim: true,
    },

    userAgent: {
      type: String,
      default: "",
      maxlength: 512,
    },

    ip: {
      type: String,
      default: "Unknown IP",
      trim: true,
    },

    // Push notification registration (Android FCM or Web Push)
    pushProvider: {
      type: String,
      enum: ["fcm", "webpush", "none"],
      default: "none",
    },

    pushToken: {
      type: String,
      default: null,
      select: false, // Protected from generic queries
    },

    webPushSubscription: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false, // Protected from generic queries
    },

    pushRegisteredAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: String,
      default: null, // "user" | "admin:<id>" | "system_limit"
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    loginAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ userId: 1, lastActivityAt: -1 });

module.exports = mongoose.model("Session", sessionSchema);
