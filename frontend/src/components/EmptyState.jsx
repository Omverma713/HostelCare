import React, { useState, useEffect, useRef } from 'react';
import HostelCareLoader from './HostelCareLoader';

/**
 * Reusable loading / error / empty state wrapper.
 *
 * Usage:
 *   wrap your data-rendering children in this component.
 *   It renders the Windows XP nostalgic dog loader when loading,
 *   an error panel when error is set, or the children when data is present.
 */
export default function EmptyState({
  loading,
  loadingMessage = 'Searching hostel records…',
  minDuration = 2500, // Keeps the dog loader visible for ~2.5s for a smooth, enjoyable animation experience
  error,
  onRetry,
  emptyIcon = '📦',
  emptyTitle = 'No data available',
  emptyMessage = '',
  children,
}) {
  const [showLoader, setShowLoader] = useState(loading);
  const startTimeRef = useRef(loading ? Date.now() : null);

  useEffect(() => {
    let timeoutId;
    if (loading) {
      startTimeRef.current = Date.now();
      setShowLoader(true);
    } else {
      if (startTimeRef.current !== null && minDuration > 0) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, minDuration - elapsed);
        if (remaining > 0) {
          timeoutId = setTimeout(() => {
            setShowLoader(false);
          }, remaining);
        } else {
          setShowLoader(false);
        }
      } else {
        setShowLoader(false);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, minDuration]);

  if (showLoader) {
    return <HostelCareLoader size="md" message={loadingMessage} />;
  }

  if (error) {
    return (
      <div
        className="empty-state"
        style={{ borderColor: 'var(--danger-border)', backgroundColor: 'var(--danger-bg)' }}
      >
        <div className="empty-icon">⚠️</div>
        <p style={{ color: 'var(--danger-text)', fontWeight: 600 }}>{error}</p>
        {onRetry && (
          <button className="btn btn-secondary btn-sm mt-4" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!children) {
    return (
      <div className="empty-state">
        <div className="empty-icon">{emptyIcon}</div>
        <p style={{ fontWeight: 600 }}>{emptyTitle}</p>
        {emptyMessage && <p style={{ fontSize: '0.875rem' }}>{emptyMessage}</p>}
      </div>
    );
  }

  return children;
}
