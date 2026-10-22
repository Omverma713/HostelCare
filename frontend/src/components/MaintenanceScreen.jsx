import React, { useState } from 'react';
import { api } from '../services/api';

/**
 * MaintenanceScreen Component
 * 
 * Displays a friendly, modern maintenance screen for users affected by
 * Global or Selective Maintenance mode in both the React web app and Android APK.
 */
export default function MaintenanceScreen({ maintenance, onResolved }) {
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState(null);

  const isGlobal = maintenance?.mode === 'global';
  const title = maintenance?.title || (isGlobal ? 'System Maintenance in Progress' : 'Service Temporarily Unavailable');
  const message = maintenance?.message || (isGlobal
    ? 'HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.'
    : 'Access for your account or user group is currently paused for scheduled system maintenance.');

  const plannedStart = maintenance?.plannedStart ? new Date(maintenance.plannedStart) : null;
  const plannedEnd = maintenance?.plannedEnd ? new Date(maintenance.plannedEnd) : null;

  const handleCheckStatus = async () => {
    try {
      setChecking(true);
      setCheckMessage(null);
      const res = await api.getMaintenanceStatus();
      if (res.success) {
        if (!res.maintenance?.global?.enabled && !res.maintenance?.selective?.enabled) {
          if (onResolved) {
            onResolved();
          } else {
            window.location.reload();
          }
          return;
        }
        setCheckMessage('Maintenance is still ongoing. Thank you for your patience.');
      }
    } catch {
      setCheckMessage('Unable to reach server. Please try again in a few moments.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #0b1329 0%, #101c3d 50%, #1a2c5b 100%)',
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(17, 27, 56, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(67, 97, 238, 0.15)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
        }}
      >
        {/* Animated Badge & Icon */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: isGlobal ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `2px solid ${isGlobal ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.25rem',
              boxShadow: `0 0 24px ${isGlobal ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            }}
          >
            {isGlobal ? '🛠️' : '⏳'}
          </div>
        </div>

        {/* Status Pill */}
        <div style={{ marginBottom: '1rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: isGlobal ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: isGlobal ? '#fca5a5' : '#fcd34d',
              border: `1px solid ${isGlobal ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isGlobal ? '#ef4444' : '#f59e0b',
                animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            {isGlobal ? 'Global Maintenance Active' : 'Selective Maintenance Active'}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            margin: '0 0 0.75rem 0',
            lineHeight: 1.3,
            color: '#f8fafc',
          }}
        >
          {title}
        </h1>

        {/* Message */}
        <p
          style={{
            fontSize: '0.95rem',
            color: '#cbd5e1',
            lineHeight: 1.6,
            margin: '0 0 1.5rem 0',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </p>

        {/* Planned Time Window */}
        {(plannedStart || plannedEnd) && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              fontSize: '0.825rem',
            }}
          >
            <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase', fontSize: '0.7rem' }}>
              Scheduled Maintenance Window
            </div>
            {plannedStart && (
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                <span style={{ color: '#94a3b8' }}>Start:</span>
                <span>{plannedStart.toLocaleString()}</span>
              </div>
            )}
            {plannedEnd && (
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', color: '#e2e8f0' }}>
                <span style={{ color: '#94a3b8' }}>Estimated Completion:</span>
                <span>{plannedEnd.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: checking ? 'not-allowed' : 'pointer',
              opacity: checking ? 0.7 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 14px rgba(67, 97, 238, 0.4)',
            }}
          >
            {checking ? 'Checking Status...' : '🔄 Check Again'}
          </button>

          {checkMessage && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
              {checkMessage}
            </div>
          )}
        </div>

        {/* Discreet Super Admin Recovery Link */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
          <a
            href="/login?admin=true"
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            Super Admin Portal Login →
          </a>
        </div>
      </div>
    </div>
  );
}
