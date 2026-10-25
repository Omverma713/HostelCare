import { io } from "socket.io-client";
import { Capacitor } from "@capacitor/core";

let socket = null;
const listeners = new Map();

/**
 * Resolves the Socket.IO backend connection URL
 * In Android Capacitor APK, window.location.hostname is 'localhost',
 * so we must detect Capacitor native platform to prevent connecting to mobile localhost!
 */
function getSocketUrl() {
  const isNative = typeof window !== "undefined" && (
    (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
    Capacitor.isNativePlatform()
  );

  if (isNative) {
    return "https://hostelcare-api.duckdns.org";
  }

  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalDev = currentHost === "localhost" || currentHost === "127.0.0.1";

  if (!import.meta.env.PROD && isLocalDev) {
    return "http://localhost:3000";
  }

  // Production web or remote server
  return "https://hostelcare-api.duckdns.org";
}

/**
 * Initializes and connects Socket.io with JWT token
 */
let currentJoinedRoom = null;

/**
 * Initializes and connects Socket.io with JWT token
 */
export function connectChatSocket(token) {
  if (socket && socket.connected) {
    return socket;
  }

  const socketUrl = getSocketUrl();
  console.log(`🔌 [ChatSocketService] Connecting to ${socketUrl}...`);

  socket = io(socketUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("✅ [ChatSocketService] Socket connected successfully:", socket.id);
    emitLocalEvent("connection_status", { connected: true, socketId: socket.id });
    if (currentJoinedRoom) {
      socket.emit("join_ticket", { ticketId: currentJoinedRoom });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ [ChatSocketService] Socket disconnected:", reason);
    emitLocalEvent("connection_status", { connected: false, reason });
  });

  socket.on("connect_error", (err) => {
    console.warn("⚠️ [ChatSocketService] Connection error:", err.message);
    emitLocalEvent("connection_status", { connected: false, error: err.message });
  });

  socket.on("new_message", (msg) => {
    emitLocalEvent("new_message", msg);
  });

  socket.on("joined_ticket", (data) => {
    emitLocalEvent("joined_ticket", data);
  });

  socket.on("typing_change", (data) => {
    emitLocalEvent("typing_change", data);
  });

  socket.on("user_presence", (data) => {
    emitLocalEvent("user_presence", data);
  });

  socket.on("global_presence", (data) => {
    emitLocalEvent("user_presence", data);
  });

  socket.on("ticket_activity", (data) => {
    emitLocalEvent("ticket_activity", data);
  });

  socket.on("messages_read", (data) => {
    emitLocalEvent("messages_read", data);
  });

  socket.on("message_edited", (data) => {
    emitLocalEvent("message_edited", data);
  });

  socket.on("message_deleted", (data) => {
    emitLocalEvent("message_deleted", data);
  });

  socket.on("chat_notification", async (data) => {
    emitLocalEvent("chat_notification", data);
    try {
      if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        await LocalNotifications.schedule({
          notifications: [
            {
              title: data.title || "HostelCare Support",
              body: data.body || "New support chat update",
              id: Math.floor(Math.random() * 100000),
              channelId: "hostelcare_custom_channel",
              extra: { route: "/chat", ticketId: data.ticketId },
            },
          ],
        });
      } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(data.title || "HostelCare Support", {
          body: data.body,
          icon: "/favicon.ico",
        });
      }
    } catch (e) {
      console.warn("Local chat notification trigger notice:", e.message);
    }
  });

  socket.on("ticket_flushed", (data) => {
    emitLocalEvent("ticket_flushed", data);
  });

  socket.on("global_notice_published", (data) => {
    emitLocalEvent("global_notice_published", data);
  });

  socket.on("error_message", (data) => {
    emitLocalEvent("error_message", data);
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentJoinedRoom = null;
    listeners.clear();
  }
}

export function joinTicketRoom(ticketId) {
  currentJoinedRoom = ticketId;
  if (socket && socket.connected) {
    socket.emit("join_ticket", { ticketId });
  }
}

export function leaveTicketRoom(ticketId) {
  if (currentJoinedRoom === ticketId) {
    currentJoinedRoom = null;
  }
  if (socket && socket.connected) {
    socket.emit("leave_ticket", { ticketId });
  }
}

export function sendChatMessage(data) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error("Chat socket is currently disconnected. Retrying..."));
    }
    socket.emit("send_message", data, (ack) => {
      if (ack && ack.success) {
        resolve(ack);
      } else {
        reject(new Error(ack?.error || "Failed to deliver message"));
      }
    });
  });
}

export function editChatMessage(data) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error("Chat socket is currently disconnected."));
    }
    socket.emit("edit_message", data, (ack) => {
      if (ack && ack.success) {
        resolve(ack);
      } else {
        reject(new Error(ack?.error || "Failed to edit message"));
      }
    });
  });
}

export function deleteChatMessage(data) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      return reject(new Error("Chat socket is currently disconnected."));
    }
    socket.emit("delete_message", data, (ack) => {
      if (ack && ack.success) {
        resolve(ack);
      } else {
        reject(new Error(ack?.error || "Failed to delete message"));
      }
    });
  });
}

export function sendTypingIndicator(ticketId, isTyping) {
  if (!socket || !socket.connected) return;
  if (isTyping) {
    socket.emit("typing_start", { ticketId });
  } else {
    socket.emit("typing_stop", { ticketId });
  }
}

export function markTicketMessagesRead(ticketId) {
  if (!socket || !socket.connected) return;
  socket.emit("mark_read", { ticketId });
}

// Local pub/sub listener registry
export function addChatListener(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  return () => {
    listeners.get(event)?.delete(callback);
  };
}

function emitLocalEvent(event, data) {
  const set = listeners.get(event);
  if (set) {
    for (const cb of set) {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error in listener for ${event}:`, e);
      }
    }
  }
}
