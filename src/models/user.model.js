const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },

    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: function () {
        return this.isActivated === true;
      },
    },

    role: {
      type: String,
      enum: [
        "student",
        "caretaker",
        "warden",
        "superintendent",
        "chiefHostelWarden",
        "superadmin",
      ],
      required: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    hostel: {
      type: String,
      required: true,
      trim: true,
    },

    roomNumber: {
      type: String,
      default: null,
      trim: true,
    },

    profilePhoto: {
      type: String,
      default: "",
    },

    isActivated: {
      type: Boolean,
      default: false,
    },

    accountStatus: {
      type: String,
      enum: ["active", "deactivated", "suspended"],
      default: "active",
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    sessionsRevokedAt: {
      type: Date,
      default: null,
    },

    maxDevices: {
      type: Number,
      default: null,
      min: 1,
      max: 50,
    },

    activationToken: {
      type: String,
      default: null,
      select: false,
    },

    activationTokenExpiresAt: {
      type: Date,
      default: null,
    },

    // Temporary Sub-Admin Delegation tracking
    isDelegatedSubAdmin: {
      type: Boolean,
      default: false,
    },
    delegationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delegation",
      default: null,
    },
    delegatedRole: {
      type: String,
      enum: ["superadmin", null],
      default: null,
    },
    delegationTitle: {
      type: String,
      default: null,
    },
    delegationScopes: {
      type: [String],
      default: [],
    },
    delegationExpiresAt: {
      type: Date,
      default: null,
    },
    delegationIndefinite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ hostel: 1 });

module.exports = mongoose.model("User", userSchema);