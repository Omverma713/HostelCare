const mongoose = require("mongoose");

const globalNoticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    priority: {
      type: String,
      enum: ["info", "warning", "urgent"],
      default: "urgent",
    },
    targetRole: {
      type: String,
      enum: ["ALL", "student", "caretaker", "warden", "superintendent"],
      default: "ALL",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      default: "Super Admin",
    },
  },
  {
    timestamps: true,
  }
);

globalNoticeSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("GlobalNotice", globalNoticeSchema);
