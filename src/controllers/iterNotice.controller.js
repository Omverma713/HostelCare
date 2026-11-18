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
  triggerSyncNotices,
};
