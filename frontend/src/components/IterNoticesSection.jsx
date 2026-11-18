import React, { useState, useEffect, useRef } from "react";
import { addChatListener } from "../services/chatSocketService";
import "./IterNoticesSection.css";

const CATEGORIES = [
  { id: "all", label: "All Notices", icon: "📋" },
  { id: "exam", label: "Examination", icon: "🎯" },
  { id: "cyclone_alert", label: "Advisories & Alerts", icon: "⚠️" },
  { id: "academic", label: "Academic Schedule", icon: "📅" },
  { id: "administrative", label: "Student Affairs", icon: "🏛️" },
  { id: "holiday", label: "Holidays", icon: "🌴" },
];

function slugify(text) {
  return String(text || "notice")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function IterNoticesSection({ apiBaseUrl }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Full-Screen Modal & Multi-Page View States
  const [activeNoticeModal, setActiveNoticeModal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imgLoading, setImgLoading] = useState(true);
  const [realtimeAlert, setRealtimeAlert] = useState(null);

  const endpointBase = apiBaseUrl || "/api/v1/academics";
  const lastFetchedTime = useRef(Date.now());

  const fetchNotices = async (cat = selectedCategory, search = searchQuery, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      if (cat && cat !== "all") params.append("category", cat);
      if (search && search.trim()) params.append("search", search.trim());

      const res = await fetch(`${endpointBase}/iter-notices?${params.toString()}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (json.success && Array.isArray(json.notices)) {
        setNotices(json.notices);
        lastFetchedTime.current = Date.now();
      }
    } catch (err) {
      console.error("[ITER_NOTICES_LOAD_ERROR]", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices(selectedCategory, searchQuery);
  }, [selectedCategory]);

  // Auto-Sync: Listen to real-time socket events + Auto-refresh on App focus
  useEffect(() => {
    // 1. Real-time push listener
    const removeListener = addChatListener("iter:new_notice", (newNotice) => {
      if (newNotice) {
        setRealtimeAlert(`⚡ New Notice Published: ${newNotice.title}`);
        setNotices((prev) => [newNotice, ...prev.filter((n) => n.noticeId !== newNotice.noticeId)]);
        setTimeout(() => setRealtimeAlert(null), 8000);
      }
    });

    // 2. Window focus re-check (if idle for > 5 mins)
    const handleFocus = () => {
      if (Date.now() - lastFetchedTime.current > 5 * 60 * 1000) {
        fetchNotices(selectedCategory, searchQuery, true);
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      if (typeof removeListener === "function") removeListener();
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedCategory, searchQuery]);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`${endpointBase}/iter-notices/sync`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        await fetchNotices(selectedCategory, searchQuery);
      }
    } catch (err) {
      console.error("[ITER_MANUAL_SYNC_ERROR]", err);
    } finally {
      setSyncing(false);
    }
  };

  // In-App Blob Download (Zero External Chrome / Browser Redirects)
  const handleDownloadPdf = async (noticeId, title) => {
    try {
      setDownloadingId(noticeId);
      const downloadUrl = `${endpointBase}/iter-notices/${noticeId}/download`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `HostelCare-SOA-ITER-${slugify(title || noticeId)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.error("[ITER_DOWNLOAD_ERROR]", err);
      // Fallback
      window.open(`${endpointBase}/iter-notices/${noticeId}/download`, "_self");
    } finally {
      setDownloadingId(null);
    }
  };

  const openNoticeModal = (notice) => {
    setActiveNoticeModal(notice);
    setCurrentPage(1);
    setZoomLevel(1);
    setImgLoading(true);
  };

  const closeNoticeModal = () => {
    setActiveNoticeModal(null);
    setCurrentPage(1);
    setZoomLevel(1);
    setImgLoading(true);
  };

  const totalPages = activeNoticeModal ? (activeNoticeModal.pageCount || 1) : 1;

  return (
    <div className="iter-notices-container">
      {/* Real-time Alert Toast */}
      {realtimeAlert && (
        <div style={{
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid #10B981",
          color: "#10B981",
          padding: "10px 16px",
          borderRadius: 12,
          fontWeight: 600,
          fontSize: "0.85rem",
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "fadeInNotice 0.25s ease-out"
        }}>
          <span>📢</span>
          <span>{realtimeAlert}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="iter-notices-header">
        <div className="iter-header-info">
          <h2 className="iter-header-title">
            <span className="iter-live-dot" title="Live Auto-Sync Active (Every 20 mins)"></span>
            Official ITER College Notices
          </h2>
          <p className="iter-header-subtitle">
            Direct real-time circulars from Siksha 'O' Anusandhan (SOA) • Page 1 Official Feed
          </p>
        </div>
        <div className="iter-header-actions">
          <button
            type="button"
            className="iter-refresh-btn"
            onClick={handleManualSync}
            disabled={syncing}
            title="Check ITER website for new notices right now"
          >
            <span style={{ display: "inline-block", transform: syncing ? "rotate(360deg)" : "none", transition: "transform 1s linear" }}>
              🔄
            </span>
            {syncing ? "Checking..." : "Sync Fresh"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="iter-filter-bar">
        <div className="iter-search-input-wrap">
          <span className="iter-search-icon">🔍</span>
          <input
            type="text"
            className="iter-search-input"
            placeholder="Search circulars, examination programmes, advisories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchNotices(selectedCategory, searchQuery);
            }}
          />
        </div>

        {/* Category Pills */}
        <div className="iter-category-chips">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`iter-cat-chip ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span style={{ marginRight: 4 }}>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notices Grid */}
      {loading ? (
        <div className="iter-empty-state">
          <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>⏳</span>
          <p style={{ margin: 0 }}>Loading official ITER notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="iter-empty-state">
          <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>📭</span>
          <p style={{ margin: 0 }}>No notices found matching your criteria.</p>
        </div>
      ) : (
        <div className="iter-notices-grid">
          {notices.map((notice) => {
            const formattedDate = notice.publishDate
              ? new Date(notice.publishDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Recent";

            const pages = notice.pageCount || 1;

            return (
              <div key={notice._id || notice.noticeId} className="iter-notice-card">
                <div>
                  <div className="iter-card-top-row">
                    <span className={`iter-category-badge ${notice.category || "general"}`}>
                      {notice.categoryLabel || "Circular"}
                    </span>
                    <span className="iter-date-chip">
                      📅 {formattedDate}
                    </span>
                  </div>

                  <h3 className="iter-notice-title" style={{ marginTop: 10 }}>
                    {notice.title}
                  </h3>

                  {pages > 1 && (
                    <div style={{ marginTop: 6, fontSize: "0.74rem", color: "var(--accent-terracotta, #C07660)", fontWeight: 700 }}>
                      📑 {pages} Pages (Full Programme)
                    </div>
                  )}
                </div>

                <div className="iter-card-actions">
                  <button
                    type="button"
                    className="iter-view-btn"
                    onClick={() => openNoticeModal(notice)}
                  >
                    👁️ Full Screen View
                  </button>
                  <button
                    type="button"
                    className="iter-download-btn"
                    title="Download Official Notice PDF (All Pages)"
                    disabled={downloadingId === notice.noticeId}
                    onClick={() => handleDownloadPdf(notice.noticeId, notice.title)}
                  >
                    {downloadingId === notice.noticeId ? "⏳ Saving..." : "⬇️ Download PDF"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
         FULL-SCREEN IMMERSIVE NOTICE DOCUMENT VIEWER (MULTI-PAGE & ZOOM)
         ========================================================================= */}
      {activeNoticeModal && (
        <div className="iter-modal-backdrop fullscreen" onClick={closeNoticeModal}>
          <div className="iter-modal-window fullscreen" onClick={(e) => e.stopPropagation()}>
            {/* Fullscreen Header Bar */}
            <div className="iter-modal-header fullscreen">
              <div className="iter-modal-title-wrap">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span className={`iter-category-badge ${activeNoticeModal.category || "general"}`}>
                    {activeNoticeModal.categoryLabel}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary, #6E685E)" }}>
                    📅 {new Date(activeNoticeModal.publishDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <h3 className="iter-modal-title">{activeNoticeModal.title}</h3>
              </div>

              {/* Action buttons on header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  className="iter-modal-download-btn"
                  disabled={downloadingId === activeNoticeModal.noticeId}
                  onClick={() => handleDownloadPdf(activeNoticeModal.noticeId, activeNoticeModal.title)}
                >
                  {downloadingId === activeNoticeModal.noticeId ? "⏳ Downloading..." : "⬇️ Download PDF"}
                </button>
                <button
                  type="button"
                  className="iter-modal-close-btn"
                  onClick={closeNoticeModal}
                  title="Close Full Screen Viewer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Document Body Viewport with Multi-Page & Zoom Controls */}
            <div className="iter-doc-viewport fullscreen">
              {/* Floating Multi-Page & Zoom Bar */}
              <div className="iter-doc-controls-bar">
                {/* Page Navigation if Multi-page */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, borderRight: "1px solid rgba(255, 255, 255, 0.2)", paddingRight: 8 }}>
                    <button
                      type="button"
                      className="iter-page-nav-btn"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        setCurrentPage((p) => Math.max(1, p - 1));
                        setImgLoading(true);
                      }}
                      title="Previous Page"
                    >
                      ◀
                    </button>
                    <span className="iter-page-indicator">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="iter-page-nav-btn"
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                        setImgLoading(true);
                      }}
                      title="Next Page"
                    >
                      ▶
                    </button>
                  </div>
                )}

                {/* Zoom Controls */}
                <button
                  type="button"
                  className="iter-zoom-btn"
                  onClick={() => setZoomLevel((z) => Math.max(0.6, Number((z - 0.2).toFixed(1))))}
                  title="Zoom Out"
                >
                  🔍 –
                </button>
                <span className="iter-zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  className="iter-zoom-btn"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.2).toFixed(1))))}
                  title="Zoom In"
                >
                  🔍 +
                </button>
                <button
                  type="button"
                  className="iter-zoom-btn"
                  onClick={() => setZoomLevel(1)}
                  title="Reset Zoom"
                >
                  ⟲ Reset
                </button>
              </div>

              {/* Loading Indicator */}
              {imgLoading && (
                <div style={{ color: "#D8D0C5", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>📄</span>
                  Loading Page {currentPage} of {totalPages}...
                </div>
              )}

              {/* Render High-Res Notice Image */}
              <div
                className="iter-doc-image-wrapper"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top center",
                  display: imgLoading ? "none" : "block",
                }}
              >
                <img
                  key={`${activeNoticeModal.noticeId}-p${currentPage}`}
                  src={`${endpointBase}/iter-notices/${activeNoticeModal.noticeId}/preview?page=${currentPage}`}
                  alt={`${activeNoticeModal.title} - Page ${currentPage}`}
                  className="iter-doc-image"
                  loading="eager"
                  onLoad={() => setImgLoading(false)}
                  onError={(e) => {
                    setImgLoading(false);
                    if (activeNoticeModal.assetUrl && e.target.src !== activeNoticeModal.assetUrl) {
                      e.target.src = activeNoticeModal.assetUrl;
                    }
                  }}
                />
              </div>

              {/* Bottom Multi-Page Quick Navigation Pills if Multi-page */}
              {totalPages > 1 && (
                <div className="iter-page-pills-row">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      className={`iter-page-pill ${currentPage === pg ? "active" : ""}`}
                      onClick={() => {
                        if (currentPage !== pg) {
                          setCurrentPage(pg);
                          setImgLoading(true);
                        }
                      }}
                    >
                      Page {pg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Modal Footer */}
            <div className="iter-modal-footer fullscreen">
              <span className="iter-verified-badge">
                ✅ Official Siksha 'O' Anusandhan (SOA) Circular • Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="iter-modal-download-btn"
                disabled={downloadingId === activeNoticeModal.noticeId}
                onClick={() => handleDownloadPdf(activeNoticeModal.noticeId, activeNoticeModal.title)}
              >
                {downloadingId === activeNoticeModal.noticeId ? "⏳ Downloading..." : `⬇️ Download Full PDF (${totalPages} Pages)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
