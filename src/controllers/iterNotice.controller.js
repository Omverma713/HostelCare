const fs = require("fs");
const path = require("path");
const IterNotice = require("../models/iterNotice.model");
const { syncPage1IterNotices, getPageImageBuffer } = require("../services/iterNoticeScraper.service");
const { PDFDocument } = require("pdf-lib");

// Ensure local cache directory for fast multi-page PDF streaming without CPU spikes
const CACHE_DIR = path.resolve(__dirname, "../../public/notice-cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Sanitizes a title string into a safe filename slug
 */
function slugify(text) {
  return String(text || "notice")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * GET /api/v1/academics/iter-notices
 * List official ITER Page 1 notices with search and category filters
 */
const getNotices = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    // If database has 0 notices, auto-sync immediately
    const totalCount = await IterNotice.countDocuments();
    if (totalCount === 0) {
      console.log("[ITER_NOTICE] Database is empty. Running initial sync...");
      await syncPage1IterNotices(req.app.get("io"));
    }

    const filter = {};
    if (category && category !== "all") {
      filter.category = category;
    }
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { summary: { $regex: q, $options: "i" } },
        { categoryLabel: { $regex: q, $options: "i" } },
      ];
    }

    const filteredCount = await IterNotice.countDocuments(filter);
    const notices = await IterNotice.find(filter)
      .sort({ publishDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredCount,
        totalPages: Math.ceil(filteredCount / limitNum),
      },
      notices,
    });
  } catch (error) {
    console.error("[ITER_GET_NOTICES_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load ITER college notices",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/academics/iter-notices/:id
 * Get single notice details
 */
const getNoticeById = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await IterNotice.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { noticeId: id }],
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found",
      });
    }

    return res.status(200).json({
      success: true,
      notice,
    });
  } catch (error) {
    console.error("[ITER_GET_NOTICE_BY_ID_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load notice details",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/academics/iter-notices/:id/preview
 * In-app high-res preview stream for ANY page (e.g. ?page=1, ?page=2)
 */
const proxyNoticeImage = async (req, res) => {
  try {
    const { id } = req.params;
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);

    const notice = await IterNotice.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { noticeId: id }],
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const { buffer, page, totalPages } = await getPageImageBuffer(notice, pageNum);

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": buffer.length,
      "X-Current-Page": page,
      "X-Total-Pages": totalPages,
      "Cache-Control": "public, max-age=86400", // 24 hour client cache
    });

    return res.send(buffer);
  } catch (error) {
    console.error("[ITER_PROXY_IMAGE_ERROR]", error);
    return res.status(502).json({
      success: false,
      message: "Could not render document image preview",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/academics/iter-notices/:id/download
 * In-App 1-Tap PDF Download (Includes ALL PAGES, with local disk caching)
 */
const downloadNoticePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await IterNotice.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { noticeId: id }],
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const filename = `HostelCare-SOA-ITER-${slugify(notice.title)}.pdf`;
    const cachedFilePath = path.join(CACHE_DIR, `${notice.noticeId}.pdf`);

    // 1. If cached on disk, stream immediately without any CPU overhead!
    if (fs.existsSync(cachedFilePath)) {
      return res.sendFile(cachedFilePath, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // 2. Generate multi-page PDF covering ALL pages
    const totalPages = notice.pageCount || 1;
    const pdfDoc = await PDFDocument.create();

    for (let p = 1; p <= totalPages; p++) {
      try {
        const { buffer } = await getPageImageBuffer(notice, p);
        const embeddedImg = await pdfDoc.embedJpg(buffer);
        const imgDims = embeddedImg.scale(1);
        const page = pdfDoc.addPage([imgDims.width, imgDims.height]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: imgDims.width,
          height: imgDims.height,
        });
      } catch (pageErr) {
        console.warn(`[ITER_PDF_PAGE_WARN] Page ${p} generation skipped:`, pageErr.message);
      }
    }

    pdfDoc.setTitle(notice.title);
    pdfDoc.setAuthor("ITER | SIKSHA 'O' ANUSANDHAN");
    pdfDoc.setSubject("HostelCare Official Academic Circular");
    pdfDoc.setCreationDate(notice.publishDate || new Date());

    const pdfBytes = await pdfDoc.save();

    // Save to disk cache asynchronously for instant future requests
    fs.writeFile(cachedFilePath, Buffer.from(pdfBytes), (err) => {
      if (err) console.warn("[ITER_CACHE_WRITE_WARN]", err.message);
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": pdfBytes.length,
      "Cache-Control": "public, max-age=86400",
    });

    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("[ITER_DOWNLOAD_PDF_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate notice PDF download",
      error: error.message,
    });
  }
};

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * GET /api/v1/academics/iter-notices/:id/view
 * 100% Mobile-Native Responsive Document Reader (Zero Desktop Scaling • All Pages • Direct Download Bar)
 */
