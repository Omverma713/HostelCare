const ChatTicket = require("../models/chatTicket.model");
const ChatMessage = require("../models/chatMessage.model");
const User = require("../models/user.model");

/**
 * POST /api/v1/chat/tickets
 * Creates a new support ticket and automatically assigns a developer (SuperAdmin)
 */
async function createTicket(req, res) {
  try {
    const student = req.user;
    const { subject, category = "Technical Help", priority = "medium", initialEncryptedMessage, iv } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required to open a support ticket.",
      });
    }

    // 1. Allot Developer (Super Admin)
    const developers = await User.find({
      role: "superadmin",
      accountStatus: { $ne: "deactivated" },
    }).select("_id name role");

    let allottedDev = null;
    if (developers.length > 0) {
      // Randomly allocate among available developers / superadmins
      const randomIndex = Math.floor(Math.random() * developers.length);
      allottedDev = developers[randomIndex];
    } else {
      // Fallback: search for any staff user
      allottedDev = await User.findOne({ role: { $in: ["superadmin", "superintendent"] } });
    }

    if (!allottedDev) {
      allottedDev = {
        _id: student.id || student._id,
        name: "Lead System Developer",
        role: "superadmin",
      };
    }

    // 2. Generate unique TKT-XXXXXX ID
    const ticketId = await ChatTicket.generateTicketId();

    const ticket = await ChatTicket.create({
      ticketId,
      student: student.id || student._id,
      studentName: student.name || "Student",
      studentRegNo: student.registrationNumber || "UNKNOWN",
      studentHostel: student.hostel || "BH-1",
      studentRoom: student.roomNumber || "",
      developer: allottedDev._id,
      developerName: allottedDev.name || "Dev Support",
      developerRole: allottedDev.role || "superadmin",
      subject: subject.trim(),
      category,
      priority,
      status: "open",
      unreadStudent: 0,
      unreadDeveloper: 1,
      lastMessage: {
        preview: "New ticket opened",
        senderRole: student.role || "student",
        senderName: student.name || "Student",
        at: new Date(),
      },
    });

    // 3. Create initial encrypted message if provided
    if (initialEncryptedMessage && iv) {
      await ChatMessage.create({
        ticketId,
        sender: student.id || student._id,
        senderRole: student.role || "student",
        senderName: student.name || "Student",
        encryptedContent: initialEncryptedMessage,
        iv,
        contentType: "text",
        read: false,
      });

      ticket.lastMessage.preview = "Initial message sent";
      await ticket.save();
    }

    return res.status(201).json({
      success: true,
      message: `Support ticket ${ticketId} created and developer ${ticket.developerName} assigned.`,
      ticket,
    });
  } catch (error) {
    console.error("createTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create support ticket",
      error: error.message,
    });
  }
}

/**
 * GET /api/v1/chat/tickets
 * Lists tickets for the authenticated user (students see own tickets, developers see all)
 */
async function getTickets(req, res) {
  try {
    const user = req.user;
    const isDeveloper = user.role === "superadmin";
    const { status, search } = req.query;

    const query = {};
    if (!isDeveloper) {
      // Students see only their own tickets
      query.student = user.id || user._id;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { ticketId: regex },
        { subject: regex },
        { studentName: regex },
        { studentRegNo: regex },
      ];
    }

    const tickets = await ChatTicket.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    console.error("getTickets error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
      error: error.message,
    });
  }
}

/**
 * GET /api/v1/chat/tickets/:ticketId
 * Retrieves ticket details
 */
async function getTicketById(req, res) {
  try {
    const { ticketId } = req.params;
    const user = req.user;

    const ticket = await ChatTicket.findOne({ ticketId }).lean();
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Ticket ${ticketId} not found.`,
      });
    }

    const isStudent = String(ticket.student) === String(user.id || user._id);
    const isDeveloper = user.role === "superadmin";

    if (!isStudent && !isDeveloper) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not a participant on this ticket.",
      });
    }

    return res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("getTicketById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket details",
      error: error.message,
    });
  }
}

/**
 * GET /api/v1/chat/tickets/:ticketId/messages
 * Retrieves encrypted chat history for a ticket and marks messages as read
 */
async function getTicketMessages(req, res) {
  try {
    const { ticketId } = req.params;
    const user = req.user;

    const ticket = await ChatTicket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Ticket ${ticketId} not found.`,
      });
    }

    const isStudent = String(ticket.student) === String(user.id || user._id);
    const isDeveloper = user.role === "superadmin";

    if (!isStudent && !isDeveloper) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You cannot read messages from this ticket.",
      });
    }

    const messages = await ChatMessage.find({ ticketId })
      .sort({ createdAt: 1 })
      .lean();

    // Reset unread counters on ticket
    if (isStudent && ticket.unreadStudent > 0) {
      ticket.unreadStudent = 0;
      await ticket.save();
      await ChatMessage.updateMany(
        { ticketId, senderRole: { $ne: "student" }, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
    } else if (isDeveloper && ticket.unreadDeveloper > 0) {
      ticket.unreadDeveloper = 0;
      await ticket.save();
      await ChatMessage.updateMany(
        { ticketId, senderRole: "student", read: false },
        { $set: { read: true, readAt: new Date() } }
      );
    }

    return res.status(200).json({
      success: true,
      ticketId,
      e2eeSalt: ticket.e2eeSalt,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("getTicketMessages error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat messages",
      error: error.message,
    });
  }
}

/**
 * PATCH /api/v1/chat/tickets/:ticketId/status
 * Updates status of the ticket (open, in_progress, resolved, closed)
 */
async function updateTicketStatus(req, res) {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const user = req.user;

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const ticket = await ChatTicket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Ticket ${ticketId} not found.`,
      });
    }

    const isStudent = String(ticket.student) === String(user.id || user._id);
    const isDeveloper = user.role === "superadmin";

    if (!isStudent && !isDeveloper) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Not authorized to modify this ticket.",
      });
    }

    ticket.status = status;
    if (status === "resolved" || status === "closed") {
      ticket.resolvedAt = new Date();
    }
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket ${ticketId} status updated to ${status}.`,
      ticket,
    });
  } catch (error) {
    console.error("updateTicketStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update ticket status",
      error: error.message,
    });
  }
}

/**
 * POST /api/v1/chat/tickets/:ticketId/rating
 * Student rates the resolution of their ticket
 */
async function rateTicket(req, res) {
  try {
    const { ticketId } = req.params;
    const { score, feedback } = req.body;
    const user = req.user;

    const ticket = await ChatTicket.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    if (String(ticket.student) !== String(user.id || user._id)) {
      return res.status(403).json({ success: false, message: "Only the ticket owner can submit a rating." });
    }

    ticket.rating = {
      score: Math.max(1, Math.min(5, Number(score) || 5)),
      feedback: feedback ? String(feedback).slice(0, 500) : "",
      givenAt: new Date(),
    };
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Thank you for rating your developer support experience!",
      ticket,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  getTicketMessages,
  updateTicketStatus,
  rateTicket,
};
