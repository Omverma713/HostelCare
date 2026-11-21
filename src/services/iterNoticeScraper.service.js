const https = require("https");
const sharp = require("sharp");
const IterNotice = require("../models/iterNotice.model");

// In-memory cache for Box session tokens & templates (6 hour TTL)
const boxSessionCache = new Map();

/**
 * Helper to fetch HTTPS content following redirects (up to maxRedirects)
 */
function fetchHttpsWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (maxRedirects <= 0) return reject(new Error("Too many redirects: " + url));
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith("/")) {
            const parsed = new URL(url);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          return resolve(fetchHttpsWithRedirect(redirectUrl, maxRedirects - 1));
        }

        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
      }
    );

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("HTTPS request timeout for: " + url));
    });
  });
}

/**
 * Helper to download binary Buffer
 */
function fetchBufferWithAuth(url, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = https.get(url, { headers }, (res) => {
      if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        return resolve(fetchBufferWithAuth(res.headers.location, token));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download binary: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Binary fetch timeout: " + url));
    });
  });
}

/**
 * Determine dynamic category & label based on notice title
 */
function categorizeNotice(title = "") {
  const t = title.toLowerCase();

  if (/mid-semester|end-semester|examination|programme for|datesheet|exam schedule/i.test(t)) {
    return { category: "exam", categoryLabel: "Examination Circular" };
  }
  if (/cyclone|storm|weather|rain|suspension of academic/i.test(t)) {
    return { category: "cyclone_alert", categoryLabel: "Emergency Advisory" };
  }
  if (/commencement of (regular )?classes|summer quarter classes|academic calendar|timetable/i.test(t)) {
    return { category: "academic", categoryLabel: "Academic Schedule" };
  }
  if (/holiday|puja|diwali|vacation/i.test(t)) {
    return { category: "holiday", categoryLabel: "Institute Holiday" };
  }
  if (/id-card|registration|fee|scholarship|admission batch/i.test(t)) {
    return { category: "administrative", categoryLabel: "Student Administration" };
  }

  return { category: "general", categoryLabel: "Official Circular" };
}

/**
 * Resolve Box.com metadata (file version ID, file name, page count, tokens)
 */
async function resolveBoxNoticeDetails(sharedName, forceRefresh = false) {
  if (!sharedName) return null;

  // Check cache first
  const cached = boxSessionCache.get(sharedName);
  if (!forceRefresh && cached && cached.expiry > Date.now()) {
    return cached;
  }

  try {
    const boxUrl = `https://soadu.box.com/s/${sharedName}`;
    const { statusCode, body } = await fetchHttpsWithRedirect(boxUrl, 4);

    if (statusCode !== 200 || !body) return null;

    let fileVersionId = "";
    let fileName = "";
    let pageCount = 1;
    let fileId = "";
    let readToken = "";
    let templateUrl = "";

    // 1. Try Box.prefetchedData
    const prefetchMatch = body.match(/Box\.prefetchedData\s*=\s*(\{[\s\S]*?\});/);
    if (prefetchMatch) {
      try {
        const pData = JSON.parse(prefetchMatch[1]);
        const tokenMap = pData["preview_prefetch_token_map"] || {};
        const fIds = Object.keys(tokenMap);
        if (fIds.length > 0) {
          fileId = fIds[0];
          readToken = tokenMap[fileId].read || "";
        }

        const meta = pData["preview_metadata"];
        if (meta) {
          if (meta.file_version && meta.file_version.id) fileVersionId = String(meta.file_version.id);
          if (meta.name) fileName = String(meta.name);
          if (meta.representations && Array.isArray(meta.representations.entries)) {
            const webpRep = meta.representations.entries.find((e) => e.representation === "webp" && e.status?.state === "success");
            const jpgRep = meta.representations.entries.find((e) => e.representation === "jpg" && e.status?.state === "success");
            const pngRep = meta.representations.entries.find((e) => e.representation === "png");
            const anyRep = meta.representations.entries[0];
            const chosenRep = webpRep || jpgRep || pngRep || anyRep;
            if (chosenRep) {
              if (chosenRep.metadata && chosenRep.metadata.pages) {
                pageCount = Number(chosenRep.metadata.pages) || 1;
              }
              if (chosenRep.content && chosenRep.content.url_template) {
                templateUrl = chosenRep.content.url_template;
              }
            }
          }
        }
      } catch (err) { }
    }

    // 2. Fallback regexes
    if (!fileVersionId) {
      const fvMatch = body.match(/file_version_(\d+)/);
      if (fvMatch) fileVersionId = fvMatch[1];
    }

    const previewUrl = fileVersionId
      ? `https://app.box.com/representation/file_version_${fileVersionId}/thumb_1024.jpg?shared_name=${sharedName}`
      : "";

    const details = {
      fileVersionId,
      fileName,
      pageCount,
      previewUrl,
      fileId,
      readToken,
      templateUrl,
      expiry: Date.now() + 6 * 3600 * 1000, // 6 hour in-memory cache
    };

    boxSessionCache.set(sharedName, details);
    return details;
  } catch (error) {
    console.warn(`[ITER_SCRAPER] Failed to resolve Box details for ${sharedName}:`, error.message);
    return null;
  }
}

