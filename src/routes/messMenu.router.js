const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const { requireMessStaff } = require("../middleware/messAdmin.middleware");
const {
  getPublicMessMenu,
  updateMessMenu,
  resetMessMenuToDefault,
} = require("../controllers/messMenu.controller");

// Public endpoints (no authentication required)
router.get("/public", getPublicMessMenu);
router.get("/", getPublicMessMenu);

// Authorized Staff endpoints (Superadmin, Caretaker, Warden, Superintendent)
router.put("/", authMiddleware, requireMessStaff, updateMessMenu);
router.post("/reset", authMiddleware, requireMessStaff, resetMessMenuToDefault);

module.exports = router;
