import React, { useState, useEffect } from 'react';

/**
 * Toast Container for rendering overlay notifications.
 * Listens to 'app-toast' custom window events.
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const { type = 'info', message, title } = e.detail || {};
      if (!message) return;

      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      const defaultTitle =
        type === 'error' ? 'Attention' : type === 'success' ? 'Success' : 'Notification';

      setToasts((prev) => [
        ...prev,
        { id, type, message, title: title || defaultTitle, isClosing: false }
      ]);

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        startDismissToast(id);
      }, 4000);
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
    };
  }, []);

  const startDismissToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 280);
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : toast.type === 'success' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Shrinking Countdown Progress Bar */}
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

