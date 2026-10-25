const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ChatTicket = require("../models/chatTicket.model");
const ChatMessage = require("../models/chatMessage.model");

let ioInstance = null;

/**
 * Initializes Socket.IO with CORS, JWT handshake authentication,
 * and real-time room messaging for Chat Tickets.
 */
// Global active user socket tracking: userId -> Set<socketId>
const activeUsers = new Map();

function isUserOnline(userId) {
  const set = activeUsers.get(String(userId));
  return Boolean(set && set.size > 0);
}

/**
 * Initializes Socket.IO with CORS, JWT handshake authentication,
 * and real-time room messaging for Chat Tickets.
 */
function initChatSocket(httpServer) {
  if (ioInstance) {
    return ioInstance;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT"],
      credentials: true,
    },
    maxHttpBufferSize: 15e6, // 15 MB for image/media transfers
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // 1. Socket Authentication Handshake Middleware
  io.use(async (socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!rawToken) {
        return next(new Error("Authentication token required for real-time chat"));
      }

      const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error("Invalid authentication token"));
      }

      const user = await User.findById(decoded.id).select("_id name role registrationNumber").lean();
      if (!user) {
        return next(new Error("User account not found"));
      }

      socket.user = {
        id: String(user._id),
        name: user.name,
        role: user.role,
        registrationNumber: user.registrationNumber,
      };

      next();
    } catch (err) {
      next(new Error(`Socket authentication failed: ${err.message}`));
    }
  });

  // 2. Connection and Event Handling
  io.on("connection", (socket) => {
    const user = socket.user;
    const userIdStr = String(user.id);

    console.log(`🔌 [ChatSocket] User connected: ${user.name} (${user.role}) - Socket: ${socket.id}`);

    // Register user in active connections pool
    if (!activeUsers.has(userIdStr)) {
      activeUsers.set(userIdStr, new Set());
    }
    activeUsers.get(userIdStr).add(socket.id);

    // Join user-specific notification room
    socket.join(`user_${user.id}`);

    /**
     * join_ticket: Student or Developer joins a specific ticket room
     */
    socket.on("join_ticket", async ({ ticketId }) => {
      try {
        if (!ticketId) return;

        const ticket = await ChatTicket.findOne({ ticketId }).lean();
        if (!ticket) {
          return socket.emit("error_message", { message: `Ticket ${ticketId} not found` });
        }

        const isStudent = String(ticket.student) === String(user.id);
        const isDeveloper = user.role === "superadmin";

        if (!isStudent && !isDeveloper) {
          return socket.emit("error_message", { message: "Unauthorized to join this ticket chat" });
        }

        const roomName = `ticket_${ticketId}`;
        socket.join(roomName);

        const partnerId = isStudent ? String(ticket.developer) : String(ticket.student);
        const partnerOnline = isUserOnline(partnerId);

        // Immediate direct acknowledgement to joining user with live partner status
        socket.emit("joined_ticket", {
          ticketId,
          status: ticket.status,
          e2eeSalt: ticket.e2eeSalt,
          partnerOnline,
          partnerId,
          partnerName: isStudent ? ticket.developerName : ticket.studentName,
        });

        // Broadcast to ticket room that user is online
        socket.to(roomName).emit("user_presence", {
          ticketId,
          userId: user.id,
          userName: user.name,
          role: user.role,
          status: "online",
        });

        // Also notify partner directly in their personal user room
        io.to(`user_${partnerId}`).emit("user_presence", {
          ticketId,
          userId: user.id,
          userName: user.name,
          role: user.role,
          status: "online",
        });
      } catch (err) {
        socket.emit("error_message", { message: err.message });
      }
    });

    /**
     * leave_ticket: Leaves ticket room
     */
    socket.on("leave_ticket", ({ ticketId }) => {
      if (ticketId) {
        const roomName = `ticket_${ticketId}`;
        socket.leave(roomName);
        socket.to(roomName).emit("user_presence", {
          ticketId,
          userId: user.id,
          userName: user.name,
          role: user.role,
          status: "offline",
        });
      }
    });

    /**
     * send_message: Receives E2EE encrypted message, persists to MongoDB, broadcasts to room & user channels
     */
    socket.on("send_message", async (data, ack) => {
      try {
        const { ticketId, encryptedContent, iv, authTag, contentType = "text" } = data;

        if (!ticketId || !encryptedContent || !iv) {
          if (ack) ack({ success: false, error: "Missing required encrypted message payload" });
          return;
        }

        const ticket = await ChatTicket.findOne({ ticketId });
        if (!ticket) {
          if (ack) ack({ success: false, error: "Ticket not found" });
          return;
        }

        const isStudent = String(ticket.student) === String(user.id);
        const isDeveloper = user.role === "superadmin";

        if (!isStudent && !isDeveloper) {
          if (ack) ack({ success: false, error: "Unauthorized to send messages in this ticket" });
          return;
        }

        // Create persistent encrypted message record
        const msg = await ChatMessage.create({
          ticketId,
          sender: user.id,
          senderRole: user.role,
          senderName: user.name,
          encryptedContent,
          iv,
          authTag: authTag || "",
          contentType,
          read: false,
        });

        // Update ticket preview & unread counts
        ticket.lastMessage = {
          preview: "Encrypted Message",
          senderRole: user.role,
          senderName: user.name,
          at: new Date(),
        };

        if (isStudent) {
          ticket.unreadDeveloper = (ticket.unreadDeveloper || 0) + 1;
        } else {
          ticket.unreadStudent = (ticket.unreadStudent || 0) + 1;
        }

        if (ticket.status === "open" && isDeveloper) {
          ticket.status = "in_progress";
        }

        await ticket.save();

        const broadcastPayload = {
          _id: msg._id,
          ticketId: msg.ticketId,
          sender: msg.sender,
          senderRole: msg.senderRole,
          senderName: msg.senderName,
          encryptedContent: msg.encryptedContent,
          iv: msg.iv,
          authTag: msg.authTag,
          contentType: msg.contentType,
          read: msg.read,
          createdAt: msg.createdAt,
        };

        const roomName = `ticket_${ticketId}`;
        const targetUserId = isStudent ? String(ticket.developer) : String(ticket.student);

        // 1. Broadcast to ticket room (for anyone actively viewing ticket)
        io.to(roomName).emit("new_message", broadcastPayload);

        // 2. ALSO broadcast directly to target user room (guarantees instant delivery even if target was in list view!)
        io.to(`user_${targetUserId}`).emit("new_message", broadcastPayload);

        // 3. Emit ticket activity for real-time list badge updates
        io.to(`user_${targetUserId}`).emit("ticket_activity", {
          ticketId,
          lastMessage: ticket.lastMessage,
          unreadCount: isStudent ? ticket.unreadDeveloper : ticket.unreadStudent,
        });

        if (ack) ack({ success: true, messageId: msg._id, message: broadcastPayload });
      } catch (err) {
        console.error("send_message socket error:", err);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    /**
     * typing_start & typing_stop: Real-time typing indicators
     */
    socket.on("typing_start", async ({ ticketId }) => {
      if (!ticketId) return;
      const roomName = `ticket_${ticketId}`;
      const typingPayload = {
        ticketId,
        userId: user.id,
        userName: user.name,
        role: user.role,
        isTyping: true,
      };
      socket.to(roomName).emit("typing_change", typingPayload);

      // Also deliver to partner user channel
      try {
        const ticket = await ChatTicket.findOne({ ticketId }).select("student developer").lean();
        if (ticket) {
          const targetUserId = String(ticket.student) === String(user.id) ? String(ticket.developer) : String(ticket.student);
          socket.to(`user_${targetUserId}`).emit("typing_change", typingPayload);
        }
      } catch (e) {
        // pass
      }
    });

    socket.on("typing_stop", async ({ ticketId }) => {
      if (!ticketId) return;
      const roomName = `ticket_${ticketId}`;
      const typingPayload = {
        ticketId,
        userId: user.id,
        userName: user.name,
        role: user.role,
        isTyping: false,
      };
      socket.to(roomName).emit("typing_change", typingPayload);

      try {
        const ticket = await ChatTicket.findOne({ ticketId }).select("student developer").lean();
        if (ticket) {
          const targetUserId = String(ticket.student) === String(user.id) ? String(ticket.developer) : String(ticket.student);
          socket.to(`user_${targetUserId}`).emit("typing_change", typingPayload);
        }
      } catch (e) {
        // pass
      }
    });

    /**
     * mark_read: Marks messages as read in real-time
     */
    socket.on("mark_read", async ({ ticketId }) => {
      try {
        if (!ticketId) return;
        await ChatMessage.updateMany(
          { ticketId, sender: { $ne: user.id }, read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        socket.to(`ticket_${ticketId}`).emit("messages_read", {
          ticketId,
          readBy: user.id,
        });
      } catch (err) {
        console.error("mark_read socket error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 [ChatSocket] User disconnected: ${user.name}`);
      if (activeUsers.has(userIdStr)) {
        const set = activeUsers.get(userIdStr);
        set.delete(socket.id);
        if (set.size === 0) {
          activeUsers.delete(userIdStr);
          io.emit("user_presence", {
            userId: user.id,
            userName: user.name,
            role: user.role,
            status: "offline",
          });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

function getChatIO() {
  return ioInstance;
}

module.exports = {
  initChatSocket,
  getChatIO,
};
