import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../hooks/useAuth';
import { appUpdateService } from '../services/appUpdateService';
import { Sparkles, CheckCircle2, AlertCircle, ArrowUpCircle, X, Download } from 'lucide-react';

export default function AppUpdateModal() {
  const [state, setState] = useState(() => appUpdateService.updateState);
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

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const isSuperAdmin =
    user?.role === 'superadmin' ||
    pathname.startsWith('/superadmin') ||
    (pathname === '/login' && search.includes('admin'));

  // 1. Super Admin is ALWAYS exempt from all update popups (including force updates)
  if (isSuperAdmin) {
    return null;
  }

  // 2. On standard website / browser, updates are automatically delivered via web deployment.
  // Never show the mobile APK update popup on the web.
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  // Determine whether modal should be visible
  const isUpdatePromptVisible = state.updateAvailable && (!state.isDismissed || state.forceUpdate);
  const isManualResultVisible =
    state.manualCheck &&
    (state.manualCheckStatus === 'up_to_date' || state.manualCheckStatus === 'error');

  if (!isUpdatePromptVisible && !isManualResultVisible) {
    return null;
  }

  const handleDismiss = () => {
    if (state.forceUpdate) return;
    appUpdateService.dismissUpdate();
  };

  const handleUpdate = () => {
    appUpdateService.performUpdate();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(10, 15, 30, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (!state.forceUpdate && e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(145deg, #131d3b 0%, #0d152c 100%)',
          borderRadius: '16px',
          border: state.forceUpdate ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: state.forceUpdate
            ? '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.2)'
            : '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 25px rgba(99, 102, 241, 0.15)',
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
              state.forceUpdate || state.manualCheckStatus === 'error'
                ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #3b82f6 100%)',
          }}
        />

        {/* Close Button (X) - Hidden for force update */}
        {!state.forceUpdate && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close dialog"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
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

        <div style={{ padding: '1.5rem' }}>
          {/* CASE 1: Manual Check - Already Up to Date */}
          {state.manualCheckStatus === 'up_to_date' && (
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

          {/* CASE 2: Manual Check - Error */}
          {state.manualCheckStatus === 'error' && (
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
                Update Check Failed
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
                {state.errorMessage || 'Unable to connect to the update server. Please check your internet connection and try again.'}
              </p>

              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          )}

          {/* CASE 3: New Update Available (Prompt) */}
          {isUpdatePromptVisible && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: state.forceUpdate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    border: state.forceUpdate ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: state.forceUpdate ? '#f87171' : '#818cf8',
                  }}
                >
                  {state.forceUpdate ? <AlertCircle size={24} /> : <Sparkles size={24} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: state.forceUpdate ? '#f87171' : '#a5b4fc', letterSpacing: '0.04em' }}>
                    {state.forceUpdate ? 'CRITICAL UPDATE REQUIRED' : 'HOSTELCARE UPDATE'}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    {state.forceUpdate ? 'Update Required to Continue' : 'New Update Available!'}
                  </h3>
                </div>
              </div>

              {/* Version Comparison Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  Installed: <strong>v{state.currentVersion}</strong>
                </span>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>→</span>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                  Available: <strong>v{state.latestVersion}</strong>
                </span>
              </div>

              {/* Message */}
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.5 }}>
                {state.updateMessage || 'A new version of HostelCare is available with performance improvements and bug fixes.'}
              </p>

              {/* Release Notes */}
              {state.releaseNotes && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '1.25rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '4px' }}>
                    What's New:
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                    {state.releaseNotes}
                  </div>
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

              {/* Action Buttons */}
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
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Later
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleUpdate}
                  style={{
                    flex: state.forceUpdate ? 1 : 2,
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
