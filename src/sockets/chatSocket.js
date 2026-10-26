const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ChatTicket = require("../models/chatTicket.model");
const ChatMessage = require("../models/chatMessage.model");
const SystemConfig = require("../models/systemConfig.model");
const Session = require("../models/session.model");
const { sendPushToSessions } = require("../services/pushService");

let ioInstance = null;

// Global active user socket tracking: userId -> Set<socketId>
const activeUsers = new Map();

function isUserOnline(userId) {
  const set = activeUsers.get(String(userId));
  return Boolean(set && set.size > 0);
}

/**
 * Dispatches Push Notifications (FCM / WebPush) if enabled in Super Admin settings
 */
async function dispatchDevChatPushNotification(ticket, msg, sender, contentType) {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const chatNotifConfig = config.devChatNotifications || {
      enabled: true,
      notifyStudent: true,
      notifySuperAdmin: true,
    };

    if (chatNotifConfig.enabled === false) {
      return; // Disabled by Super Admin
    }

    const isStudentSender = String(ticket.student) === String(sender.id);

    if (isStudentSender && chatNotifConfig.notifySuperAdmin === false) {
      return;
    }
    if (!isStudentSender && chatNotifConfig.notifyStudent === false) {
      return;
    }

    // Determine target user IDs & notification wording requested by user
    let targetUserIds = [];
    let notifBody = "";

    if (isStudentSender) {
      // Student sent message -> Super Admin receives: "You got a message from <name>"
      const superAdmins = await User.find({ role: "superadmin" }, "_id").lean();
      targetUserIds = superAdmins.map((sa) => String(sa._id));
      if (ticket.developer && !targetUserIds.includes(String(ticket.developer))) {
        targetUserIds.push(String(ticket.developer));
      }
      notifBody = `You got a message from ${sender.name || "Student"}`;
    } else {
      // Super Admin sent message -> Student receives: "You got the reply from Super Admin"
      targetUserIds = [String(ticket.student)];
      notifBody = "You got the reply from Super Admin";
    }

    // 1. Real-time Socket Event (triggers instant in-app toast and local Android notification)
    if (ioInstance) {
      const socketPayload = {
        title: "HostelCare Support",
        body: notifBody,
        ticketId: ticket.ticketId,
        senderName: sender.name,
        isStudentSender,
        createdAt: new Date().toISOString(),
      };

      targetUserIds.forEach((uid) => {
        ioInstance.to(`user_${uid}`).emit("chat_notification", socketPayload);
      });
    }

    // 2. Push Notification to registered mobile/desktop sessions (FCM & WebPush)
    const targetSessions = await Session.find({
      userId: { $in: targetUserIds },
      $or: [
        { pushToken: { $ne: null } },
        { webPushSubscription: { $ne: null } },
      ],
    }).lean();

    if (targetSessions.length > 0) {
      sendPushToSessions(targetSessions, {
        title: "HostelCare Support",
        body: notifBody,
        route: "/chat",
        data: {
          ticketId: ticket.ticketId,
          type: "chat_message",
          senderName: sender.name,
        },
      }).catch((err) => console.warn("Chat push notification notice:", err.message));
    }
  } catch (err) {
    console.warn("Error in dispatchDevChatPushNotification:", err.message);
  }
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

    // Auto-deliver any pending undelivered messages for this user
    (async () => {
      try {
        const userTickets = await ChatTicket.find({
          $or: [{ student: user.id }, { developer: user.id }]
        }).select("ticketId").lean();
        const ticketIds = userTickets.map((t) => t.ticketId);
        if (ticketIds.length > 0) {
          const undelivered = await ChatMessage.find({
            ticketId: { $in: ticketIds },
            sender: { $ne: user.id },
            delivered: false
          }).select("_id ticketId sender").lean();

          if (undelivered.length > 0) {
            const deliveredAt = new Date();
            await ChatMessage.updateMany(
              { _id: { $in: undelivered.map((m) => m._id) } },
              { $set: { delivered: true, deliveredAt } }
            );

            undelivered.forEach((m) => {
              const deliveryPayload = {
                messageId: m._id,
                ticketId: m.ticketId,
                deliveredAt: deliveredAt.toISOString()
              };
              io.to(`user_${m.sender}`).emit("message_delivered", deliveryPayload);
              io.to(`ticket_${m.ticketId}`).emit("message_delivered", deliveryPayload);
            });
          }
        }
      } catch (err) {
        console.warn("[ChatSocket] Connect delivery check error:", err.message);
      }
    })();

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
        const { ticketId, encryptedContent, iv, authTag, contentType = "text", mediaSize = 0 } = data;

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

        // Feature 3: Prevent students from sending messages on resolved tickets
        if (ticket.status === "resolved" && isStudent) {
          if (ack) {
            ack({
              success: false,
              error: "This ticket has been marked as resolved by Support. Please reopen the ticket to send messages."
            });
          }
          return;
        }

        const targetUserId = isStudent ? String(ticket.developer) : String(ticket.student);
        const isPartnerOnline = isUserOnline(targetUserId);
        const isDelivered = isPartnerOnline;
        const now = new Date();

        // Create persistent encrypted message record with delivery tracking
        const msg = await ChatMessage.create({
          ticketId,
          sender: user.id,
          senderRole: user.role,
          senderName: user.name,
          encryptedContent,
          iv,
          authTag: authTag || "",
          contentType,
          mediaSize: Number(mediaSize) || 0,
          delivered: isDelivered,
          deliveredAt: isDelivered ? now : null,
          read: false,
        });

        // Update ticket preview & unread counts
        ticket.lastMessage = {
          preview: contentType === "image" ? "📷 Image" : "Encrypted Message",
          senderRole: user.role,
          senderName: user.name,
          at: now,
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
          mediaSize: msg.mediaSize,
          isEdited: false,
          isDeleted: false,
          delivered: msg.delivered,
          deliveredAt: msg.deliveredAt,
          read: msg.read,
          createdAt: msg.createdAt,
        };

        const roomName = `ticket_${ticketId}`;

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

        // 4. Trigger Real-time Push Notification (FCM / WebPush)
        dispatchDevChatPushNotification(ticket, msg, user, contentType);

        if (ack) ack({ success: true, messageId: msg._id, message: broadcastPayload });
      } catch (err) {
        console.error("send_message socket error:", err);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    /**
     * edit_message: Student (own message) or Super Admin edits encrypted message content
     */
    socket.on("edit_message", async (data, ack) => {
      try {
        const { ticketId, messageId, encryptedContent, iv, authTag } = data;

        if (!ticketId || !messageId || !encryptedContent || !iv) {
          if (ack) ack({ success: false, error: "Missing required edit message payload" });
          return;
        }

        const msg = await ChatMessage.findById(messageId);
        if (!msg || msg.ticketId !== ticketId) {
          if (ack) ack({ success: false, error: "Message not found" });
          return;
        }

        if (msg.isDeleted) {
          if (ack) ack({ success: false, error: "Cannot edit a deleted message" });
          return;
        }

        const isSuperAdmin = user.role === "superadmin";
        const isSender = String(msg.sender) === String(user.id);

        if (!isSuperAdmin && !isSender) {
          if (ack) ack({ success: false, error: "You can only edit your own messages" });
          return;
        }

        msg.encryptedContent = encryptedContent;
        msg.iv = iv;
        msg.authTag = authTag || "";
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();

        const payload = {
          _id: msg._id,
          ticketId: msg.ticketId,
          encryptedContent: msg.encryptedContent,
          iv: msg.iv,
          authTag: msg.authTag,
          isEdited: true,
          editedAt: msg.editedAt,
        };

        const roomName = `ticket_${ticketId}`;
        io.to(roomName).emit("message_edited", payload);

        try {
          const ticket = await ChatTicket.findOne({ ticketId }).select("student developer").lean();
          if (ticket) {
            const targetUserId = String(ticket.student) === String(user.id) ? String(ticket.developer) : String(ticket.student);
            io.to(`user_${targetUserId}`).emit("message_edited", payload);
          }
        } catch (e) {
          // pass
        }

        if (ack) ack({ success: true, message: payload });
      } catch (err) {
        console.error("edit_message error:", err);
        if (ack) ack({ success: false, error: err.message });
      }
    });

    /**
     * delete_message: Super Admin deletes a message in ticket
     */
    socket.on("delete_message", async (data, ack) => {
      try {
        const { ticketId, messageId } = data;

        if (!ticketId || !messageId) {
          if (ack) ack({ success: false, error: "Missing required delete message payload" });
          return;
        }

        const msg = await ChatMessage.findById(messageId);
        if (!msg || msg.ticketId !== ticketId) {
          if (ack) ack({ success: false, error: "Message not found" });
          return;
        }

        const isSuperAdmin = user.role === "superadmin";
        if (!isSuperAdmin) {
          if (ack) ack({ success: false, error: "Only Super Admin has permission to delete messages" });
          return;
        }

        msg.isDeleted = true;
        msg.deletedAt = new Date();
        msg.deletedBy = user.id;
        await msg.save();

        const payload = {
          _id: msg._id,
          ticketId: msg.ticketId,
          isDeleted: true,
          deletedAt: msg.deletedAt,
        };

        const roomName = `ticket_${ticketId}`;
        io.to(roomName).emit("message_deleted", payload);

        try {
          const ticket = await ChatTicket.findOne({ ticketId }).select("student developer").lean();
          if (ticket) {
            const targetUserId = String(ticket.student) === String(user.id) ? String(ticket.developer) : String(ticket.student);
            io.to(`user_${targetUserId}`).emit("message_deleted", payload);
          }
        } catch (e) {
          // pass
        }

        if (ack) ack({ success: true, message: payload });
      } catch (err) {
        console.error("delete_message error:", err);
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
        const now = new Date();
        await ChatMessage.updateMany(
          { ticketId, sender: { $ne: user.id }, read: false },
          { $set: { read: true, readAt: now, delivered: true, deliveredAt: now } }
        );

        const readPayload = {
          ticketId,
          readBy: user.id,
          readAt: now.toISOString(),
        };

        socket.to(`ticket_${ticketId}`).emit("messages_read", readPayload);

        // Also notify partner user room
        try {
          const ticket = await ChatTicket.findOne({ ticketId }).select("student developer").lean();
          if (ticket) {
            const partnerId = String(ticket.student) === String(user.id) ? String(ticket.developer) : String(ticket.student);
            io.to(`user_${partnerId}`).emit("messages_read", readPayload);
          }
        } catch (e) {
          // pass
        }
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
