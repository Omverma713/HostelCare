import React from 'react';
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
  error,
  onRetry,
  emptyIcon = '📦',
  emptyTitle = 'No data available',
  emptyMessage = '',
  children,
}) {
  if (loading) {
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
