const express = require("express");
const router = express.Router();
const {
  getNotices,
  getNoticeById,
  proxyNoticeImage,
  downloadNoticePdf,
  triggerSyncNotices,
} = require("../controllers/iterNotice.controller");

// Public endpoints (all authenticated or guest students can view official ITER notices)
router.get("/", getNotices);
router.get("/:id", getNoticeById);
router.get("/:id/preview", proxyNoticeImage);
router.get("/:id/download", downloadNoticePdf);
router.post("/sync", triggerSyncNotices);

module.exports = router;
