import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { appUpdateService } from '../services/appUpdateService';

/**
 * Mobile Top Navbar component with hamburger menu toggle, refresh action and notification shortcut
 */
export default function Navbar({ onToggleSidebar }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(() => appUpdateService.getState().updateAvailable);
  const [latestVersion, setLatestVersion] = useState(() => appUpdateService.getState().latestVersion);

  useEffect(() => {
    const unsub = appUpdateService.addListener((state) => {
      setUpdateAvailable(Boolean(state.updateAvailable));
      if (state.latestVersion) {
        setLatestVersion(state.latestVersion);
      }
    });
    return unsub;
  }, []);

  if (!user) return null;

  const handleQuickRefresh = async () => {
    setRefreshing(true);
    try {
      window.dispatchEvent(new CustomEvent('app-refresh'));
      await appUpdateService.checkForUpdates({ manual: true });
    } catch (e) {
      console.warn('Navbar refresh error:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  return (
    <header className="mobile-navbar">
      <button
        className="mobile-nav-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle Sidebar Menu"
      >
        ☰
      </button>
      <div className="sidebar-logo" style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary, #242523)', letterSpacing: '-0.01em' }}>
        HostelCare
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {updateAvailable && (
          <button
            type="button"
            onClick={() => appUpdateService.checkForUpdates({ manual: true })}
            className="navbar-update-pill-blink"
            title={`New update v${latestVersion} is ready! Tap to install.`}
          >
            <span className="blink-pulsing-dot" />
            <span>v{latestVersion} Update</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleQuickRefresh}
          disabled={refreshing}
          aria-label="Refresh App & Check Updates"
          title="Refresh App & Check for Updates"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
              transform: refreshing ? 'rotate(360deg)' : 'none',
              transition: refreshing ? 'transform 0.8s' : 'none',
            }}
          >
            🔄
          </span>
        </button>

        {user.role === 'superadmin' && (
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
        )}
        <div 
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'var(--accent-terracotta, #C9826D)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.82rem',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(201, 130, 109, 0.3)',
            cursor: 'default',
          }}
          title={`${user.name || 'User'} • Block ${user.hostel || 'BH-8'}`}
        >
          {(user.name || user.role || 'U').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
