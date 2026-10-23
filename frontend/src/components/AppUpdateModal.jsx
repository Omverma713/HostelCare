import React, { useState, useEffect } from 'react';
import { appUpdateService } from '../services/appUpdateService';
import { ArrowUpCircle, AlertTriangle, ShieldCheck, Download, RefreshCw, X, CheckCircle2 } from 'lucide-react';

export default function AppUpdateModal() {
  const [state, setState] = useState(() => appUpdateService.updateState);

  useEffect(() => {
    // Initialize update service listeners
    appUpdateService.initialize();
    const unsubscribe = appUpdateService.subscribe((updatedState) => {
      setState(updatedState);
    });
    return () => unsubscribe();
  }, []);

  // Prevent Android back button from dismissing forced update
  useEffect(() => {
    if (state.forceUpdate && state.updateAvailable) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [state.forceUpdate, state.updateAvailable]);

  // If no update available or dismissed, do not render modal
  if (!state.updateAvailable || state.isDismissed) {
    return null;
  }

  const isForced = state.forceUpdate;
  const isDownloaded = state.flexibleUpdateDownloaded;
  const progress = state.flexibleDownloadProgress;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: isForced ? 'rgba(5, 10, 25, 0.96)' : 'rgba(10, 15, 30, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.25s ease-out',
      }}
      onClick={(e) => {
        // Only allow clicking outside if NOT a forced update
        if (!isForced && e.target === e.currentTarget) {
          appUpdateService.dismissUpdate();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'linear-gradient(145deg, #131d3b 0%, #0d152c 100%)',
          borderRadius: '16px',
          border: isForced ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: isForced
            ? '0 20px 50px rgba(239, 68, 68, 0.25), 0 0 0 1px rgba(239, 68, 68, 0.2)'
            : '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 25px rgba(99, 102, 241, 0.2)',
          overflow: 'hidden',
          position: 'relative',
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top Decorative Header Accent */}
        <div
          style={{
            height: '4px',
            background: isForced
              ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #3b82f6 100%)',
          }}
        />

        {/* Optional Modal Close Button */}
        {!isForced && (
          <button
            type="button"
            onClick={() => appUpdateService.dismissUpdate()}
            aria-label="Dismiss update dialog"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <X size={18} />
          </button>
        )}

        <div style={{ padding: '1.5rem 1.5rem 1.25rem' }}>
          {/* Icon and Title Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: isForced
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                border: isForced ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isForced ? (
                <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              ) : isDownloaded ? (
                <CheckCircle2 size={24} style={{ color: '#10b981' }} />
              ) : (
                <ArrowUpCircle size={24} style={{ color: '#818cf8' }} />
              )}
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: isForced ? '#f87171' : '#a5b4fc',
                  marginBottom: '2px',
                }}
              >
                {isForced ? 'Critical Update Required' : 'HostelCare Update'}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                {isDownloaded
                  ? 'Update Ready to Install'
                  : isForced
                  ? 'Update Required to Continue'
                  : 'New Version Available'}
              </h3>
            </div>
          </div>

          {/* Version Comparison Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '0.65rem 0.85rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', marginRight: '6px' }}>Installed:</span>
              <span style={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)' }}>v{state.currentVersion}</span>
            </div>
            <div style={{ color: isForced ? '#f87171' : '#818cf8', fontWeight: 800 }}>→</div>
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', marginRight: '6px' }}>Available:</span>
              <span style={{ fontWeight: 800, color: '#38bdf8' }}>v{state.latestVersion}</span>
            </div>
          </div>

          {/* Update Message Explanation */}
          <p
            style={{
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.8)',
              margin: '0 0 1rem',
            }}
          >
            {state.updateMessage || (isForced
              ? 'This release contains critical security enhancements and essential API synchronization required to access hostel services.'
              : 'A new version of HostelCare is ready for you with enhanced performance, bug fixes, and latest features.')}
          </p>

          {/* Release Notes (if provided by admin) */}
          {state.releaseNotes && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.775rem',
                color: 'rgba(255, 255, 255, 0.7)',
                maxHeight: '110px',
                overflowY: 'auto',
                whiteSpace: 'pre-line',
              }}
            >
              <div style={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '4px' }}>
                What's New in v{state.latestVersion}:
              </div>
              {state.releaseNotes}
            </div>
          )}

          {/* Flexible In-App Download Progress Bar */}
          {progress && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '6px',
                }}
              >
                <span>Downloading update in background...</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{progress.percent || 0}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, progress.percent || 0)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1 0%, #38bdf8 100%)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Security & Authenticity Trust Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.725rem',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '1.25rem',
            }}
          >
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>Verified distribution from Google Play / Official Store</span>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexDirection: isForced ? 'column' : 'row',
            }}
          >
            {!isForced && !isDownloaded && (
              <button
                type="button"
                onClick={() => appUpdateService.dismissUpdate()}
                style={{
                  flex: 1,
                  padding: '0.7rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                Later
              </button>
            )}

            {isDownloaded ? (
              <button
                type="button"
                onClick={() => appUpdateService.completeFlexibleUpdate()}
                style={{
                  flex: 1,
                  padding: '0.7rem 1.25rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                }}
              >
                <RefreshCw size={16} />
                <span>Restart & Apply Update</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => appUpdateService.performUpdate()}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: isForced
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isForced
                    ? '0 4px 16px rgba(239, 68, 68, 0.4)'
                    : '0 4px 16px rgba(99, 102, 241, 0.4)',
                }}
              >
                <Download size={16} />
                <span>{isForced ? 'Update Now (Required)' : 'Update Now'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
