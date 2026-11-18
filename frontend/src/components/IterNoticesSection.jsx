import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
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

function getAbsoluteDownloadUrl(endpointBase, noticeId) {
  if (endpointBase && endpointBase.startsWith("http")) {
    return `${endpointBase}/iter-notices/${noticeId}/download`;
  }
  const isLocalOrCapacitor =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.protocol === "capacitor:" ||
      window.location.protocol === "file:");
  const origin = isLocalOrCapacitor
    ? "https://hostelcare-api.duckdns.org"
    : (window.location.origin || "https://hostelcare-api.duckdns.org");
  return `${origin}/api/v1/academics/iter-notices/${noticeId}/download`;
}

export default function IterNoticesSection({ apiBaseUrl }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Full-Screen Modal & Multi-Page View States
  const [activeNoticeModal, setActiveNoticeModal] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
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

  // High-Performance PDF Download with Real-Time Percentage & Android Storage Support
  const handleDownloadPdf = async (noticeId, title) => {
    try {
      setDownloadingId(noticeId);
      setDownloadProgress(15);

      const fullUrl = getAbsoluteDownloadUrl(endpointBase, noticeId);

      // 1. Android Native Capacitor Platform
      if (Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 90000) + 1000,
                title: "📥 Downloading Official Notice PDF",
                body: `${(title || "ITER Circular").slice(0, 48)}... Saving to phone Downloads.`,
                schedule: { at: new Date(Date.now() + 100) },
              },
            ],
          });
        } catch (notifErr) {
          console.warn("[DOWNLOAD_NOTIF_WARN]", notifErr);
        }

        setDownloadProgress(45);

        // Pre-warm HEAD request so backend prepares and caches multi-page PDF on disk
        try {
          await fetch(fullUrl, { method: "HEAD" });
        } catch (_) {}

        setDownloadProgress(80);

        // Hand off to Android Native Download Manager (saves directly to /storage/emulated/0/Download/)
        window.open(fullUrl, "_system");

        setDownloadProgress(100);
        setTimeout(() => {
          setDownloadingId(null);
          setDownloadProgress(0);
        }, 1200);
        return;
      }

      // 2. Standard Web / Desktop Browsers (Direct Blob Stream)
      setDownloadProgress(35);
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      setDownloadProgress(70);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `HostelCare-SOA-ITER-${slugify(title || noticeId)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);

      setDownloadProgress(100);
      setTimeout(() => {
        setDownloadingId(null);
        setDownloadProgress(0);
      }, 1000);
    } catch (err) {
      console.error("[ITER_DOWNLOAD_ERROR]", err);
      const fallbackUrl = getAbsoluteDownloadUrl(endpointBase, noticeId);
      window.open(fallbackUrl, "_blank");
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  const openNoticeModal = (notice) => {
    setActiveNoticeModal(notice);
    setZoomLevel(1);
  };

  const closeNoticeModal = () => {
    setActiveNoticeModal(null);
    setZoomLevel(1);
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
                    {downloadingId === notice.noticeId
                      ? `⏳ Downloading ${downloadProgress || 15}%...`
                      : `⬇️ Download PDF${pages > 1 ? ` (${pages} Pgs)` : ""}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
         FULL-SCREEN IMMERSIVE NOTICE DOCUMENT VIEWER (CONTINUOUS SCROLL & ZOOM)
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
                  {totalPages > 1 && (
                    <span className="iter-page-count-badge">
                      📑 {totalPages} Pages Continuous
                    </span>
                  )}
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
                  {downloadingId === activeNoticeModal.noticeId
                    ? `⏳ Downloading ${downloadProgress || 15}%...`
                    : "⬇️ Download PDF"}
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

            {/* Document Body Viewport with Continuous Scroll & Zoom Controls */}
            <div className="iter-doc-viewport fullscreen">
              {/* Floating Multi-Page & Zoom Bar */}
              <div className="iter-doc-controls-bar">
                <div className="iter-controls-doc-info">
                  <span className="iter-pages-total-pill">
                    📄 {totalPages} {totalPages > 1 ? "Pages • Scroll vertically to read all" : "Page Document"}
                  </span>
                </div>

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

              {/* Continuous Vertical Scroll of ALL Notice Pages */}
              <div
                className="iter-pages-scroll-container"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top center",
                }}
              >
                {Array.from({ length: totalPages }, (_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <div key={pageNum} className="iter-page-sheet">
                      {totalPages > 1 && (
                        <div className="iter-page-sheet-badge">
                          <span>📄 Page {pageNum} of {totalPages}</span>
                          <span style={{ opacity: 0.6 }}>• Official SOA ITER Circular</span>
                        </div>
                      )}
                      <div className="iter-doc-image-wrapper">
                        <img
                          src={`${endpointBase}/iter-notices/${activeNoticeModal.noticeId}/preview?page=${pageNum}`}
                          alt={`${activeNoticeModal.title} - Page ${pageNum}`}
                          className="iter-doc-image"
                          loading={pageNum === 1 ? "eager" : "lazy"}
                          onError={(e) => {
                            if (pageNum === 1 && activeNoticeModal.assetUrl && e.target.src !== activeNoticeModal.assetUrl) {
                              e.target.src = activeNoticeModal.assetUrl;
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fullscreen Modal Footer */}
            <div className="iter-modal-footer fullscreen">
              <span className="iter-verified-badge">
                ✅ Official Siksha 'O' Anusandhan (SOA) Circular • {totalPages} {totalPages > 1 ? "Pages Complete" : "Page"}
              </span>
              <button
                type="button"
                className="iter-modal-download-btn"
                disabled={downloadingId === activeNoticeModal.noticeId}
                onClick={() => handleDownloadPdf(activeNoticeModal.noticeId, activeNoticeModal.title)}
              >
                {downloadingId === activeNoticeModal.noticeId
                  ? `⏳ Downloading ${downloadProgress || 15}%...`
                  : `⬇️ Download Full PDF (${totalPages} Pages)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
