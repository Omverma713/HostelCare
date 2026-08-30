const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ["visitor", "student", "caretaker", "warden", "superintendent", "chiefHostelWarden"],
      default: "visitor",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    category: {
      type: String,
      enum: [
        "Suggestion",
        "Bug Report",
        "Feature Request",
        "Hostel Experience",
        "App UI/UX",
        "General Inquiry",
        "Other"
      ],
      default: "Suggestion",
    },
    subject: {
      type: String,
      trim: true,
      default: "General Feedback",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "resolved"],
      default: "new",
    },
    ipAddress: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
