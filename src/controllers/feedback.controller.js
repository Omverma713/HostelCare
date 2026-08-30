const Feedback = require("../models/feedback.model");
const {
  sendFeedbackNotificationToAdmin,
  sendFeedbackAcknowledgmentToVisitor,
} = require("../utils/mailer");

/**
 * Validates basic email structure.
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === "string" && emailRegex.test(email.trim());
}

/**
 * POST /api/v1/feedback
 * Submit feedback from either a visitor or an authenticated user.
 */
const submitFeedback = async (req, res) => {
  try {
    const { name, email, role, rating, category, subject, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback message cannot be empty.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubject = (subject && subject.trim()) || "HostelCare Feedback";
    const cleanMessage = message.trim();
    const parsedRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    const cleanCategory = category || "Suggestion";
    const userRole = (req.user && req.user.role) || role || "visitor";
    const userId = req.user ? req.user.id || req.user._id : null;
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    // 1. Persist feedback to MongoDB database
    const newFeedback = await Feedback.create({
      name: cleanName,
      email: cleanEmail,
      role: userRole,
      rating: parsedRating,
      category: cleanCategory,
      subject: cleanSubject,
      message: cleanMessage,
      userRef: userId,
      ipAddress: String(ipAddress),
      status: "new",
    });

    // 2. Dispatch emails in background (do not block client on slow SMTP roundtrips)
    Promise.allSettled([
      sendFeedbackNotificationToAdmin({
        name: cleanName,
        email: cleanEmail,
        role: userRole,
        rating: parsedRating,
        category: cleanCategory,
        subject: cleanSubject,
        message: cleanMessage,
        ipAddress: String(ipAddress),
      }),
      sendFeedbackAcknowledgmentToVisitor({
        name: cleanName,
        email: cleanEmail,
        rating: parsedRating,
        category: cleanCategory,
        subject: cleanSubject,
        message: cleanMessage,
      }),
    ]).catch((err) => {
      console.error("[Mailer Error during feedback dispatch]:", err.message);
    });

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully! A confirmation email has been sent to your email address.",
      data: {
        id: newFeedback._id,
        createdAt: newFeedback.createdAt,
      },
    });
  } catch (error) {
    console.error("[Feedback Controller Error]:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback. Please try again later.",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/feedback
 * Optional fetch endpoint for administrators/superintendents to review feedback in portal
 */
const getAllFeedback = async (req, res) => {
  try {
    const feedbackList = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: feedbackList.length,
      data: feedbackList,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve feedback.",
      error: error.message,
    });
  }
};

module.exports = {
  submitFeedback,
  getAllFeedback,
};
