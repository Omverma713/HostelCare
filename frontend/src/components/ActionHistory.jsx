import React from 'react';

/**
 * Renders the action timeline for a complaint.
 * Shared between ComplaintDetailModal (Caretaker + Warden) and StudentDashboard.
 */
export default function ActionHistory({ actions }) {
  if (!actions || actions.length === 0) {
    return (
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
        No actions taken on this ticket yet.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
      {actions.map((act, i) => (
        <div
          key={i}
          style={{
            padding: '10px 12px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--border-radius-sm)',
            borderLeft: '3px solid var(--primary)',
            fontSize: '0.8125rem',
          }}
        >
          <div className="flex-row-between" style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, textTransform: 'capitalize', color: 'var(--primary)' }}>
              {act.role} Action
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {act.timestamp ? new Date(act.timestamp).toLocaleString() : ''}
            </span>
          </div>
          <p style={{ fontWeight: 500 }}>{act.action}</p>
        </div>
      ))}
    </div>
  );
}
