const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    adminRegistrationNumber: {
      type: String,
      required: true,
      index: true,
    },

    adminName: {
      type: String,
      default: "",
    },

    action: {
      type: String,
      required: true,
      index: true,
      enum: [
        "PROFILE_UPDATE",
        "ACCOUNT_ACTIVATED",
        "ACCOUNT_DEACTIVATED",
        "ACCOUNT_SUSPENDED",
        "PASSWORD_RESET",
        "SESSION_REVOKED",
        "SESSIONS_REVOKED_ALL",
        "LOGIN_LIMITS_UPDATED",
        "NOTIFICATION_SENT",
        "ROLE_CHANGE",
        "SUPERADMIN_CREATED",
        "USER_PROVISIONED",
        "DEVICE_LIMIT_UPDATED",
        "MAINTENANCE_MODE_UPDATED",
        "USER_IMPERSONATED",
      ],
    },

    targetType: {
      type: String,
      enum: ["USER", "SESSION", "DEVICE", "SYSTEM_CONFIG", "NOTIFICATION"],
      required: true,
    },

    targetId: {
      type: String,
      default: "",
      index: true,
    },

    targetIdentifier: {
      type: String,
      default: "", // e.g. registrationNumber or device name
    },

    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      default: "SUCCESS",
    },

    summary: {
      type: String,
      required: true,
      maxlength: 500,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ip: {
      type: String,
      default: "Unknown",
    },

    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
