import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { addChatListener } from '../services/chatSocketService';
import './GlobalNoticePopup.css';

export default function GlobalNoticePopup() {
  const [activeNotice, setActiveNotice] = useState(null);
  const [visible, setVisible] = useState(false);

  // 1. Fetch active notice on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchNotice() {
      try {
        const res = await api.getActiveNotice();
        if (res?.success && res.notice) {
          const dismissedKey = `hostelcare_dismissed_notice_${res.notice._id}`;
          const isDismissed = localStorage.getItem(dismissedKey);
          if (!isDismissed && isMounted) {
            setActiveNotice(res.notice);
            setVisible(true);
          }
        }
      } catch (err) {
        console.warn('Failed to load active global notice:', err.message);
      }
    }

    fetchNotice();

    // 2. Real-time socket listener for emergency broadcast
    const removeListener = addChatListener('global_notice_published', (newNotice) => {
      if (newNotice && newNotice.isActive) {
        setActiveNotice(newNotice);
        setVisible(true);
      }
    });

    return () => {
      isMounted = false;
      removeListener();
    };
  }, []);

  const handleDismiss = () => {
    if (activeNotice?._id) {
      localStorage.setItem(`hostelcare_dismissed_notice_${activeNotice._id}`, 'true');
    }
    setVisible(false);
  };

  if (!visible || !activeNotice) return null;

  const priorityMeta = {
    urgent: { icon: '🚨', label: 'URGENT NOTICE', color: '#ef4444', border: 'rgba(239, 68, 68, 0.45)' },
    warning: { icon: '⚠️', label: 'IMPORTANT NOTICE', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.45)' },
    info: { icon: '📢', label: 'CAMPUS NOTICE', color: '#00a884', border: 'rgba(0, 168, 132, 0.45)' },
  };

  const meta = priorityMeta[activeNotice.priority] || priorityMeta.urgent;

  return (
    <div className="global-notice-overlay" onClick={handleDismiss}>
      <div
        className="global-notice-modal"
        style={{ borderColor: meta.border }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-notice-title"
      >
        {/* Corner Cross Button to Close */}
        <button
          type="button"
          className="global-notice-close-btn"
          onClick={handleDismiss}
          title="Dismiss notice"
          aria-label="Close notice"
          id="btn-close-global-notice"
        >
          ✕
        </button>

        {/* Priority Badge */}
        <div className="global-notice-badge" style={{ color: meta.color, borderColor: meta.border }}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>

        {/* Notice Title */}
        <h2 id="global-notice-title" className="global-notice-title">
          {activeNotice.title}
        </h2>

        {/* Notice Message Content */}
        <div className="global-notice-body">
          {activeNotice.message.split('\n').map((line, idx) => (
            <p key={idx} className="global-notice-line">
              {line}
            </p>
          ))}
        </div>

        {/* Footer Meta */}
        <div className="global-notice-footer">
          <div className="global-notice-sender">
            <span>🛡️ Posted by {activeNotice.createdByName || 'Super Admin'}</span>
            <span>•</span>
            <span>{new Date(activeNotice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <button
            type="button"
            className="global-notice-acknowledge-btn"
            onClick={handleDismiss}
            id="btn-ack-global-notice"
          >
            ✓ Got It
          </button>
        </div>
      </div>
    </div>
  );
}
