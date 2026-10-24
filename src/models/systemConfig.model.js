const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },

    maxConcurrentSessions: {
      type: Number,
      default: 3,
      min: 1,
      max: 20,
    },

    maxRegisteredDevices: {
      type: Number,
      default: 5,
      min: 1,
      max: 50,
    },

    requireDeviceApproval: {
      type: Boolean,
      default: false,
    },

    revokeOldestOnLimit: {
      type: Boolean,
      default: true,
    },

    sessionInactivityTimeoutMinutes: {
      type: Number,
      default: 10080, // 7 days
      min: 15,
      max: 43200, // 30 days
    },

    updatedBy: {
      type: String,
      default: "system",
    },

    maintenance: {
      global: {
        enabled: { type: Boolean, default: false },
        title: {
          type: String,
          default: "System Maintenance in Progress",
          maxlength: 120,
          trim: true,
        },
        message: {
          type: String,
          default: "HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.",
          maxlength: 1000,
          trim: true,
        },
        plannedStart: { type: Date, default: null },
        plannedEnd: { type: Date, default: null },
      },
      selective: {
        enabled: { type: Boolean, default: false },
        title: {
          type: String,
          default: "Service Temporarily Unavailable",
          maxlength: 120,
          trim: true,
        },
        message: {
          type: String,
          default: "Access for your account or user group is currently paused for scheduled system maintenance.",
          maxlength: 1000,
          trim: true,
        },
        affectedRoles: {
          type: [String],
          default: ["student"],
        },
        affectedRegistrationNumbers: {
          type: [String],
          default: [],
        },
        plannedStart: { type: Date, default: null },
        plannedEnd: { type: Date, default: null },
      },
    },

    appVersion: {
      latestVersion: {
        type: String,
        default: "1.0.0",
        trim: true,
      },
      minimumSupportedVersion: {
        type: String,
        default: "1.0.0",
        trim: true,
      },
      updateMessage: {
        type: String,
        default: "A new version of HostelCare is available. Please update to enjoy the latest features and security improvements.",
        maxlength: 1000,
        trim: true,
      },
      updateUrl: {
        type: String,
        default: "https://play.google.com/store/apps/details?id=com.hostelcare.app",
        trim: true,
      },
      forceUpdate: {
        type: Boolean,
        default: false,
      },
      isSuspended: {
        type: Boolean,
        default: false,
      },
      suspendedReason: {
        type: String,
        default: "",
        maxlength: 500,
        trim: true,
      },
      releaseNotes: {
        type: String,
        default: "",
        maxlength: 10000,
        trim: true,
      },
      releaseMedia: {
        type: [String],
        default: [],
      },
      apkSha256: {
        type: String,
        default: "",
        maxlength: 128,
        trim: true,
      },
      targetAudience: {
        type: String,
        enum: ["all", "specific"],
        default: "all",
      },
      targetedRegistrationNumbers: {
        type: [String],
        default: [],
      },
      targetedRoles: {
        type: [String],
        default: [],
      },
      targetedHostels: {
        type: [String],
        default: [],
      },
    },

    pilotTesting: {
      enabled: {
        type: Boolean,
        default: false,
      },
      isSuspended: {
        type: Boolean,
        default: false,
      },
      suspendedReason: {
        type: String,
        default: "",
        maxlength: 500,
        trim: true,
      },
      version: {
        type: String,
        default: "1.2.2.5",
        trim: true,
      },
      updateMessage: {
        type: String,
        default: "You have been selected for the HostelCare Pilot Beta Program! Please update to test the newest features.",
        maxlength: 1000,
        trim: true,
      },
      updateUrl: {
        type: String,
        default: "https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.5/hostelcare-v1.2.2.5.apk",
        trim: true,
      },
      forceUpdate: {
        type: Boolean,
        default: false,
      },
      releaseNotes: {
        type: String,
        default: "",
        maxlength: 10000,
        trim: true,
      },
      releaseMedia: {
        type: [String],
        default: [],
      },
      apkSha256: {
        type: String,
        default: "",
        maxlength: 128,
        trim: true,
      },
      targetedRegistrationNumbers: {
        type: [String],
        default: [],
      },
    },
    messNotificationConfig: {
      enabled: {
        type: Boolean,
        default: true,
      },
      workingDays: {
        breakfast: {
          startHour: { type: Number, default: 7 },
          startMinute: { type: Number, default: 0 },
          timing: { type: String, default: "07:00 AM – 09:15 AM" },
        },
        lunch: {
          startHour: { type: Number, default: 12 },
          startMinute: { type: Number, default: 30 },
          timing: { type: String, default: "12:30 PM – 02:30 PM" },
        },
        snacks: {
          startHour: { type: Number, default: 17 },
          startMinute: { type: Number, default: 45 },
          timing: { type: String, default: "05:45 PM – 07:30 PM" },
        },
        dinner: {
          startHour: { type: Number, default: 20 },
          startMinute: { type: Number, default: 30 },
          timing: { type: String, default: "08:30 PM – 10:00 PM" },
        },
      },
      sundayAndHolidays: {
        breakfast: {
          startHour: { type: Number, default: 8 },
          startMinute: { type: Number, default: 0 },
          timing: { type: String, default: "08:00 AM – 10:00 AM" },
        },
        lunch: {
          startHour: { type: Number, default: 12 },
          startMinute: { type: Number, default: 30 },
          timing: { type: String, default: "12:30 PM – 02:30 PM" },
        },
        snacks: {
          startHour: { type: Number, default: 17 },
          startMinute: { type: Number, default: 30 },
          timing: { type: String, default: "05:30 PM – 07:00 PM" },
        },
        dinner: {
          startHour: { type: Number, default: 20 },
          startMinute: { type: Number, default: 30 },
          timing: { type: String, default: "08:30 PM – 10:00 PM" },
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

systemConfigSchema.statics.getEffectiveConfig = async function () {
  let config = await this.findOne({ key: "default" });
  if (!config) {
    config = await this.create({ key: "default" });
  }
  return config;
};

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
