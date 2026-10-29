import React, { useState, useEffect } from 'react';

/**
 * Toast Container for rendering overlay notifications.
 * Ultra-modern, responsive floating glass capsule with smooth spring physics.
 * Automatically clears transient/loading info toasts when success or error toasts arrive.
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const { type = 'info', message, title, dismissOthers = false } = e.detail || {};
      if (!message) return;

      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      const defaultTitle =
        type === 'error' ? 'Notice' : type === 'success' ? 'Success' : 'Notice';

      setToasts((prev) => {
        // If a success toast arrives or dismissOthers is requested, dismiss any lingering info toast
        let nextToasts = prev;
        if (type === 'success' || dismissOthers) {
          nextToasts = prev.filter((t) => t.type !== 'info');
        }
        // Keep at most 2 toasts simultaneously to avoid blocking screen content
        if (nextToasts.length >= 2) {
          nextToasts = nextToasts.slice(nextToasts.length - 1);
        }
        return [
          ...nextToasts,
          { id, type, message, title: title || defaultTitle, isClosing: false }
        ];
      });

      // Auto dismiss after 3.5 seconds
      setTimeout(() => {
        startDismissToast(id);
      }, 3500);
    };

    const handleClearEvent = () => {
      setToasts([]);
    };

    window.addEventListener('app-toast', handleToastEvent);
    window.addEventListener('app-toast-clear', handleClearEvent);
    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
      window.removeEventListener('app-toast-clear', handleClearEvent);
    };
  }, []);

  const startDismissToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" id="toast-root">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type} ${toast.isClosing ? 'toast-exit' : ''}`}
          role="alert"
        >
          {/* Status Icon Badge */}
          <div className="toast-icon-badge">
            {toast.type === 'error' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : toast.type === 'success' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </div>

          {/* Toast Text Content */}
          <div className="toast-content">
            <h4 className="toast-title">{toast.title}</h4>
            <p className="toast-message">{toast.message}</p>
          </div>

          {/* Close Action Button */}
          <button
            className="toast-close-btn"
            onClick={() => startDismissToast(toast.id)}
            aria-label="Close notification"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Hairline Progress Fill */}
          <div className="toast-progress-bar">
            <div className="toast-progress-fill" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Helper utility to trigger a toast notification from anywhere in the application
 */
export function triggerToast(type, message, title) {
  window.dispatchEvent(
    new CustomEvent('app-toast', {
      detail: { type, message, title }
    })
  );
}

export function clearToasts() {
  window.dispatchEvent(new CustomEvent('app-toast-clear'));
}
