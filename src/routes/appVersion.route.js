const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { getAppVersionStatus, downloadLatestApk } = require("../controllers/appVersion.controller");

// Public rate limiter for app version checks (120 checks per 15 minutes per IP)
const versionCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many version check requests. Please try again shortly.",
  },
});

router.get("/", versionCheckLimiter, getAppVersionStatus);
router.get("/check", versionCheckLimiter, getAppVersionStatus);
router.get("/download", downloadLatestApk);

module.exports = router;
