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
    const cachedFilePath = path.join(CACHE_DIR, `${notice.noticeId}_hd.pdf`);

    // 1. If cached on disk, stream immediately as direct attachment download!
    if (fs.existsSync(cachedFilePath)) {
      return res.download(cachedFilePath, filename, {
        headers: {
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
      "Content-Disposition": `attachment; filename="${filename}"`,
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

    const filename = `HostelCare-SOA-ITER-${slugify(notice.title)}.pdf`;
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes">
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
    .reader-hint {
      font-size: 0.72rem;
      color: #A6A096;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }
    .document-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .page-card {
      background: #FFFFFF;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      position: relative;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
    }
    .page-card.is-zoomed {
      z-index: 25;
      touch-action: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65);
    }
    .page-img {
      width: 100%;
      height: auto;
      display: block;
      transform-origin: center center;
      will-change: transform;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
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
      pointer-events: none;
      z-index: 5;
    }
    .zoom-reset-badge {
      display: none;
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(28, 24, 21, 0.88);
      color: #FAF7F2;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 5px 11px;
      border-radius: 20px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      z-index: 30;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .page-card.is-zoomed .zoom-reset-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
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
      gap: 10px;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
    }
    .btn-download {
      flex: 1.25;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #C07660;
      color: #FFFFFF;
      font-size: 0.88rem;
      font-weight: 700;
      padding: 13px 14px;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(192, 118, 96, 0.4);
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn-download:active { opacity: 0.85; transform: scale(0.98); }
    .btn-share {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #25D366;
      color: #FFFFFF;
      font-size: 0.88rem;
      font-weight: 700;
      padding: 13px 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(37, 211, 102, 0.35);
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn-share:active { opacity: 0.85; transform: scale(0.98); }
    .btn-share:disabled { opacity: 0.6; cursor: wait; }
    @page {
      size: A4 portrait;
      margin: 0;
    }
    @media print {
      html, body {
        background: #FFFFFF !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-height: 0 !important;
      }
      .reader-header,
      .bottom-bar,
      .page-footer-pill,
      .zoom-reset-badge {
        display: none !important;
      }
      .document-container {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        gap: 0 !important;
      }
      .page-card {
        display: block !important;
        width: 100% !important;
        height: 100vh !important;
        max-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        page-break-before: auto !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
        break-before: auto !important;
        break-after: page !important;
        break-inside: avoid !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      .page-card:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .page-img {
        width: 100% !important;
        height: 100% !important;
        max-height: 100vh !important;
        object-fit: contain !important;
        display: block !important;
        margin: 0 auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
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
    <div class="reader-hint">
      <span>🤏 Pinch with 2 fingers or double-tap to zoom pages</span>
    </div>
  </header>

  <main class="document-container">
    ${pagesHtml}
  </main>

  <footer class="bottom-bar">
    <a href="${downloadUrl}" class="btn-download" download="${escapeHtml(filename)}">
      <span>⬇️</span>
      <span>Download PDF (${totalPages} ${totalPages > 1 ? 'Pages' : 'Page'})</span>
    </a>
    <button type="button" class="btn-share" id="btnSharePdf" onclick="sharePdfToWhatsApp()">
      <span id="shareIcon">💬</span>
      <span id="shareText">WhatsApp PDF</span>
    </button>
  </footer>

  <script>
    // 1. Instant Direct PDF File Share to WhatsApp via Web Share API
    let preloadedPdfFile = null;
    let isPreloading = false;

    async function preloadNoticePdf() {
      if (isPreloading || preloadedPdfFile) return;
      isPreloading = true;
      try {
        const res = await fetch("${downloadUrl}");
        if (res.ok) {
          const blob = await res.blob();
          preloadedPdfFile = new File([blob], "${escapeHtml(filename)}", { type: "application/pdf" });
        }
      } catch (e) {
        console.warn("[PRELOAD_PDF_WARN]", e);
      } finally {
        isPreloading = false;
      }
    }

    // Preload PDF immediately so user gesture token never expires on 1st click!
    if (document.readyState === "complete" || document.readyState === "interactive") {
      preloadNoticePdf();
    } else {
      document.addEventListener("DOMContentLoaded", preloadNoticePdf);
    }

    async function sharePdfToWhatsApp() {
      const btn = document.getElementById("btnSharePdf");
      const icon = document.getElementById("shareIcon");
      const text = document.getElementById("shareText");
      const origText = text.innerText;
      const origIcon = icon.innerText;

      try {
        let fileToShare = preloadedPdfFile;

        if (!fileToShare) {
          btn.disabled = true;
          icon.innerText = "⏳";
          text.innerText = "Loading PDF...";

          const pdfUrl = "${downloadUrl}";
          const response = await fetch(pdfUrl);
          if (!response.ok) throw new Error("Could not fetch notice PDF");
          const blob = await response.blob();
          fileToShare = new File([blob], "${escapeHtml(filename)}", { type: "application/pdf" });
          preloadedPdfFile = fileToShare;
        }

        if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
          await navigator.share({
            files: [fileToShare],
            title: "${escapeHtml(notice.title)}",
            text: "Official ITER SOA Notice (${totalPages} ${totalPages > 1 ? 'Pages' : 'Page'})",
          });
        } else {
          // Fallback if browser does not support file sharing
          const a = document.createElement("a");
          a.href = "${downloadUrl}";
          a.download = "${escapeHtml(filename)}";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          const waUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Official ITER Notice: ${escapeHtml(notice.title)}\\nDirect PDF Download: " + window.location.origin + "${downloadUrl}");
          window.open(waUrl, "_blank");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("[SHARE_ERROR]", err);
          // If gesture token expired during first load, file is now cached in preloadedPdfFile!
          // Give user instant 1-tap share prompt rather than kicking to text link
          if (preloadedPdfFile) {
            text.innerText = "Tap to Share PDF";
            icon.innerText = "📲";
            return;
          }
          const waUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Official ITER Notice: ${escapeHtml(notice.title)}\\nView & Download: " + window.location.href);
          window.open(waUrl, "_blank");
        }
      } finally {
        btn.disabled = false;
        if (text.innerText !== "Tap to Share PDF") {
          icon.innerText = origIcon;
          text.innerText = origText;
        }
      }
    }

    // 2. Multi-Touch Pinch-to-Zoom & Pan Gesture Engine
    document.querySelectorAll('.page-card').forEach(card => {
      const img = card.querySelector('.page-img');
      let scale = 1;
      let posX = 0;
      let posY = 0;
      let startDist = 0;
      let initialScale = 1;
      let startX = 0;
      let startY = 0;
      let initialPosX = 0;
      let initialPosY = 0;
      let isPinching = false;
      let isPanning = false;
      let lastTapTime = 0;

      const resetBadge = document.createElement('div');
      resetBadge.className = 'zoom-reset-badge';
      resetBadge.innerHTML = '🔍 Zoomed • Tap to reset';
      card.appendChild(resetBadge);
      resetBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        resetZoom();
      });

      function updateTransform(animate = false) {
        img.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
        img.style.transform = "translate3d(" + posX + "px, " + posY + "px, 0) scale(" + scale + ")";
        if (scale > 1.05) {
          card.classList.add('is-zoomed');
        } else {
          card.classList.remove('is-zoomed');
        }
      }

      function resetZoom() {
        scale = 1;
        posX = 0;
        posY = 0;
        updateTransform(true);
      }

      card.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          isPinching = true;
          isPanning = false;
          startDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          initialScale = scale;
        } else if (e.touches.length === 1) {
          const now = Date.now();
          if (now - lastTapTime < 320) {
            // Double-tap
            if (scale > 1.2) {
              resetZoom();
            } else {
              scale = 2.2;
              const rect = card.getBoundingClientRect();
              const tapX = e.touches[0].clientX - rect.left - rect.width / 2;
              const tapY = e.touches[0].clientY - rect.top - rect.height / 2;
              posX = -tapX * 0.7;
              posY = -tapY * 0.7;
              updateTransform(true);
            }
            lastTapTime = 0;
            return;
          }
          lastTapTime = now;

          if (scale > 1.05) {
            isPanning = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            initialPosX = posX;
            initialPosY = posY;
          }
        }
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (isPinching && e.touches.length === 2) {
          if (e.cancelable) e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (startDist > 0) {
            const ratio = dist / startDist;
            scale = Math.min(Math.max(initialScale * ratio, 0.95), 4.5);
            updateTransform(false);
          }
        } else if (isPanning && e.touches.length === 1 && scale > 1.05) {
          if (e.cancelable) e.preventDefault();
          const deltaX = e.touches[0].clientX - startX;
          const deltaY = e.touches[0].clientY - startY;
          const maxPanX = (card.offsetWidth * (scale - 1)) / 1.8;
          const maxPanY = (card.offsetHeight * (scale - 1)) / 1.8;
          posX = Math.min(Math.max(initialPosX + deltaX, -maxPanX), maxPanX);
          posY = Math.min(Math.max(initialPosY + deltaY, -maxPanY), maxPanY);
          updateTransform(false);
        }
      }, { passive: false });

      card.addEventListener('touchend', (e) => {
        if (isPinching && e.touches.length < 2) {
          isPinching = false;
          if (scale < 1.05) {
            resetZoom();
          }
        }
        if (isPanning && e.touches.length === 0) {
          isPanning = false;
        }
      }, { passive: true });
    });
  </script>
</body>
</html>`;

    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
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
