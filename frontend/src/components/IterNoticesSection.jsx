import React, { useState, useEffect } from "react";
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

export default function IterNoticesSection({ apiBaseUrl }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNoticeModal, setActiveNoticeModal] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imgLoading, setImgLoading] = useState(true);
  const [realtimeAlert, setRealtimeAlert] = useState(null);

  const endpointBase = apiBaseUrl || "/api/v1/academics";

  const fetchNotices = async (cat = selectedCategory, search = searchQuery) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (cat && cat !== "all") params.append("category", cat);
      if (search && search.trim()) params.append("search", search.trim());

      const res = await fetch(`${endpointBase}/iter-notices?${params.toString()}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (json.success && Array.isArray(json.notices)) {
        setNotices(json.notices);
      }
    } catch (err) {
      console.error("[ITER_NOTICES_LOAD_ERROR]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices(selectedCategory, searchQuery);
  }, [selectedCategory]);

  // Real-time socket listener for freshly published notices
  useEffect(() => {
    const removeListener = addChatListener("iter:new_notice", (newNotice) => {
      if (newNotice) {
        setRealtimeAlert(`⚡ New Notice Published: ${newNotice.title}`);
        setNotices((prev) => [newNotice, ...prev.filter((n) => n.noticeId !== newNotice.noticeId)]);
        setTimeout(() => setRealtimeAlert(null), 8000);
      }
    });
    return () => {
      if (typeof removeListener === "function") removeListener();
    };
  }, []);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`${endpointBase}/iter-notices/sync`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        await fetchNotices();
      }
    } catch (err) {
      console.error("[ITER_MANUAL_SYNC_ERROR]", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadPdf = (noticeId, title) => {
    // Download directly through HostelCare backend proxy
    const downloadUrl = `${endpointBase}/iter-notices/${noticeId}/download`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    link.download = `HostelCare-SOA-ITER-${noticeId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openNoticeModal = (notice) => {
    setActiveNoticeModal(notice);
    setZoomLevel(1);
    setImgLoading(true);
  };

  const closeNoticeModal = () => {
    setActiveNoticeModal(null);
    setZoomLevel(1);
    setImgLoading(true);
  };

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
            <span className="iter-live-dot" title="Live Auto-Sync Active"></span>
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
                </div>

                <div className="iter-card-actions">
                  <button
                    type="button"
                    className="iter-view-btn"
                    onClick={() => openNoticeModal(notice)}
                  >
                    👁️ View In-App
                  </button>
                  <button
                    type="button"
                    className="iter-download-btn"
                    title="Download Official Notice PDF"
                    onClick={() => handleDownloadPdf(notice.noticeId, notice.title)}
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
         IN-APP NOTICE DOCUMENT VIEWER MODAL (ZERO EXTERNAL REDIRECTS)
         ========================================================================= */}
      {activeNoticeModal && (
        <div className="iter-modal-backdrop" onClick={closeNoticeModal}>
          <div className="iter-modal-window" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="iter-modal-header">
              <div className="iter-modal-title-wrap">
                <h3 className="iter-modal-title">{activeNoticeModal.title}</h3>
                <div className="iter-modal-meta">
                  <span>📅 Published: {new Date(activeNoticeModal.publishDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span>•</span>
                  <span className={`iter-category-badge ${activeNoticeModal.category || "general"}`}>
                    {activeNoticeModal.categoryLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="iter-modal-close-btn"
                onClick={closeNoticeModal}
                title="Close Viewer"
              >
                ✕
              </button>
            </div>

            {/* Document Body Viewport with Zoom Controls */}
            <div className="iter-doc-viewport">
              <div className="iter-doc-controls-bar">
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

              {/* Loading Spinner */}
              {imgLoading && (
                <div style={{ color: "#D8D0C5", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>📄</span>
                  Rendering high-resolution document...
                </div>
              )}

              {/* Render High-Res Notice Image directly through backend proxy */}
              <div
                className="iter-doc-image-wrapper"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top center",
                  display: imgLoading ? "none" : "block",
                }}
              >
                <img
                  src={`${endpointBase}/iter-notices/${activeNoticeModal.noticeId}/preview`}
                  alt={activeNoticeModal.title}
                  className="iter-doc-image"
                  loading="eager"
                  onLoad={() => setImgLoading(false)}
                  onError={(e) => {
                    setImgLoading(false);
                    // Fallback to assetUrl if box preview proxy fails
                    if (activeNoticeModal.assetUrl && e.target.src !== activeNoticeModal.assetUrl) {
                      e.target.src = activeNoticeModal.assetUrl;
                    }
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="iter-modal-footer">
              <span className="iter-verified-badge">
                ✅ Official SOA ITER Signed Circular • In-App Secured
              </span>
              <button
                type="button"
                className="iter-modal-download-btn"
                onClick={() => handleDownloadPdf(activeNoticeModal.noticeId, activeNoticeModal.title)}
              >
                ⬇️ Download Official PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
