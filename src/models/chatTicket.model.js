const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * ChatTicket Schema
 * Real-time Student <-> Developer Support Ticket with E2EE Room Key Exchange.
 */
const chatTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentRegNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentHostel: {
      type: String,
      default: "BH-1",
      trim: true,
    },
    studentRoom: {
      type: String,
      default: "",
      trim: true,
    },
    developer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    developerName: {
      type: String,
      required: true,
      trim: true,
    },
    developerRole: {
      type: String,
      default: "superadmin",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: ["Bug Report", "Feature Request", "Technical Help", "UI/UX Suggestion", "Account & Access", "Other"],
      default: "Technical Help",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    e2eeSalt: {
      type: String,
      required: true,
      default: () => crypto.randomBytes(16).toString("hex"),
    },
    lastMessage: {
      preview: { type: String, default: "Conversation started" },
      senderRole: { type: String, default: "system" },
      senderName: { type: String, default: "System" },
      at: { type: Date, default: Date.now },
    },
    unreadStudent: {
      type: Number,
      default: 0,
    },
    unreadDeveloper: {
      type: Number,
      default: 1,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    rating: {
      score: { type: Number, min: 1, max: 5 },
      feedback: { type: String, maxlength: 500 },
      givenAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Helper to generate unique ticket ID (format: TKT-XXXXXX)
chatTicketSchema.statics.generateTicketId = async function () {
  let isUnique = false;
  let tktId = "";
  while (!isUnique) {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    tktId = `TKT-${randomHex}`;
    const exists = await this.findOne({ ticketId: tktId }).lean();
    if (!exists) {
      isUnique = true;
    }
  }
  return tktId;
};

module.exports = mongoose.model("ChatTicket", chatTicketSchema);
