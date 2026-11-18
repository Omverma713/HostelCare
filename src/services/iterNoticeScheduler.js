const { syncPage1IterNotices } = require("./iterNoticeScraper.service");
const { getChatIO } = require("../sockets/chatSocket");

let noticeSyncInterval = null;

/**
 * Starts the automated background scheduler for ITER college notices.
 * Syncs Page 1 notices every 20 minutes and broadcasts real-time events.
 */
function startIterNoticeScheduler() {
  if (noticeSyncInterval) return;

  console.log("[ITER_NOTICE_SCHEDULER] Starting ITER notices sync daemon (interval: 20 mins)...");

  // Initial sync delayed by 5 seconds to ensure DB and socket connections are fully established
  setTimeout(async () => {
    try {
      const io = getChatIO();
      await syncPage1IterNotices(io);
    } catch (err) {
      console.warn("[ITER_NOTICE_SCHEDULER] Initial sync error:", err.message);
    }
  }, 5000);

  // Periodic sync every 20 minutes
  noticeSyncInterval = setInterval(async () => {
    try {
      const io = getChatIO();
      await syncPage1IterNotices(io);
    } catch (err) {
      console.warn("[ITER_NOTICE_SCHEDULER] Periodic sync error:", err.message);
    }
  }, 20 * 60 * 1000);
}

function stopIterNoticeScheduler() {
  if (noticeSyncInterval) {
    clearInterval(noticeSyncInterval);
    noticeSyncInterval = null;
    console.log("[ITER_NOTICE_SCHEDULER] Stopped ITER notices sync daemon.");
  }
}

module.exports = {
  startIterNoticeScheduler,
  stopIterNoticeScheduler,
};
