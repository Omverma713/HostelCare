import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { appUpdateService } from '../services/appUpdateService';
import BiometricSettingsModal from './BiometricSettingsModal';
import { biometricService } from '../services/biometricService';

/**
 * Mobile Top Navbar component with hamburger menu toggle, refresh action and notification shortcut
 */
export default function Navbar({ onToggleSidebar }) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(() => appUpdateService.getState().updateAvailable);
  const [latestVersion, setLatestVersion] = useState(() => appUpdateService.getState().latestVersion);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);

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
      <div className="sidebar-logo" style={{ fontSize: '1.1rem' }}>
        🛡️ HostelCare
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

        {/* 👆 Biometric Fingerprint Lock Quick Access */}
        <button
          type="button"
          onClick={() => setIsBiometricModalOpen(true)}
          aria-label="Biometric Fingerprint Lock"
          title="Setup or manage Biometric Fingerprint Lock"
          style={{
            background: biometricService.isEnabled() ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.08)',
            border: biometricService.isEnabled() ? '1.5px solid rgba(16, 185, 129, 0.5)' : 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          👆
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
        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', opacity: 0.8 }}>
          hostel {user.hostel}
        </div>
      </div>

      {/* Hardware Biometric Fingerprint Lock Modal */}
      <BiometricSettingsModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
      />
    </header>
  );
}
