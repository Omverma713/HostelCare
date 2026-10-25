const mongoose = require("mongoose");

/**
 * ChatMessage Schema
 * Stores End-to-End Encrypted (E2EE) messages for ChatTicket.
 * Raw message content is NEVER stored as plaintext on the server.
 */
const chatMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
      enum: ["student", "superadmin", "caretaker", "warden", "superintendent", "system"],
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    encryptedContent: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      default: "",
    },
    contentType: {
      type: String,
      enum: ["text", "code", "system"],
      default: "text",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast timeline queries within a ticket
chatMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
