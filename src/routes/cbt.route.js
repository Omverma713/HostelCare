const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  getStudentCbtStatus,
  applyForCbt,
  getMyCbtApplication,
} = require("../controllers/cbt.controllers");

// All student CBT routes require authenticated student session
router.use(authMiddleware);

router.get("/status", getStudentCbtStatus);
router.post("/apply", applyForCbt);
router.get("/my-application", getMyCbtApplication);

module.exports = router;
