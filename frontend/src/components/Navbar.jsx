import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Mobile Top Navbar component with hamburger menu toggle and notification shortcut
 */
export default function Navbar({ onToggleSidebar }) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <header className="mobile-navbar">
      <button
        className="mobile-nav-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle Sidebar Menu"
      >
        ☰
      </button>
      <div className="sidebar-logo" style={{ fontSize: '1.1rem' }}>
        🛡️ HostelCare
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link
          to="/notifications"
          aria-label="Open Custom Notifications"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            fontSize: '1rem',
            textDecoration: 'none',
          }}
          title="Custom Notifications"
        >
          🔔
        </Link>
        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8 }}>
          hostel {user.hostel}
        </div>
      </div>
    </header>
  );
}
