const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const {
  submitFeedback,
  getAllFeedback,
} = require("../controllers/feedback.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// Optional Auth Middleware: decodes token if present, but does not block visitors
const optionalAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      }
    }
  } catch {
    // Ignore invalid/expired token for public submission
  }
  next();
};

// Rate limiter for feedback submissions to prevent spam: 15 submissions per 15 minutes per IP
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many feedback submissions from this IP. Please try again later.",
  },
});

// Public / Authenticated route to submit feedback
router.post("/", feedbackLimiter, optionalAuthMiddleware, submitFeedback);

// Admin route to view all feedback (Superintendent / Admin only)
router.get("/", authMiddleware, (req, res, next) => {
  if (req.user && (req.user.role === "superintendent" || req.user.role === "warden")) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Access denied. Admin authorization required.",
  });
}, getAllFeedback);

module.exports = router;
