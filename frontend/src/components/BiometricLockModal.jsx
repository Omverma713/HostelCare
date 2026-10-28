import React, { useState, useEffect } from 'react';
import { biometricService } from '../services/biometricService';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * BiometricLockModal
 * 
 * Hardware-level App Privacy Guard
 * When biometric lock is enabled, intercept app wake / resume events
 * and securely lock the screen until the user verifies their fingerprint.
 */
export default function BiometricLockModal() {
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Only engage if biometric lock was enabled by the user
    if (!biometricService.isEnabled()) return;

    let backgroundedTimestamp = 0;

    // Listen to native app state changes (Capacitor)
    let appListenerHandle = null;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          // App went to background
          backgroundedTimestamp = Date.now();
        } else {
          // App resumed to foreground
          const elapsed = Date.now() - backgroundedTimestamp;
          // If backgrounded for more than 5 seconds, trigger lock screen
          if (backgroundedTimestamp > 0 && elapsed > 5000 && biometricService.isEnabled()) {
            triggerLock();
          }
        }
      }).then((handle) => {
        appListenerHandle = handle;
      });
    }

    // Web visibility change listener for browser testing
    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundedTimestamp = Date.now();
      } else {
        const elapsed = Date.now() - backgroundedTimestamp;
        if (backgroundedTimestamp > 0 && elapsed > 15000 && biometricService.isEnabled()) {
          triggerLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      appListenerHandle?.remove?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const triggerLock = () => {
    setIsLocked(true);
    setAuthError('');
    // Auto-prompt fingerprint scanner upon lock
    setTimeout(() => {
      handleBiometricScan();
    }, 350);
  };

  const handleBiometricScan = async () => {
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const result = await biometricService.authenticate({
        title: 'Unlock HostelCare',
        subtitle: 'Touch fingerprint sensor to unlock',
        description: 'Verify your identity to resume using HostelCare',
      });

      if (result.success) {
        setIsLocked(false);
        setAuthError('');
      } else {
        setAuthError('Authentication failed. Tap the sensor icon to try again.');
      }
    } catch (err) {
      setAuthError(err.message || 'Fingerprint verification failed.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isLocked) return null;

  return (
    <div
      id="hostelcare-biometric-lockscreen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999, // Over all modals and toolbars
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(14, 18, 38, 0.96) 0%, rgba(7, 9, 20, 0.98) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        color: '#ffffff',
        padding: '24px',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          gap: '20px',
        }}
      >
        {/* Holographic Shield Emblem */}
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.25) 0%, rgba(139, 92, 246, 0.3) 100%)',
            border: '1.5px solid rgba(99, 102, 241, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
            boxShadow: '0 12px 36px rgba(67, 97, 238, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
          }}
        >
          🛡️
        </div>

        {/* Title */}
        <div>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: '1.45rem',
              fontWeight: 850,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            HostelCare is Locked
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Verify your fingerprint or screen lock to resume your session
          </p>
        </div>

        {/* Fingerprint Touch Target */}
        <div
          onClick={handleBiometricScan}
          role="button"
          tabIndex={0}
          title="Tap to scan fingerprint"
          style={{
            position: 'relative',
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)',
            border: '2px solid rgba(99, 102, 241, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(67, 97, 238, 0.35)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            margin: '10px 0',
          }}
        >
          <span style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>👆</span>
        </div>

        {/* Error or prompt message */}
        {authError ? (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            ⚠️ {authError}
          </div>
        ) : (
          <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600 }}>
            {isAuthenticating ? 'Scanning fingerprint...' : 'Tap sensor icon to scan'}
          </span>
        )}

        {/* Button to scan */}
        <button
          type="button"
          onClick={handleBiometricScan}
          disabled={isAuthenticating}
          style={{
            width: '100%',
            maxWidth: '260px',
            padding: '12px 20px',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #4361ee 0%, #3451d1 100%)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: isAuthenticating ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 20px rgba(67, 97, 238, 0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          {isAuthenticating ? 'Verifying...' : 'Unlock with Fingerprint'}
        </button>
      </div>
    </div>
  );
}