/**
 * Super-Resolution & Unsharp Masking for pristine High-DPI (2048px) document rendering
 */
async function enhanceNoticeImage(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return buffer;
  try {
    return await sharp(buffer)
      .resize({
        width: 2048,
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false,
      })
      .sharpen({
        sigma: 1.2,
        m1: 1.0,
        m2: 2.0,
      })
      .jpeg({
        quality: 95,
        chromaSubsampling: "4:4:4",
      })
      .toBuffer();
  } catch (err) {
    console.warn("[ITER_IMAGE_ENHANCE_WARN] Sharp enhancement failed, serving original:", err.message);
    return buffer;
  }
}

/**
 * Downloads a specific page of a notice as a pristine JPEG Buffer
 */
async function getPageImageBuffer(notice, pageNumber = 1) {
  const pageNum = Math.max(1, parseInt(pageNumber, 10) || 1);
  const sharedName = notice.boxSharedName;

  // 1. Try BoxCloud template with token (supports all pages)
  if (sharedName) {
    let details = boxSessionCache.get(sharedName);
    if (!details || !details.templateUrl || !details.readToken) {
      details = await resolveBoxNoticeDetails(sharedName);
    }

    if (details && details.templateUrl && details.readToken) {
      try {
        const targetPage = Math.min(pageNum, details.pageCount || 1);
        const ext = details.templateUrl.includes("jpg") ? "jpg" : details.templateUrl.includes("png") ? "png" : "webp";
        const pageUrl = details.templateUrl.replace("{+asset_path}", `${targetPage}.${ext}`);
        const rawBuf = await fetchBufferWithAuth(pageUrl, details.readToken);
        const enhancedBuf = await enhanceNoticeImage(rawBuf);
        return {
          buffer: enhancedBuf,
          page: targetPage,
          totalPages: details.pageCount || 1,
        };
      } catch (err) {
        console.warn(`[ITER_PAGE_RESOLVER] Page asset fetch failed, trying fallback:`, err.message);
      }
    }

    // Fallback: Page 1 thumb with 2048px High-DPI Lanczos3 upsampling
    if (pageNum === 1 && notice.boxPreviewUrl) {
      const imgBuf = await fetchBufferWithAuth(notice.boxPreviewUrl);
      const enhancedBuf = await enhanceNoticeImage(imgBuf);
      return { buffer: enhancedBuf, page: 1, totalPages: notice.pageCount || 1 };
    }
  }

  // 2. Fallback to assetUrl (Squarespace poster)
  if (notice.assetUrl) {
    const imgBuf = await fetchBufferWithAuth(notice.assetUrl);
    const enhancedBuf = await enhanceNoticeImage(imgBuf);
    return { buffer: enhancedBuf, page: 1, totalPages: 1 };
  }

  throw new Error("No image available for this notice page");
}

/**
 * Main Scraper: Sync Page 1 Notices from SOA ITER Official Website
 */
