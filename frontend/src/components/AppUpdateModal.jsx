import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../hooks/useAuth';
import { appUpdateService } from '../services/appUpdateService';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  ShieldCheck,
  Settings as SettingsIcon,
  RefreshCw,
  ArrowDownCircle,
  PackageCheck,
} from 'lucide-react';

/**
 * Renders release notes text with responsive, mobile-first embedded screenshots, GIFs, and videos
 */
function ChangelogMediaRenderer({ releaseNotes, releaseMedia = [] }) {
  const [activePreview, setActivePreview] = useState(null);

  const parsed = useMemo(() => {
    if (!releaseNotes && (!releaseMedia || releaseMedia.length === 0)) {
      return { textLines: [], mediaItems: [] };
    }

    const lines = (releaseNotes || '').split('\n');
    const textLines = [];
    const mediaItems = [];

    const isImageUrl = (url) => /\.(gif|png|jpe?g|webp|svg)(\?.*)?$/i.test(url) || (typeof url === 'string' && url.startsWith('data:image/'));
    const isVideoUrl = (url) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
    const mdImageRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. Markdown image syntax ![alt](url)
      let match;
      let hasMdMedia = false;
      const stripped = line.replace(mdImageRegex, (m, alt, url) => {
        hasMdMedia = true;
        mediaItems.push({
          type: isVideoUrl(url) ? 'video' : 'image',
          url,
          alt: alt || 'Release visual',
        });
        return '';
      }).trim();

      if (hasMdMedia) {
        if (stripped) textLines.push(stripped);
        continue;
      }

      // 2. Direct media URL
      if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('data:image/')) {
        if (isImageUrl(line)) {
          mediaItems.push({ type: 'image', url: line, alt: 'Release screenshot' });
          continue;
        } else if (isVideoUrl(line)) {
          mediaItems.push({ type: 'video', url: line, alt: 'Release clip' });
          continue;
        }
      }

      // 3. Regular text line
      textLines.push(line);
    }

    // 4. Merge any explicit releaseMedia array URLs
    if (Array.isArray(releaseMedia)) {
      for (const url of releaseMedia) {
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'))) {
          if (!mediaItems.some((m) => m.url === url)) {
            mediaItems.push({
              type: isVideoUrl(url) ? 'video' : 'image',
              url,
              alt: 'Release media',
            });
          }
        }
      }
    }

    return { textLines, mediaItems };
  }, [releaseNotes, releaseMedia]);

  const renderFormattedText = (text) => {
    if (!text) return null;
    const parts = String(text).split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} style={{ color: '#ffffff', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div style={{ width: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {/* Text bullet items */}
      {parsed.textLines.length > 0 && (
        <div style={{ marginBottom: parsed.mediaItems.length > 0 ? '0.75rem' : 0 }}>
          {parsed.textLines.map((line, idx) => {
            // Header 1: # Title
            if (line.startsWith('# ')) {
              return (
                <div
                  key={idx}
                  style={{
                    fontSize: '0.925rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    marginTop: idx > 0 ? '10px' : '2px',
                    marginBottom: '4px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                    paddingBottom: '3px',
                  }}
                >
                  {renderFormattedText(line.replace(/^#\s+/, ''))}
                </div>
              );
            }
            // Header 2: ## Subtitle
            if (line.startsWith('## ')) {
              return (
                <div
                  key={idx}
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#e0e7ff',
                    marginTop: idx > 0 ? '8px' : '2px',
                    marginBottom: '3px',
                  }}
                >
                  {renderFormattedText(line.replace(/^##\s+/, ''))}
                </div>
              );
            }
            // Header 3: ### Section
            if (line.startsWith('### ')) {
              return (
                <div
                  key={idx}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#38bdf8',
                    marginTop: idx > 0 ? '6px' : '2px',
                    marginBottom: '3px',
                  }}
                >
                  {renderFormattedText(line.replace(/^###\s+/, ''))}
                </div>
              );
            }

            const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
            return (
              <div
                key={idx}
                style={{
                  fontSize: '0.78rem',
                  color: 'rgba(255, 255, 255, 0.85)',
                  lineHeight: 1.45,
                  marginBottom: '5px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                }}
              >
                {isBullet ? (
                  <>
                    <span style={{ color: '#818cf8', fontWeight: 800, flexShrink: 0, marginTop: '1px' }}>•</span>
                    <span style={{ flex: 1 }}>{renderFormattedText(line.replace(/^[•\-*]\s*/, ''))}</span>
                  </>
                ) : (
                  <span>{renderFormattedText(line)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Media Gallery (Screenshots / GIFs / Videos) */}
      {parsed.mediaItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          {parsed.mediaItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              }}
            >
              {item.type === 'video' ? (
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    display: 'block',
                    background: '#000',
                    borderRadius: '10px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div
                  onClick={() => setActivePreview(item.url)}
                  style={{ cursor: 'pointer', position: 'relative' }}
                  title="Tap to preview full size"
                >
                  <img
                    src={item.url}
                    alt={item.alt}
                    loading="lazy"
                    style={{
                      width: '100%',
                      maxHeight: '190px',
                      objectFit: 'contain',
                      display: 'block',
                      background: 'rgba(0, 0, 0, 0.25)',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {item.alt && item.alt !== 'Release screenshot' && item.alt !== 'Release visual' && item.alt !== 'Release media' && (
                    <div
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.65rem',
                        color: 'rgba(255, 255, 255, 0.75)',
                        background: 'rgba(0, 0, 0, 0.65)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {item.alt}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal on Tap */}
      {activePreview && (
        <div
          onClick={() => setActivePreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <img
            src={activePreview}
            alt="Full Preview"
            style={{
              maxWidth: '96%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
            }}
          />
          <button
            type="button"
            onClick={() => setActivePreview(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#ffffff',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppUpdateModal() {
  const [state, setState] = useState(() => appUpdateService.updateState);
  const [rechecking, setRechecking] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Only initialize and listen for app updates on native mobile apps
    if (!Capacitor.isNativePlatform()) return;

    appUpdateService.initialize();
    const unsubscribe = appUpdateService.subscribe((updatedState) => {
      setState(updatedState);
    });
    return () => unsubscribe();
  }, []);

  // Whenever the authenticated user changes (e.g. login/switch account), re-check for targeted updates
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (user?.registrationNumber) {
      appUpdateService.checkForUpdates();
    }
  }, [user?.registrationNumber]);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const isSuperAdmin =
    user?.role === 'superadmin' ||
    pathname.startsWith('/superadmin') ||
    (pathname === '/login' && search.includes('admin'));

  // 1. Super Admin is ALWAYS exempt from all update popups
  if (isSuperAdmin) {
    return null;
  }

  // 2. Never show mobile APK updater on regular web browsers
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  // 3. If release is suspended, suppress all update prompts
  if (state?.isSuspended && state?.downloadStatus === 'idle') {
    return null;
  }

  // Determine whether modal should be visible
  const isDownloadingOrActive =
    state?.downloadStatus === 'downloading' ||
    state?.downloadStatus === 'ready_to_install' ||
    state?.downloadStatus === 'permission_required' ||
    state?.downloadStatus === 'installing' ||
    state?.downloadStatus === 'error';

  const isUpdatePromptVisible =
    (state?.updateAvailable && (!state?.isDismissed || state?.forceUpdate)) || isDownloadingOrActive;

  const isManualResultVisible =
    state?.manualCheck &&
    (state?.manualCheckStatus === 'up_to_date' || state?.manualCheckStatus === 'error');

  if (!isUpdatePromptVisible && !isManualResultVisible) {
    return null;
  }

  const handleDismiss = () => {
    if (state?.forceUpdate) return;
    appUpdateService.dismissUpdate();
  };

  const handleUpdate = () => {
    appUpdateService.performUpdate();
  };

  const handleCancelDownload = () => {
    appUpdateService.cancelDownload();
  };

  const handleOpenSettings = () => {
    appUpdateService.openInstallPermissionSettings();
  };

  const handleRetryInstall = () => {
    appUpdateService.installDownloadedApk();
  };

  const handleResetAndRetry = () => {
    appUpdateService.resetDownloadState();
    appUpdateService.startInAppDownload();
  };

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await appUpdateService.checkForUpdates({ manual: true });
    } catch (e) {
      console.warn('Recheck update error:', e);
    } finally {
      setTimeout(() => setRechecking(false), 500);
    }
  };

  // Helper formatting for downloaded bytes
  const bytesDownloadedMb = (
    ((state?.downloadProgress?.bytesDownloaded) || 0) /
    (1024 * 1024)
  ).toFixed(1);
  const totalBytesMb = (state?.downloadProgress?.totalBytes || 0) > 0
    ? ((state.downloadProgress.totalBytes) / (1024 * 1024)).toFixed(1)
    : null;
  const percent = Math.max(0, Math.min(100, state?.downloadProgress?.percent || 0));

  const isDownloading = state?.downloadStatus === 'downloading';
  const isPermissionRequired = state?.downloadStatus === 'permission_required';
  const isInstalling = state?.downloadStatus === 'installing';
  const isDownloadError = state?.downloadStatus === 'error';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(8, 12, 26, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (!state.forceUpdate && !isDownloading && e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: 'min(92vh, 700px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(150deg, #131d3b 0%, #0c1328 100%)',
          borderRadius: '20px',
          border: state.forceUpdate
            ? '1px solid rgba(239, 68, 68, 0.45)'
            : '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: state.forceUpdate
            ? '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(239, 68, 68, 0.2)'
            : '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.2)',
          overflow: 'hidden',
          position: 'relative',
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Accent Bar */}
        <div
          style={{
            height: '4px',
            background:
              state.forceUpdate || isDownloadError || state.manualCheckStatus === 'error'
                ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #38bdf8 100%)',
          }}
        />

        {/* Close & Refresh Controls - Hidden during active downloading */}
        {!isDownloading && (
          <div
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={handleRecheck}
              disabled={rechecking}
              aria-label="Refresh update status"
              title="Check server again for latest release"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: rechecking ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={15} style={{ animation: rechecking ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>

            {!state.forceUpdate && (
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close dialog"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div style={{ padding: '1.25rem 1.5rem', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* ============================================================== */}
          {/* CASE 1: Manual Check - Up to date */}
          {/* ============================================================== */}
          {state.manualCheckStatus === 'up_to_date' && !state.updateAvailable && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: '#10b981',
                }}
              >
                <CheckCircle2 size={30} />
              </div>

              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>
                You're up to date!
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
                HostelCare <strong>v{state.currentVersion}</strong> is currently the latest released version. No updates are required.
              </p>

              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                }}
              >
                Done
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 1B: Manual Check - Error */}
          {/* ============================================================== */}
          {state.manualCheckStatus === 'error' && !state.updateAvailable && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: '#ef4444',
                }}
              >
                <AlertCircle size={30} />
              </div>

              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>
                Check for Updates
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
                {state.manualCheckMessage || state.errorMessage || 'Unable to check for updates. Please check your internet connection and try again.'}
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: rechecking ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={14} style={{ animation: rechecking ? 'spin 0.8s linear infinite' : 'none' }} />
                  {rechecking ? 'Checking...' : 'Retry'}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 2: Active In-App Downloading with Live Progress Bar */}
          {/* ============================================================== */}
          {isDownloading && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              {/* Animated Download Pulse Icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  color: '#818cf8',
                  position: 'relative',
                }}
              >
                <ArrowDownCircle size={32} />
              </div>

              <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Downloading HostelCare v{state.latestVersion}
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                Please stay in the app while the update is being downloaded.
              </p>

              {/* Progress Bar Container */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '999px',
                  height: '10px',
                  width: '100%',
                  overflow: 'hidden',
                  marginBottom: '0.75rem',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #38bdf8 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.2s ease-out',
                    boxShadow: '0 0 12px rgba(99, 102, 241, 0.8)',
                  }}
                />
              </div>

              {/* Progress Text Details */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.65)',
                  marginBottom: '1.25rem',
                  fontWeight: 600,
                }}
              >
                <span>
                  {bytesDownloadedMb} MB {totalBytesMb ? `/ ${totalBytesMb} MB` : ''}
                </span>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                  {percent}%
                </span>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCancelDownload}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'rgba(255, 255, 255, 0.75)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                Cancel Download
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 3: Permission Required to Install Unknown Apps (Android 8.0+) */}
          {/* ============================================================== */}
          {isPermissionRequired && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: '#f59e0b',
                }}
              >
                <SettingsIcon size={28} />
              </div>

              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>
                Install Permission Required
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5 }}>
                Android requires permission to install updates directly inside HostelCare. Please enable <strong>"Allow from this source"</strong> in Settings, then return to the app.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <SettingsIcon size={18} />
                  Open Android Settings
                </button>

                <button
                  type="button"
                  onClick={handleRetryInstall}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  I've Enabled It (Install Now)
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 4: System Installer Opened / Installing */}
          {/* ============================================================== */}
          {isInstalling && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '18px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  color: '#38bdf8',
                }}
              >
                <PackageCheck size={32} />
              </div>

              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 800 }}>
                System Installer Launched
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5 }}>
                Android's installation screen is now active. Please tap <strong>"Update"</strong> on your device screen to finish.
              </p>

              <button
                type="button"
                onClick={handleRetryInstall}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw size={16} />
                Relaunch Installer
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 5: Download or Verification Error */}
          {/* ============================================================== */}
          {isDownloadError && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: '#ef4444',
                }}
              >
                <AlertCircle size={30} />
              </div>

              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>
                Update Failed
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5 }}>
                {state.errorMessage || 'Unable to download the update package. Please check your internet connection and try again.'}
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                {!state.forceUpdate && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetAndRetry}
                  style={{
                    flex: state.forceUpdate ? 1 : 2,
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <RefreshCw size={16} />
                  Retry Download
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASE 6: New Update Available Prompt (Idle state before click) */}
          {/* ============================================================== */}
          {!isDownloading && !isPermissionRequired && !isInstalling && !isDownloadError && state.updateAvailable && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    background: state.forceUpdate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    border: state.forceUpdate ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: state.forceUpdate ? '#f87171' : '#818cf8',
                  }}
                >
                  {state.forceUpdate ? <AlertCircle size={26} /> : <Sparkles size={26} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: state.forceUpdate ? '#f87171' : '#a5b4fc', letterSpacing: '0.04em' }}>
                    {state.forceUpdate ? 'CRITICAL UPDATE REQUIRED' : 'HOSTELCARE IN-APP UPDATE'}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    {state.forceUpdate ? 'Update Required to Continue' : 'New Version Available!'}
                  </h3>
                </div>
              </div>

              {/* Version Comparison Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.825rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                  Current: <strong>v{state.currentVersion}</strong>
                </span>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>→</span>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                  Available: <strong>v{state.latestVersion}</strong>
                </span>
              </div>

              {/* Message */}
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.5 }}>
                {state.updateMessage || 'A new update for HostelCare is ready to install directly inside the app.'}
              </p>

              {/* Release Notes with Media (Screenshots / GIFs / Videos) */}
              {(state.releaseNotes || (state.releaseMedia && state.releaseMedia.length > 0)) && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    borderRadius: '12px',
                    padding: '0.75rem 0.9rem',
                    marginBottom: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#38bdf8',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>✨ What's New:</span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: 'rgba(255, 255, 255, 0.65)',
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        fontWeight: 600,
                      }}
                    >
                      ↕️ Scroll to view all
                    </span>
                  </div>

                  {/* Scroller Box for Notes & Media */}
                  <div
                    style={{
                      maxHeight: 'min(195px, 26vh)',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehavior: 'contain',
                      paddingRight: '4px',
                    }}
                  >
                    <ChangelogMediaRenderer
                      releaseNotes={state.releaseNotes}
                      releaseMedia={state.releaseMedia}
                    />
                  </div>
                </div>
              )}

              {/* Security Checksum Verification Badge */}
              {state.apkSha256 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.7rem',
                    color: '#34d399',
                    marginBottom: '1rem',
                    padding: '0.4rem 0.6rem',
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                  }}
                >
                  <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                  <span>Verified SHA-256 Release Security Check</span>
                </div>
              )}

              {/* Download link configuration warning */}
              {state.apkDownloadError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '1rem',
                    fontSize: '0.75rem',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{state.apkDownloadError}</span>
                </div>
              )}

              {/* Action Buttons - Sticky at Bottom */}
              <div
                style={{
                  position: 'sticky',
                  bottom: '-1.25rem',
                  left: 0,
                  right: 0,
                  margin: '0.5rem -1.5rem -1.25rem -1.5rem',
                  padding: '0.85rem 1.5rem 1.15rem',
                  background: 'linear-gradient(to top, #0c1328 92%, rgba(12, 19, 40, 0.95) 100%)',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  zIndex: 20,
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.6)',
                }}
              >
                {!state.forceUpdate && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    style={{
                      flex: '1 1 70px',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Later
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  style={{
                    flex: '1 1 105px',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#a5b4fc',
                    fontWeight: 600,
                    fontSize: '0.825rem',
                    cursor: rechecking ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  title="Check server again for latest update details"
                >
                  <RefreshCw size={14} style={{ animation: rechecking ? 'spin 0.8s linear infinite' : 'none' }} />
                  {rechecking ? 'Checking...' : 'Check Again'}
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  style={{
                    flex: state.forceUpdate ? '2 1 180px' : '2 1 135px',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: state.forceUpdate
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    boxShadow: state.forceUpdate
                      ? '0 4px 15px rgba(239, 68, 68, 0.4)'
                      : '0 4px 15px rgba(99, 102, 241, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Download size={16} />
                  {state.forceUpdate ? 'Update Now (Required)' : 'Update Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
