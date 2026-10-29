const mongoose = require("mongoose");

const cbtApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hostel: {
      type: String,
      default: "",
      trim: true,
    },
    room: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },

    // Application details
    deviceModel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    androidVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    feedbackComfort: {
      type: String,
      default: "Very Comfortable",
      trim: true,
    },

    // Status & Review
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    reviewedBy: {
      type: String,
      default: "",
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },

    betaVersion: {
      type: String,
      default: "1.2.2.13",
      trim: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent multiple applications per user for the same beta version
cbtApplicationSchema.index({ userId: 1, betaVersion: 1 }, { unique: true });

module.exports = mongoose.model("CbtApplication", cbtApplicationSchema);
