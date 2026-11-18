const https = require("https");
const IterNotice = require("../models/iterNotice.model");

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
 * Resolve Box.com metadata (file version ID, file name, page count)
 */
async function resolveBoxNoticeDetails(sharedName) {
  if (!sharedName) return null;

  try {
    const boxUrl = `https://soadu.box.com/s/${sharedName}`;
    const { statusCode, body } = await fetchHttpsWithRedirect(boxUrl, 4);

    if (statusCode !== 200 || !body) return null;

    let fileVersionId = "";
    let fileName = "";
    let pageCount = 1;

    // 1. Try Box.prefetchedData
    const prefetchMatch = body.match(/Box\.prefetchedData\s*=\s*(\{[\s\S]*?\});/);
    if (prefetchMatch) {
      try {
        const pData = JSON.parse(prefetchMatch[1]);
        const meta = pData["preview_metadata"];
        if (meta) {
          if (meta.file_version && meta.file_version.id) fileVersionId = String(meta.file_version.id);
          if (meta.name) fileName = String(meta.name);
          if (meta.representations && Array.isArray(meta.representations.entries)) {
            const webpRep = meta.representations.entries.find((e) => e.representation === "webp" || e.representation === "jpg");
            if (webpRep && webpRep.metadata && webpRep.metadata.pages) {
              pageCount = Number(webpRep.metadata.pages) || 1;
            }
          }
        }
      } catch (err) {
        // Fallback to regex
      }
    }

    // 2. Try Box.postStreamData fallback
    if (!fileVersionId) {
      const streamMatch = body.match(/Box\.postStreamData\s*=\s*(\{[\s\S]*?\});/);
      if (streamMatch) {
        try {
          const sData = JSON.parse(streamMatch[1]);
          for (const k in sData) {
            const entry = sData[k];
            if (entry && entry.items && entry.items[0]) {
              if (entry.items[0].name) fileName = entry.items[0].name;
            }
          }
        } catch (e) {}
      }
    }

    // 3. Fallback file version extraction
    if (!fileVersionId) {
      const fvMatch = body.match(/file_version_(\d+)/);
      if (fvMatch) fileVersionId = fvMatch[1];
    }

    const previewUrl = fileVersionId
      ? `https://app.box.com/representation/file_version_${fileVersionId}/thumb_1024.jpg?shared_name=${sharedName}`
      : "";

    return {
      fileVersionId,
      fileName,
      pageCount,
      previewUrl,
    };
  } catch (error) {
    console.warn(`[ITER_SCRAPER] Failed to resolve Box details for ${sharedName}:`, error.message);
    return null;
  }
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

      // Check if existing notice already has resolved box details
      const existing = await IterNotice.findOne({ noticeId });
      let boxDetails = null;

      if (existing && existing.boxFileVersionId && existing.boxPreviewUrl) {
        boxDetails = {
          fileVersionId: existing.boxFileVersionId,
          fileName: existing.boxFileName,
          pageCount: existing.pageCount,
          previewUrl: existing.boxPreviewUrl,
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
        pageCount: boxDetails ? boxDetails.pageCount : 1,
        fullUrl,
        assetUrl,
        scrapedAt: new Date(),
      };

      const doc = await IterNotice.findOneAndUpdate(
        { noticeId },
        { $set: noticeData, $setOnInsert: { isNewNotice: true } },
        { upsert: true, new: true }
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
  categorizeNotice,
  fetchHttpsWithRedirect,
};
