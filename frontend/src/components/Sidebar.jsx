import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { ROLE_LABELS } from '../constants';
import { Capacitor } from '@capacitor/core';
import { appUpdateService } from '../services/appUpdateService';
import CbtModal from './CbtModal';
import BiometricSettingsModal from './BiometricSettingsModal';
import { biometricService } from '../services/biometricService';

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

  const [isCbtModalOpen, setIsCbtModalOpen] = useState(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(() => appUpdateService.getState().updateAvailable);
  const [latestVersion, setLatestVersion] = useState(() => appUpdateService.getState().latestVersion);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useEffect(() => {
    const unsub = appUpdateService.addListener((state) => {
      setUpdateAvailable(Boolean(state.updateAvailable));
      if (state.latestVersion) {
        setLatestVersion(state.latestVersion);
      }
    });
    return unsub;
  }, []);

  const sidebarRef = useRef(null);
  const navContainerRef = useRef(null);

  // On mobile drawer open (<= 1024px), lock background touch scrolling cleanly
  useEffect(() => {
    const isMobile = window.innerWidth <= 1024;
    if (!isOpen || !isMobile) return;

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

    const handleTouchMove = (e) => {
      const scrollable = e.target.closest('.sidebar-nav-container');
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        return;
      }
      if (e.target.closest('.sidebar-backdrop')) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.classList.remove('sidebar-open-lock');
      document.body.classList.remove('sidebar-open-lock');
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isOpen]);

  // Independent sidebar wheel scrolling on desktop & tablet:
  // When cursor is over the sidebar, scroll ONLY the sidebar nav without chaining to background.
  // When cursor is over the main page, background scrolls completely freely.
  useEffect(() => {
    const aside = sidebarRef.current;
    if (!aside) return;

    const handleWheel = (e) => {
      const nav = navContainerRef.current;
      if (!nav) return;

      const { scrollTop, scrollHeight, clientHeight } = nav;
      const canScroll = scrollHeight > clientHeight;

      if (!canScroll) {
        // If sidebar items fit on screen, absorb wheel so background doesn't scroll while hovering sidebar
        e.preventDefault();
        return;
      }

      // If mouse is on brand header, top area, or bottom profile deck, scroll nav container
      if (!e.target.closest('.sidebar-nav-container')) {
        nav.scrollTop += e.deltaY;
        e.preventDefault();
        return;
      }

      // When scrolling at boundary (top or bottom of sidebar nav), prevent chaining to background
      const atTop = scrollTop <= 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) {
        e.preventDefault();
      }
    };

    aside.addEventListener('wheel', handleWheel, { passive: false });
    return () => aside.removeEventListener('wheel', handleWheel);
  }, []);

  // Track whether there is more scrollable content below in the sidebar nav
  useEffect(() => {
    const nav = navContainerRef.current;
    if (!nav) return;

    const checkScrollState = () => {
      const canScroll = nav.scrollHeight > nav.clientHeight + 10;
      const isBottom = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 16;
      setHasMoreBelow(canScroll && !isBottom);
    };

    checkScrollState();

    const timer = setTimeout(checkScrollState, 250);
    nav.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);

    return () => {
      clearTimeout(timer);
      nav.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [isOpen, user?.role]);

  // Dynamic scroll-driven animated entrance for dock links
  useEffect(() => {
    const container = navContainerRef.current;
    if (!container) return;

    const links = container.querySelectorAll('.sidebar-dock-link');
    if (!links.length) return;

    links.forEach((link, idx) => {
      link.style.setProperty('--item-index', idx);
    });

    if (!('IntersectionObserver' in window)) {
      links.forEach((link) => link.classList.add('scroll-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-visible');
          } else {
            const contRect = container.getBoundingClientRect();
            const targetRect = entry.boundingClientRect;
            if (targetRect.top > contRect.bottom - 10) {
              entry.target.classList.remove('scroll-visible');
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.12,
        rootMargin: '0px 0px 8px 0px',
      }
    );

    links.forEach((link) => observer.observe(link));

    return () => observer.disconnect();
  }, [isOpen, user?.role]);

  if (!user) return null;

  const userRole = user.role;
  const isSuperAdmin = userRole === 'superadmin' || Boolean(user?.isDelegatedSubAdmin);

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
      {isOpen && typeof window !== 'undefined' && window.innerWidth <= 1024 && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <aside ref={sidebarRef} className={`sidebar sidebar-dock-3d ${isOpen ? 'open' : ''}`}>
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

          {/* 3-line Hamburger Toggle button to collapse sidebar */}
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onClose}
            aria-label="Toggle sidebar"
            title="Collapse Sidebar (☰)"
            id="btn-sidebar-hamburger-close"
          >
            ☰
          </button>
        </div>

        {/* 2. Navigation Section with Smooth Animated Liquid Scroll */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div ref={navContainerRef} className="sidebar-nav-container">
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
                <span className="dock-link-title">Dev Support Chat</span>
                <span className="dock-link-subtitle">Real-time E2EE messaging</span>
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

            {/* Closed Beta Program trigger for Students & General Residents */}
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                setIsCbtModalOpen(true);
              }}
              id="sidebar-link-cbt-modal"
              className="sidebar-dock-link"
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div className="dock-link-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                🔬
              </div>

              <div className="dock-link-content">
                <span className="dock-link-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Closed Beta (CBT)
                  <span
                    style={{
                      fontSize: '0.6rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.25)',
                      color: '#818cf8',
                      fontWeight: 800,
                    }}
                  >
                    BETA
                  </span>
                </span>
                <span className="dock-link-subtitle">Apply for early testing</span>
              </div>

              <div className="dock-link-indicator-chip">
                <span className="indicator-ray" />
              </div>
            </button>

            {isSuperAdmin && (
              <>
                <NavLink
                  to="/superadmin?tab=users"
                  onClick={onClose}
                  id="sidebar-link-user-directory"
                  className={() =>
                    `sidebar-dock-link ${
                      location.pathname === '/superadmin' && location.search.includes('tab=users')
                        ? 'active'
                        : ''
                    }`
                  }
                >
                  <div className="dock-link-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                    👥
                  </div>

                  <div className="dock-link-content">
                    <span className="dock-link-title">User Directory</span>
                    <span className="dock-link-subtitle">Create & manage accounts</span>
                  </div>

                  <div className="dock-link-indicator-chip">
                    <span className="indicator-ray" />
                  </div>
                </NavLink>

                <NavLink
                  to="/superadmin?tab=cbt"
                  onClick={onClose}
                  id="sidebar-link-cbt-admin"
                  className={() =>
                    `sidebar-dock-link ${
                      location.pathname === '/superadmin' && location.search.includes('tab=cbt')
                        ? 'active'
                        : ''
                    }`
                  }
                >
                  <div className="dock-link-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                    🔬
                  </div>

                  <div className="dock-link-content">
                    <span className="dock-link-title">CBT Management</span>
                    <span className="dock-link-subtitle">Release & approvals</span>
                  </div>

                  <div className="dock-link-indicator-chip">
                    <span className="indicator-ray" />
                  </div>
                </NavLink>

                <NavLink
                  to="/superadmin?tab=notices"
                  onClick={onClose}
                  id="sidebar-link-global-notices"
                  className={() =>
                    `sidebar-dock-link ${
                      location.pathname === '/superadmin' && location.search.includes('tab=notices')
                        ? 'active'
                        : ''
                    }`
                  }
                >
                  <div className="dock-link-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    🚨
                  </div>

                  <div className="dock-link-content">
                    <span className="dock-link-title">Global Notices</span>
                    <span className="dock-link-subtitle">Pop-up alert manager</span>
                  </div>

                  <div className="dock-link-indicator-chip">
                    <span className="indicator-ray" />
                  </div>
                </NavLink>

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

        {/* Floating animated scroll hint pill when items extend below */}
        {hasMoreBelow && (
          <button
            type="button"
            className="sidebar-scroll-indicator"
            onClick={() => {
              navContainerRef.current?.scrollBy({ top: 140, behavior: 'smooth' });
            }}
            title="Click or scroll down to see more items"
          >
            <span>Scroll down</span>
            <span className="scroll-hint-arrow">↓</span>
          </button>
        )}
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

          {/* App Update Check Button (Web & Native Mobile APK) */}
          <div style={{ padding: '0 0.5rem 0.5rem' }}>
            {updateAvailable && (
              <div
                className="update-available-pill-blink"
                onClick={() => {
                  onClose?.();
                  appUpdateService.checkForUpdates({ manual: true });
                }}
                title={`New version v${latestVersion} is available! Tap to install.`}
              >
                <span className="blink-pulsing-dot" />
                <span>⚡ UPDATE READY: v{latestVersion}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onClose?.();
                appUpdateService.checkForUpdates({ manual: true });
              }}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: updateAvailable ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: updateAvailable ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                color: updateAvailable ? 'var(--text-primary)' : 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
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
              <span style={{ fontSize: '0.7rem', color: updateAvailable ? '#10b981' : '#818cf8', fontWeight: 700 }}>
                {updateAvailable ? '⚡ New Version Ready' : 'Check for Update'}
              </span>
            </button>

            {/* Biometric Fingerprint Lock Button (Mobile APK only) */}
            {Capacitor.isNativePlatform() && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  setIsBiometricModalOpen(true);
                }}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  background: biometricService.isEnabled() ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                title="Configure Biometric Fingerprint Lock for this device"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👆</span>
                  <span>Fingerprint Lock</span>
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: biometricService.isEnabled() ? '#10b981' : '#818cf8',
                    fontWeight: 700,
                  }}
                >
                  {biometricService.isEnabled() ? '🔒 Active' : 'Setup'}
                </span>
              </button>
            )}
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

      {/* Closed Beta Testing (CBT) Student Channel Modal */}
      <CbtModal isOpen={isCbtModalOpen} onClose={() => setIsCbtModalOpen(false)} />

      {/* Hardware Biometric Fingerprint Lock Modal (Mobile APK only) */}
      {Capacitor.isNativePlatform() && (
        <BiometricSettingsModal isOpen={isBiometricModalOpen} onClose={() => setIsBiometricModalOpen(false)} />
      )}
    </>
  );
}
