import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  sendCustomNotification,
  checkNotificationPermission,
  requestNotificationPermission,
  initializeNotificationChannel,
} from '../services/notificationService';
import { triggerToast } from '../components/Toast';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [permState, setPermState] = useState({ granted: false, status: 'loading', platform: 'checking' });
  const [history, setHistory] = useState([]);

  // Check permissions on mount and init channel
  useEffect(() => {
    let isMounted = true;

    async function checkState() {
      await initializeNotificationChannel();
      const result = await checkNotificationPermission();
      if (isMounted) {
        setPermState(result);
      }
    }

    checkState();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRequestPermission = async () => {
    try {
      const res = await requestNotificationPermission();
      setPermState(res);
      if (res.granted) {
        triggerToast('success', 'Notification permission granted!', 'Android Shade Ready');
      } else {
        triggerToast('error', 'Notification permission was denied.', 'Permission Denied');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to request permission', 'Error');
    }
  };

  const handleSendNotification = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const trimmed = message.trim();
    if (!trimmed) {
      setErrorMsg('Please enter notification text before sending.');
      triggerToast('error', 'Please enter a notification message', 'Empty Input');
      return;
    }

    setSending(true);
    try {
      const result = await sendCustomNotification(trimmed);
      const newEntry = {
        id: result.id,
        title: 'HostelCare',
        message: result.message,
        timestamp: new Date().toLocaleTimeString(),
        platform: result.platform,
      };

      setHistory((prev) => [newEntry, ...prev]);
      setMessage('');
      triggerToast(
        'success',
        result.platform === 'native'
          ? 'Notification posted to Android Notification Shade!'
          : 'Notification dispatched!',
        'HostelCare'
      );
    } catch (err) {
      console.error('Failed to dispatch notification:', err);
      setErrorMsg(err.message || 'Could not send notification.');
      triggerToast('error', err.message || 'Notification failed', 'Error');
    } finally {
      setSending(false);
    }
  };

  const handleUsePreset = (presetText) => {
    setMessage(presetText);
    setErrorMsg('');
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div style={{ padding: '1.25rem', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
      {/* Top Header Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--border-radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '1.25rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                boxShadow: '0 4px 14px rgba(67, 97, 238, 0.35)',
              }}
            >
              🔔
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Custom Notification
              </h1>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Send real-time alerts to the phone notification shade
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Back
          </button>
        </div>

        {/* Platform & Permission Status Pill Banner */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: permState.granted ? 'var(--success-bg)' : 'var(--status-pending-bg)',
            border: `1px solid ${permState.granted ? 'var(--success-border)' : 'var(--status-pending-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>{permState.granted ? '✅' : '⚠️'}</span>
            <div>
              <div
                style={{
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  color: permState.granted ? 'var(--success-text)' : 'var(--status-pending-text)',
                }}
              >
                {permState.granted
                  ? isNative
                    ? 'Android System Notification Shade Ready'
                    : 'Web Notifications Ready'
                  : 'Notification Permission Required'}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, color: permState.granted ? 'var(--success-text)' : 'var(--status-pending-text)' }}>
                {isNative
                  ? 'Target: Android Notification Manager (Capacitor Native)'
                  : 'Target: Browser Preview Mode'}
              </div>
            </div>
          </div>

          {!permState.granted && (
            <button
              type="button"
              onClick={handleRequestPermission}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(67, 97, 238, 0.3)',
              }}
            >
              Grant Permission
            </button>
          )}
        </div>
      </div>

      {/* Main Sender Box */}
      <form
        onSubmit={handleSendNotification}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--border-radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '1.25rem',
        }}
      >
        {/* Title Preview Badge */}
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Notification Title:
          </span>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.02em',
            }}
          >
            🛡️ HostelCare
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Fixed)</span>
        </div>

        {/* Text Input Area */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="custom-notification-input"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.4rem',
            }}
          >
            Notification Message:
          </label>
          <textarea
            id="custom-notification-input"
            rows={3}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="Type any message (e.g. Room inspection scheduled for 4 PM, water supply restored)..."
            style={{
              width: '100%',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--border-radius-md)',
              border: `1.5px solid ${errorMsg ? 'var(--danger-border)' : 'var(--border-color)'}`,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              lineHeight: 1.45,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />

          {errorMsg ? (
            <div
              style={{
                marginTop: '0.4rem',
                fontSize: '0.8rem',
                color: 'var(--danger-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {message.length} characters
            </div>
          )}
        </div>

        {/* Quick Sample Chips */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Quick Sample Messages:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              '⚡ Power maintenance scheduled from 2 PM to 4 PM',
              '🚰 Water supply in Block B is now restored',
              '📦 Parcel arrived at Hostel Reception',
              '🔔 General Hostel assembly tonight at 8 PM in common room',
            ].map((chipText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleUsePreset(chipText)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {chipText}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={sending}
          style={{
            width: '100%',
            padding: '0.85rem 1.5rem',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            background: sending
              ? 'var(--text-muted)'
              : 'linear-gradient(135deg, #4361ee 0%, #3451d1 100%)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: sending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-primary)',
            transition: 'transform 0.1s ease, filter 0.15s ease',
          }}
          onMouseDown={(e) => {
            if (!sending) e.currentTarget.style.transform = 'scale(0.99)';
          }}
          onMouseUp={(e) => {
            if (!sending) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span>{sending ? '⏳' : '🚀'}</span>
          <span>{sending ? 'Sending...' : 'Send Notification'}</span>
        </button>

        <div style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Swipe down from the top edge of your Android phone screen to view it in the notification shade.
        </div>
      </form>

      {/* Notification Activity / History List */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--border-radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Session Dispatched Notifications ({history.length})
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear Log
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div
            style={{
              padding: '1.5rem 1rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            No notifications sent yet in this session. Enter any text above and click <strong>Send Notification</strong>!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {history.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem', marginTop: '2px' }}>📲</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'var(--success-bg)',
                          color: 'var(--success-text)',
                          fontWeight: 600,
                        }}
                      >
                        Shade ID #{item.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
                      {item.message}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {item.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
