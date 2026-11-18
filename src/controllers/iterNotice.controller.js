const IterNotice = require("../models/iterNotice.model");
const { syncPage1IterNotices, fetchHttpsWithRedirect } = require("../services/iterNoticeScraper.service");
const { PDFDocument } = require("pdf-lib");
const https = require("https");

/**
 * Helper to download an image as a Buffer
 */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      },
      (res) => {
        if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
          return resolve(fetchBuffer(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download image: HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    ).on("error", reject);
  });
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
 * In-app high-res preview stream (bypasses Box CORS / external domain blocks)
 */
const proxyNoticeImage = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await IterNotice.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { noticeId: id }],
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const previewUrl = notice.boxPreviewUrl || notice.assetUrl;
    if (!previewUrl) {
      return res.status(404).json({
        success: false,
        message: "No document image preview available for this notice",
      });
    }

    const imgBuffer = await fetchBuffer(previewUrl);

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": imgBuffer.length,
      "Cache-Control": "public, max-age=86400", // 24 hours client cache
    });

    return res.send(imgBuffer);
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
 * In-App 1-Tap PDF Download (assembled directly by HostelCare)
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

    const previewUrl = notice.boxPreviewUrl || notice.assetUrl;
    if (!previewUrl) {
      return res.status(404).json({
        success: false,
        message: "Document file not available for download",
      });
    }

    // Download the high-res circular image
    const imgBuffer = await fetchBuffer(previewUrl);

    // Create a pristine PDF document with the circular image embedded
    const pdfDoc = await PDFDocument.create();
    let embeddedImg;

    try {
      embeddedImg = await pdfDoc.embedJpg(imgBuffer);
    } catch (e) {
      // Fallback for png
      embeddedImg = await pdfDoc.embedPng(imgBuffer);
    }

    const imgDims = embeddedImg.scale(1);
    // Page dimensions matching the image aspect ratio
    const page = pdfDoc.addPage([imgDims.width, imgDims.height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: imgDims.width,
      height: imgDims.height,
    });

    // Embed metadata
    pdfDoc.setTitle(notice.title);
    pdfDoc.setAuthor("ITER | SIKSHA 'O' ANUSANDHAN");
    pdfDoc.setSubject("HostelCare Official Academic Circular");
    pdfDoc.setCreationDate(notice.publishDate || new Date());

    const pdfBytes = await pdfDoc.save();
    const filename = `HostelCare-SOA-ITER-${slugify(notice.title)}.pdf`;

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