async function syncPage1IterNotices(io = null) {
  try {
    console.log("[ITER_SCRAPER] Fetching Page 1 ITER notices from soa.ac.in/iter-news-and-events...");
    const feedUrl = "https://www.soa.ac.in/iter-news-and-events?format=json";
    const { statusCode, body } = await fetchHttpsWithRedirect(feedUrl, 3);

    if (statusCode !== 200) {
      throw new Error(`Feed HTTP ${statusCode}`);
    }

    const data = JSON.parse(body);
    const rawItems = Array.isArray(data.items) ? data.items : [];
    console.log(`[ITER_SCRAPER] Received ${rawItems.length} items from Page 1`);

    let newNoticesFound = 0;
    const upsertedNotices = [];

    for (const item of rawItems) {
      const noticeId = String(item.id || item.urlId || "").trim();
      if (!noticeId) continue;

      const title = String(item.title || "").trim();
      const publishDate = new Date(item.publishOn || item.addedOn || Date.now());
      const { category, categoryLabel } = categorizeNotice(title);

      // Extract Box shared link from body
      let boxSharedName = "";
      if (item.body) {
        const boxMatch = item.body.match(/https?:\/\/soadu\.box\.com\/s\/([a-zA-Z0-9_-]+)/i);
        if (boxMatch) {
          boxSharedName = boxMatch[1];
        }
      }

      const existing = await IterNotice.findOne({ noticeId });
      let boxDetails = null;

      if (existing && existing.boxFileVersionId && existing.boxPreviewUrl && existing.boxTemplateUrl) {
        boxDetails = {
          fileVersionId: existing.boxFileVersionId,
          fileName: existing.boxFileName,
          pageCount: existing.pageCount,
          previewUrl: existing.boxPreviewUrl,
          fileId: existing.boxFileId,
          readToken: existing.boxReadToken,
          templateUrl: existing.boxTemplateUrl,
        };
      } else if (boxSharedName) {
        boxDetails = await resolveBoxNoticeDetails(boxSharedName);
      }

      const summary = item.excerpt ? item.excerpt.replace(/<[^>]*>/g, "").trim() : "";
      const assetUrl = item.assetUrl || "";
      const fullUrl = item.fullUrl ? `https://www.soa.ac.in${item.fullUrl}` : "";

      const noticeData = {
        noticeId,
        title,
        publishDate,
        category,
        categoryLabel,
        summary,
        boxSharedName,
        boxFileVersionId: boxDetails ? boxDetails.fileVersionId : "",
        boxFileName: boxDetails ? boxDetails.fileName : "",
        boxPreviewUrl: boxDetails ? boxDetails.previewUrl : "",
        boxTemplateUrl: boxDetails ? boxDetails.templateUrl : "",
        boxReadToken: boxDetails ? boxDetails.readToken : "",
        boxFileId: boxDetails ? boxDetails.fileId : "",
        pageCount: boxDetails ? boxDetails.pageCount : 1,
        fullUrl,
        assetUrl,
        scrapedAt: new Date(),
      };

      const doc = await IterNotice.findOneAndUpdate(
        { noticeId },
        { $set: noticeData, $setOnInsert: { isNewNotice: true } },
        { upsert: true, returnDocument: "after" }
      );

      if (!existing) {
        newNoticesFound++;
        if (io) {
          // Real-time broadcast for instantly published notices
          io.emit("iter:new_notice", {
            noticeId: doc.noticeId,
            title: doc.title,
            category: doc.category,
            categoryLabel: doc.categoryLabel,
            publishDate: doc.publishDate,
            boxPreviewUrl: doc.boxPreviewUrl,
            pageCount: doc.pageCount,
          });
        }
      }

      upsertedNotices.push(doc);
    }

    console.log(`[ITER_SCRAPER] Sync complete: ${upsertedNotices.length} notices synced (${newNoticesFound} new).`);
    return {
      success: true,
      totalSynced: upsertedNotices.length,
      newNoticesFound,
      notices: upsertedNotices,
    };
  } catch (error) {
    console.error("[ITER_SCRAPER_ERROR]", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  syncPage1IterNotices,
  resolveBoxNoticeDetails,
  getPageImageBuffer,
  categorizeNotice,
  fetchHttpsWithRedirect,
};
