const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  createTicket,
  getTickets,
  getTicketById,
  getTicketMessages,
  updateTicketStatus,
  rateTicket,
} = require("../controllers/chatTicket.controller");

// All chat ticket operations require authenticated user sessions
router.use(authMiddleware);

router.post("/tickets", createTicket);
router.get("/tickets", getTickets);
router.get("/tickets/:ticketId", getTicketById);
router.get("/tickets/:ticketId/messages", getTicketMessages);
router.patch("/tickets/:ticketId/status", updateTicketStatus);
router.post("/tickets/:ticketId/rating", rateTicket);

module.exports = router;