const renderMobileNoticeView = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await IterNotice.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { noticeId: id }],
    });

    if (!notice) {
      return res.status(404).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;background:#141210;color:#FAF7F2;text-align:center;padding:50px;"><h2>Notice Not Found</h2><p>This circular is no longer available.</p></body></html>`);
    }

    const totalPages = notice.pageCount || 1;
    const formattedDate = notice.publishDate
      ? new Date(notice.publishDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Official Circular";

    const downloadUrl = `/api/v1/academics/iter-notices/${notice.noticeId}/download`;
    const shareText = encodeURIComponent(`Official ITER Notice: ${notice.title}\nView & Download (${totalPages} Pages):\nhttps://hostelcare-api.duckdns.org/api/v1/academics/iter-notices/${notice.noticeId}/view`);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;

    let pagesHtml = "";
    for (let p = 1; p <= totalPages; p++) {
      pagesHtml += `
        <div class="page-card">
          <img src="/api/v1/academics/iter-notices/${notice.noticeId}/preview?page=${p}" alt="Page ${p}" class="page-img" loading="${p === 1 ? 'eager' : 'lazy'}" />
          <div class="page-footer-pill">Page ${p} of ${totalPages}</div>
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <meta name="theme-color" content="#1C1815">
  <title>${escapeHtml(notice.title)} - HostelCare</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #141210;
      color: #FAF7F2;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 90px;
    }
    .reader-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(28, 24, 21, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .reader-top-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .badge {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(192, 118, 96, 0.2);
      color: #E28870;
      border: 1px solid rgba(192, 118, 96, 0.35);
    }
    .date-pill {
      font-size: 0.74rem;
      color: #A6A096;
    }
    .reader-title {
      font-size: 0.98rem;
      font-weight: 700;
      line-height: 1.35;
      color: #FAF7F2;
    }
    .document-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .page-card {
      background: #FFFFFF;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      position: relative;
    }
    .page-img {
      width: 100%;
      height: auto;
      display: block;
    }
    .page-footer-pill {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.7);
      color: #FFFFFF;
      font-size: 0.68rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }
    /* Sticky Mobile Bottom Floating Action Bar */
    .bottom-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 60;
      background: rgba(28, 24, 21, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
    }
    .btn-download {
      flex: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #C07660;
      color: #FFFFFF;
      font-size: 0.88rem;
      font-weight: 700;
      padding: 12px 14px;
      border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(192, 118, 96, 0.4);
      transition: opacity 0.15s;
    }
    .btn-download:active { opacity: 0.85; }
    .btn-action {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: #FAF7F2;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 12px 10px;
      border-radius: 10px;
      text-decoration: none;
      border: 1px solid rgba(255, 255, 255, 0.12);
      cursor: pointer;
    }
    .btn-action:active { background: rgba(255, 255, 255, 0.15); }
    @media print {
      .reader-header, .bottom-bar { display: none !important; }
      body { background: #FFFFFF; padding: 0; }
      .page-card { box-shadow: none; border-radius: 0; page-break-after: always; }
    }
  </style>
</head>
<body>
  <header class="reader-header">
    <div class="reader-top-meta">
      <span class="badge">Official ITER SOA</span>
      <span class="date-pill">📅 ${escapeHtml(formattedDate)} • ${totalPages} ${totalPages > 1 ? 'Pages' : 'Page'}</span>
    </div>
    <h1 class="reader-title">${escapeHtml(notice.title)}</h1>
  </header>

  <main class="document-container">
    ${pagesHtml}
  </main>

  <footer class="bottom-bar">
    <a href="${downloadUrl}" class="btn-download" download>
      <span>⬇️</span>
      <span>Download PDF (${totalPages} ${totalPages > 1 ? 'Pages' : 'Page'})</span>
    </a>
    <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-action">
      <span>💬</span>
      <span>WhatsApp</span>
    </a>
    <button type="button" class="btn-action" onclick="window.print()">
      <span>🖨️</span>
      <span>Print / PDF</span>
    </button>
  </footer>
</body>
</html>`;

    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
    return res.send(html);
  } catch (error) {
    console.error("[ITER_RENDER_MOBILE_VIEW_ERROR]", error);
    return res.status(500).send("Internal Server Error rendering notice");
  }
};

/**
 * POST /api/v1/academics/iter-notices/sync
 * Manually trigger refresh from ITER website
 */
const triggerSyncNotices = async (req, res) => {
  try {
    const io = req.app.get("io");
    const result = await syncPage1IterNotices(io);

    return res.status(200).json({
      success: result.success,
      message: `Sync complete! Synced ${result.totalSynced || 0} notices (${result.newNoticesFound || 0} new).`,
      data: result,
    });
  } catch (error) {
    console.error("[ITER_SYNC_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync ITER notices",
      error: error.message,
    });
  }
};

module.exports = {
  getNotices,
  getNoticeById,
  proxyNoticeImage,
  downloadNoticePdf,
  renderMobileNoticeView,
  triggerSyncNotices,
};
