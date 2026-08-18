import React from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * Mobile Top Navbar component with hamburger menu toggle
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
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8 }}>
        hostel {user.hostel}

      </div>
    </header>
  );
}
