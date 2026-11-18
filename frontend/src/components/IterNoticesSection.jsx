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
  const [downloadProgress, setDownloadProgress] = useState({}); // { [noticeId]: { percent: number, status: 'loading' | 'done' | 'error' } }
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

  const closeNoticeModal = () => {
    setActiveNoticeModal(null);
    if (typeof window !== "undefined" && window.history.state && window.history.state.iterNoticeViewerOpen) {
      window.history.back();
    }
  };

  const openNoticeModal = (notice) => {
    setActiveNoticeModal(notice);
  };

  // Native Android Hardware Back Button + History Guard (Zero App Restart)
  useEffect(() => {
    if (!activeNoticeModal) return;

    // Push history entry so back pops this state cleanly without closing app
    window.history.pushState({ iterNoticeViewerOpen: true }, "");

    const handlePopState = () => {
      setActiveNoticeModal(null);
    };
    window.addEventListener("popstate", handlePopState);

    // Capacitor Native Android Hardware Back Button listener
    let backListenerHandle = null;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app")
        .then(({ App }) => {
          App.addListener("backButton", () => {
            setActiveNoticeModal((prev) => {
              if (prev) {
                if (window.history.state && window.history.state.iterNoticeViewerOpen) {
                  window.history.back();
                }
                return null;
              }
              return prev;
            });
          }).then((handle) => {
            backListenerHandle = handle;
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (backListenerHandle && typeof backListenerHandle.remove === "function") {
        backListenerHandle.remove();
      }
    };
  }, [activeNoticeModal]);

  // Tarika 1: Google Drive Viewer & Exporter (100% OTA • All Pages • Direct Save to Drive & Phone)
  const handleOpenDrive = (notice) => {
    if (!notice) return;
    const noticeId = notice.noticeId;
    const fullDownloadUrl = getAbsoluteDownloadUrl(endpointBase, noticeId);

    // Google Docs / Drive Viewer URL fetches full multi-page PDF, displays all pages, and has direct Download & Save to Drive buttons
    const driveUrl = `https://docs.google.com/viewerng/viewer?url=${encodeURIComponent(fullDownloadUrl)}`;
    window.open(driveUrl, "_system");
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

                  <div style={{ marginTop: 6, fontSize: "0.75rem", color: pages > 1 ? "var(--accent-terracotta, #C07660)" : "var(--hc-text-muted, #8E8A83)", fontWeight: 700 }}>
                    {pages > 1 ? `📑 ${pages} Pages Complete Official Circular` : "📄 1 Page Official Circular"}
                  </div>
                </div>

                <div className="iter-card-actions">
                  <button
                    type="button"
                    className="iter-view-btn"
                    onClick={() => openNoticeModal(notice)}
                  >
                    👁️ In-App Full View
                  </button>
                  <button
                    type="button"
                    className="iter-download-btn"
                    title={`Open in Google Drive & Save ${pages} ${pages > 1 ? "Pages" : "Page"} PDF to Device`}
                    onClick={() => handleOpenDrive(notice)}
                  >
                    📑 Drive & Save ({pages} {pages > 1 ? "Pgs" : "Pg"})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
         EDGE-TO-EDGE PURE IMMERSIVE DOCUMENT VIEWER (MATCHING CHROME PDF READER)
         ========================================================================= */}
      {activeNoticeModal && (
        <div className="iter-fullscreen-viewer">
          {/* Minimal Sleek Floating Top Bar */}
          <div className="iter-fs-topbar">
            <button
              type="button"
              className="iter-fs-back-btn"
              onClick={closeNoticeModal}
              title="Back to Notices"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Back</span>
            </button>

            <div className="iter-fs-title-text" title={activeNoticeModal.title}>
              {activeNoticeModal.title}
            </div>

            <button
              type="button"
              className="iter-fs-download-btn"
              onClick={() => handleOpenDrive(activeNoticeModal)}
              title="Open in Google Drive to Save or Print all pages"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Drive Save ({totalPages} {totalPages > 1 ? "Pgs" : "Pg"})</span>
            </button>
          </div>

          {/* 100% Edge-to-Edge Document Viewport (Continuous Vertical Stack) */}
          <div className="iter-fs-document-scroll">
            <div className="iter-fs-pages-stack">
              {Array.from({ length: totalPages }, (_, idx) => {
                const pageNum = idx + 1;
                return (
                  <div key={pageNum} className="iter-fs-page-wrapper">
                    <img
                      src={`${endpointBase}/iter-notices/${activeNoticeModal.noticeId}/preview?page=${pageNum}`}
                      alt={`${activeNoticeModal.title} - Page ${pageNum}`}
                      className="iter-fs-page-img"
                      loading={pageNum === 1 ? "eager" : "lazy"}
                      onError={(e) => {
                        if (pageNum === 1 && activeNoticeModal.assetUrl && e.target.src !== activeNoticeModal.assetUrl) {
                          e.target.src = activeNoticeModal.assetUrl;
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
