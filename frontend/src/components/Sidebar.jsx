import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { ROLE_LABELS } from '../constants';
import { Capacitor } from '@capacitor/core';
import { appUpdateService } from '../services/appUpdateService';

/**
 * Ultra-Modern 3D Floating Glass Sidebar Dock
 * Features holographic brand header, dynamic illuminated nav pills,
 * verified resident profile pod, and sleek cosmic theme toggle.
 */
export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setDirectToken } = useAuth();
  const { theme, setTheme } = useTheme();

  // Lock background body/html scrolling cleanly and prevent touch scroll chaining when drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.classList.add('sidebar-open-lock');
    document.body.classList.add('sidebar-open-lock');

    // Intercept touchmove & wheel to prevent background scroll chaining
    const handleTouchMove = (e) => {
      const scrollable = e.target.closest('.sidebar-nav-container');
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        // If content genuinely overflows the container, allow scrolling inside it
        return;
      }
      // If user swipes anywhere on sidebar or backdrop, prevent default to stop background scrolling
      if (e.target.closest('.sidebar') || e.target.closest('.sidebar-backdrop')) {
        e.preventDefault();
      }
    };

    const handleWheel = (e) => {
      const scrollable = e.target.closest('.sidebar-nav-container');
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        return;
      }
      if (e.target.closest('.sidebar') || e.target.closest('.sidebar-backdrop')) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.classList.remove('sidebar-open-lock');
      document.body.classList.remove('sidebar-open-lock');
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  if (!user) return null;

  const userRole = user.role;

  const getDashboardPath = () => {
    switch (userRole) {
      case 'student':
        return '/student';
      case 'caretaker':
        return '/caretaker';
      case 'warden':
        return '/warden';
      case 'superintendent':
        return '/superintendent';
      case 'superadmin':
        return '/superadmin';
      default:
        return '/';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'HC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile drawer overlay backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar sidebar-dock-3d ${isOpen ? 'open' : ''}`}>
        {/* Ambient Top & Bottom Aura Glows */}
        <div className="sidebar-aura-glow aura-top" />
        <div className="sidebar-aura-glow aura-bottom" />

        {/* 1. Holographic Brand Header */}
        <div className="sidebar-brand-dock">
          <div className="sidebar-emblem-wrap">
            <div className="sidebar-3d-shield-emblem">
              <svg width="22" height="24" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1L2 5V12C2 18.5 6.3 24.3 12 25.5C17.7 24.3 22 18.5 22 12V5L12 1Z" fill="url(#shieldGrad)" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 6V19M8 12H16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="shieldGrad" x1="2" y1="1" x2="22" y2="25.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4361ee" />
                    <stop offset="0.5" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="sidebar-emblem-ring" />
          </div>

          <div className="sidebar-brand-title-wrap">
            <div className="brand-name-row">
              <span className="brand-title-text">HostelCare</span>
              <span className="brand-quantum-badge">3D</span>
            </div>
            <div className="brand-live-status-pill">
              <span className="live-ping-dot" />
              <span className="live-status-lbl">CAMPUS LIVE</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close menu"
          >
            ✕
          </button>
        </div>

        {/* 2. Navigation Section */}
        <div className="sidebar-nav-container">
          <div className="nav-section-eyebrow">PORTAL NAVIGATION</div>

          <nav className="sidebar-nav-items">
            <NavLink
              to={getDashboardPath()}
              onClick={onClose}
              className={({ isActive }) => `sidebar-dock-link ${isActive ? 'active' : ''}`}
            >
              <div className="dock-link-icon-wrap icon-primary">
                {userRole === 'student' && '📋'}
                {userRole === 'caretaker' && '🛠️'}
                {userRole === 'warden' && '📊'}
                {userRole === 'superintendent' && '📈'}
                {userRole === 'superadmin' && '🛡️'}
              </div>

              <div className="dock-link-content">
                <span className="dock-link-title">
                  {userRole === 'student' && 'My Complaints'}
                  {userRole === 'caretaker' && 'Hostel Tickets'}
                  {userRole === 'warden' && 'Warden Console'}
                  {userRole === 'superintendent' && 'Superintendent'}
                  {userRole === 'superadmin' && 'Super Admin'}
                </span>
                <span className="dock-link-subtitle">
                  {userRole === 'student' && 'Active logs & status'}
                  {userRole === 'caretaker' && 'Maintenance queue'}
                  {userRole === 'warden' && 'Overview & stats'}
                  {userRole === 'superintendent' && 'System analytics'}
                  {userRole === 'superadmin' && 'Central Control Panel'}
                </span>
              </div>

              <div className="dock-link-indicator-chip">
                <span className="indicator-ray" />
              </div>
            </NavLink>

            <NavLink
              to="/feedback"
              onClick={onClose}
              className={({ isActive }) => `sidebar-dock-link ${isActive ? 'active' : ''}`}
            >
              <div className="dock-link-icon-wrap icon-purple">💬</div>

              <div className="dock-link-content">
                <span className="dock-link-title">Feedback & Ideas</span>
                <span className="dock-link-subtitle">Suggestions box</span>
              </div>

              <div className="dock-link-indicator-chip">
                <span className="indicator-ray" />
              </div>
            </NavLink>

            <NavLink
              to="/mess-menu"
              onClick={onClose}
              id="sidebar-link-mess-menu"
              className={({ isActive }) => `sidebar-dock-link ${isActive ? 'active' : ''}`}
            >
              <div className="dock-link-icon-wrap" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#10b981' }}>
                🍽️
              </div>

              <div className="dock-link-content">
                <span className="dock-link-title">Mess Menu</span>
                <span className="dock-link-subtitle">Weekly meals & timings</span>
              </div>

              <div className="dock-link-indicator-chip">
                <span className="indicator-ray" />
              </div>
            </NavLink>

            {userRole === 'superadmin' && (
              <>
                <NavLink
                  to="/superadmin?tab=messalerts"
                  onClick={onClose}
                  id="sidebar-link-mess-alerts"
                  className={() =>
                    `sidebar-dock-link ${
                      location.pathname === '/superadmin' && location.search.includes('tab=messalerts')
                        ? 'active'
                        : ''
                    }`
                  }
                >
                  <div className="dock-link-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    🍱
                  </div>

                  <div className="dock-link-content">
                    <span className="dock-link-title">Mess Auto-Alerts</span>
                    <span className="dock-link-subtitle">Daemon timings & test</span>
                  </div>

                  <div className="dock-link-indicator-chip">
                    <span className="indicator-ray" />
                  </div>
                </NavLink>

                <NavLink
                  to="/notifications"
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-dock-link ${isActive ? 'active' : ''}`}
                >
                  <div className="dock-link-icon-wrap icon-primary">🔔</div>

                  <div className="dock-link-content">
                    <span className="dock-link-title">Custom Notification</span>
                    <span className="dock-link-subtitle">Android shade test</span>
                  </div>

                  <div className="dock-link-indicator-chip">
                    <span className="indicator-ray" />
                  </div>
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {/* 4. Bottom Section: Elevated User Profile Card */}
        <div className="sidebar-bottom-deck">
          <div className="sidebar-resident-card">
            <div className="resident-avatar-cluster">
              <div className="resident-avatar-disc">
                {getInitials(user.name)}
              </div>
              <span className="resident-status-ping" title="Online" />
            </div>

            <div className="resident-info-block">
              <div className="resident-name-line" title={user.name}>
                {user.name || 'Resident'}
              </div>
              <div className="resident-tags-row">
                <span className="badge-resident-role">{ROLE_LABELS[userRole] || userRole}</span>
                <span className="badge-resident-room">Rm {user.roomNumber || '302'}</span>
              </div>
              <span className="resident-id-code">ID: {user.registrationNumber}</span>
            </div>
          </div>

          {/* App Update Check Button (Native Mobile APK Only) */}
          {Capacitor.isNativePlatform() && (
            <div style={{ padding: '0 0.5rem 0.5rem' }}>
              <button
                type="button"
                onClick={() => appUpdateService.checkForUpdates({ manual: true })}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                title="Check if a newer version of HostelCare is available"
              >
                <span>📲 App Version</span>
                <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 700 }}>Check for Update</span>
              </button>
            </div>
          )}

          {/* 5. Theme Switcher & Logout */}
          <div className="sidebar-controls-row">
            <div className="sidebar-sliding-theme-toggle" role="group" aria-label="Theme mode switcher">
              <button
                type="button"
                className={`theme-dock-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                aria-label="Switch to light theme"
              >
                <span className="theme-btn-icon">☀️</span>
                <span className="theme-btn-label">Light</span>
              </button>
              <button
                type="button"
                className={`theme-dock-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                aria-label="Switch to dark theme"
              >
                <span className="theme-btn-icon">🌙</span>
                <span className="theme-btn-label">Dark</span>
              </button>
            </div>

            <button
              onClick={() => {
                const backupToken = localStorage.getItem('hostelcare_impersonate_backup');
                if (backupToken && setDirectToken) {
                  localStorage.removeItem('hostelcare_impersonate_backup');
                  setDirectToken(backupToken);
                  navigate('/superadmin');
                } else {
                  logout();
                }
                if (onClose) onClose();
              }}
              className="btn-dock-logout"
              title={localStorage.getItem('hostelcare_impersonate_backup') ? 'Exit & Return to Super Admin' : 'Log out of HostelCare'}
              aria-label="Log Out"
            >
              <span className="dock-logout-icon">{localStorage.getItem('hostelcare_impersonate_backup') ? '↩️' : '🚪'}</span>
              <span className="dock-logout-text">{localStorage.getItem('hostelcare_impersonate_backup') ? 'Exit Admin' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
