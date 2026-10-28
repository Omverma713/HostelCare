import React, { useState, useEffect } from 'react';
import { biometricService } from '../services/biometricService';
import { useAuth } from '../hooks/useAuth';
import { triggerToast } from './Toast';

export default function BiometricSettingsModal({ isOpen, onClose }) {
  const { user, token } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [biometryLabel, setBiometryLabel] = useState('Fingerprint');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setPassword('');
      setErrorMsg('');
      setShowPasswordInput(false);
    }
  }, [isOpen]);

  const checkStatus = async () => {
    try {
      const avail = await biometricService.isAvailable();
      setIsSupported(avail.available);
      setBiometryLabel(avail.label || 'Fingerprint');
      setIsEnabled(biometricService.isEnabled());
    } catch (_) {
      setIsSupported(false);
    }
  };

  if (!isOpen) return null;

  const handleToggleClick = () => {
    setErrorMsg('');
    if (isEnabled) {
      // Prompt to disable
      handleDisable();
    } else {
      // Need password to enable
      setShowPasswordInput(true);
    }
  };

  const handleEnableWithPassword = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await biometricService.enableBiometric({
        password: password.trim(),
        currentUser: user,
        currentToken: token,
      });

      if (result.success) {
        setIsEnabled(true);
        setShowPasswordInput(false);
        setPassword('');
        triggerToast('success', '🔐 Fingerprint Lock enabled successfully!');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to verify password or scan fingerprint.');
      triggerToast('error', err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await biometricService.disableBiometric();
      setIsEnabled(false);
      triggerToast('info', '🔓 Fingerprint Lock has been disabled.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to disable biometric lock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '20px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, rgba(150, 110, 50, 0.22))',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, rgba(150, 110, 50, 0.16))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Biometric Fingerprint Lock
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Hardware-grade Mobile Security
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.4rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Main Visual Status Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              borderRadius: '16px',
              background: isEnabled
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(5, 150, 105, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(67, 97, 238, 0.10) 0%, rgba(139, 92, 246, 0.06) 100%)',
              border: isEnabled
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(67, 97, 238, 0.22)',
            }}
          >
            {/* Glowing Icon Disc */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                flexShrink: 0,
                background: isEnabled
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #4361ee 0%, #3451d1 100%)',
                color: '#ffffff',
                boxShadow: isEnabled
                  ? '0 6px 18px rgba(16, 185, 129, 0.4)'
                  : '0 6px 18px rgba(67, 97, 238, 0.3)',
              }}
            >
              👆
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isEnabled ? 'Fingerprint Lock is Active' : 'Fingerprint Lock is Off'}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: isEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                    color: isEnabled ? '#059669' : 'var(--text-muted)',
                  }}
                >
                  {isEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {isEnabled
                  ? 'App requires your fingerprint or phone lock to open and access your profile.'
                  : 'Lock your complaints, room details, and dev chat behind your phone biometric sensor.'}
              </p>
            </div>
          </div>

          {/* Hardware Availability Banner */}
          {!isSupported && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠️</span>
              <span>
                Biometric hardware is not enrolled on this device. Please add a fingerprint in Android phone Settings first.
              </span>
            </div>
          )}

          {/* Password Prompt Step (When turning ON) */}
          {showPasswordInput && !isEnabled && (
            <form onSubmit={handleEnableWithPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(67, 97, 238, 0.08)',
                  border: '1px solid rgba(67, 97, 238, 0.18)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🔑</span>
                <span>
                  <strong>Security Check:</strong> Please enter your current account password to enable biometric protection.
                </span>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    marginBottom: '6px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Account Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-color, #d1d5db)',
                    background: 'var(--bg-tertiary, #f8fafc)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordInput(false);
                    setPassword('');
                    setErrorMsg('');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !password.trim()}
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4361ee 0%, #3451d1 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(67, 97, 238, 0.35)',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Verifying...' : 'Next: Scan Finger 👆'}
                </button>
              </div>
            </form>
          )}

          {/* Main Action Buttons (When not showing password input) */}
          {!showPasswordInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                disabled={loading || (!isSupported && !isEnabled)}
                onClick={handleToggleClick}
                style={{
                  width: '100%',
                  padding: '13px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isEnabled
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  cursor: loading || (!isSupported && !isEnabled) ? 'not-allowed' : 'pointer',
                  boxShadow: isEnabled
                    ? '0 6px 18px rgba(239, 68, 68, 0.35)'
                    : '0 6px 18px rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{isEnabled ? '🔓 Turn Off Biometric Lock' : '👆 Turn On Biometric Lock'}</span>
              </button>

              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  lineHeight: 1.4,
                  marginTop: '4px',
                }}
              >
                🔒 Uses Android hardware-backed KeyStore. Your biometric template never touches any cloud server.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

