const mongoose = require("mongoose");

const deviceRegistrySchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    userRole: {
      type: String,
      default: "student",
      index: true,
    },
    studentName: {
      type: String,
      trim: true,
      default: "",
    },
    regNo: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    hostelBlock: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    roomNumber: {
      type: String,
      trim: true,
      default: "",
    },
    pushToken: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web", "unknown"],
      default: "android",
      index: true,
    },
    pushProvider: {
      type: String,
      enum: ["fcm", "webpush", "none"],
      default: "fcm",
    },
    webPushSubscription: {
      endpoint: { type: String, default: null },
      expirationTime: { type: Number, default: null },
      keys: {
        p256dh: { type: String, default: null },
        auth: { type: String, default: null },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    appVersion: {
      type: String,
      default: "1.0.0",
    },
    hardwareModel: {
      type: String,
      default: "Android Device",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Fast compound indexing for targeted broadcasts and radars
deviceRegistrySchema.index({ isActive: 1, platform: 1 });
deviceRegistrySchema.index({ isActive: 1, hostelBlock: 1 });
deviceRegistrySchema.index({ isActive: 1, userRole: 1 });

const DeviceRegistry = mongoose.model("DeviceRegistry", deviceRegistrySchema);

module.exports = DeviceRegistry;
