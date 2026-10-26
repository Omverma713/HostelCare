const mongoose = require("mongoose");

const delegationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    originalRole: {
      type: String,
      required: true,
      trim: true,
    },
    delegatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    delegatedByRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      default: "Acting Sub-Admin",
      trim: true,
    },
    scopes: {
      type: [String],
      default: ["all"],
    },
    durationMode: {
      type: String,
      enum: ["24h", "3d", "7d", "30d", "custom", "indefinite"],
      default: "indefinite",
    },
    isIndefinite: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
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
      default: null,
    },
    revocationReason: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

delegationSchema.index({ status: 1, expiresAt: 1 });
delegationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("Delegation", delegationSchema);
