const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  createTicket,
  getTickets,
  getTicketById,
  getTicketMessages,
  sendTicketMessage,
  updateTicketStatus,
  rateTicket,
  editMessage,
  deleteMessage,
  getChatNotificationConfig,
  updateChatNotificationConfig,
} = require("../controllers/chatTicket.controller");

// All chat ticket operations require authenticated user sessions
router.use(authMiddleware);

router.post("/tickets", createTicket);
router.get("/tickets", getTickets);
router.get("/tickets/:ticketId", getTicketById);
router.get("/tickets/:ticketId/messages", getTicketMessages);
router.post("/tickets/:ticketId/messages", sendTicketMessage);
router.patch("/tickets/:ticketId/messages/:messageId", editMessage);
router.delete("/tickets/:ticketId/messages/:messageId", deleteMessage);
router.patch("/tickets/:ticketId/status", updateTicketStatus);
router.post("/tickets/:ticketId/rating", rateTicket);

// Super Admin Dev Chat Notification Controls
router.get("/notifications/config", getChatNotificationConfig);
router.patch("/notifications/config", updateChatNotificationConfig);

module.exports = router;
