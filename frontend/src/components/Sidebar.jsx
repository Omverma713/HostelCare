import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { ROLE_LABELS } from '../constants';

/**
 * Ultra-Modern 3D Floating Glass Sidebar Dock
 * Features holographic brand header, dynamic illuminated nav pills,
 * live hostel telemetry widget, verified resident profile pod, and sleek cosmic theme toggle.
 */
export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sosActive, setSosActive] = useState(false);

  // Lock background body scrolling cleanly when sidebar drawer is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
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
          </nav>

          {/* 3. Middle Section: Campus Hostel Telemetry & Utilities Widget */}
          <div className="sidebar-telemetry-widget">
            <div className="telemetry-widget-header">
              <span className="telemetry-widget-icon">⚡</span>
              <span className="telemetry-widget-title">{user.hostel || 'BH-1'} Telemetry</span>
              <span className="telemetry-widget-dot" />
            </div>

            <div className="telemetry-items-list">
              <div className="telemetry-mini-row">
                <span className="mini-row-key">📶 Campus Wi-Fi</span>
                <span className="mini-row-val val-green">Online 5G</span>
              </div>
              <div className="telemetry-mini-row">
                <span className="mini-row-key">⚡ Grid Power</span>
                <span className="mini-row-val val-cyan">230V Stable</span>
              </div>
              <div className="telemetry-mini-row">
                <span className="mini-row-key">🚰 Water Supply</span>
                <span className="mini-row-val val-emerald">Normal</span>
              </div>
            </div>

            <button
              type="button"
              className={`btn-sos-helpline ${sosActive ? 'active' : ''}`}
              onClick={() => setSosActive(!sosActive)}
              title="Click to toggle campus emergency contact"
            >
              <span className="sos-icon">🚨</span>
              <span className="sos-text">
                {sosActive ? 'Help: 1800-419-CARE' : 'Emergency Hotline'}
              </span>
            </button>
          </div>
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
                logout();
                if (onClose) onClose();
              }}
              className="btn-dock-logout"
              title="Log out of HostelCare"
              aria-label="Log Out"
            >
              <span className="dock-logout-icon">🚪</span>
              <span className="dock-logout-text">Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
