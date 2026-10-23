import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABELS } from '../constants';
import { triggerToast } from './Toast';

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const { user, setDirectToken } = useAuth();

  const backupToken = localStorage.getItem('hostelcare_impersonate_backup');

  if (!backupToken || !user) {
    return null;
  }

  const handleExit = () => {
    try {
      localStorage.removeItem('hostelcare_impersonate_backup');
      localStorage.setItem('token', backupToken);
      triggerToast('success', 'Returned to Super Admin Control Panel', 'Session Restored');
      window.location.replace('/superadmin');
    } catch (err) {
      console.error('Failed to exit impersonation:', err);
      window.location.replace('/login');
    }
  };

  return (
    <aside
      aria-label="Active user impersonation session banner"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: 'linear-gradient(90deg, #7c3aed 0%, #4361ee 50%, #06b6d4 100%)',
        color: '#ffffff',
        padding: '0.45rem 1rem',
        boxShadow: '0 4px 20px rgba(67, 97, 238, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        fontSize: '0.82rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <span>⚡</span> IMPERSONATION MODE
        </span>
        <span style={{ opacity: 0.95 }}>
          Logged in as <strong>{user.name}</strong> ({ROLE_LABELS[user.role] || user.role} &bull; {user.registrationNumber})
        </span>
      </div>

      <button
        type="button"
        onClick={handleExit}
        style={{
          background: '#ffffff',
          color: '#1e1b4b',
          border: 'none',
          padding: '0.3rem 0.85rem',
          borderRadius: '6px',
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title="Exit impersonation and return to Super Admin Console"
      >
        <span>↩️</span> Exit & Return to Super Admin
      </button>
    </aside>
  );
}
