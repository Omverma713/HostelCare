const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
      required: true,
    },

    role: {
      type: String,
      enum: [
        "student",
        "caretaker",
        "warden",
        "superintendent",
        "chiefHostelWarden",
      ],
      required: true,
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);