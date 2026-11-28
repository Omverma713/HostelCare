import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './WhatsAppBackButton.css';

/**
 * WhatsApp-Style Native Back Arrow Button
 * Features:
 * - Exact Android Material/WhatsApp left arrow SVG icon
 * - Expanding circular ink ripple on press/tap
 * - Subtle scale + nudge translation animation for tactile feedback
 * - Web Vibration API (15ms native haptic click)
 * - Safe fallback navigation to history -1 or custom onClick
 */
export default function WhatsAppBackButton({
  onClick,
  fallbackRoute = '/',
  title = 'Back',
  label = null,
  className = '',
  style = {},
}) {
  const navigate = useNavigate();
  const [isPressed, setIsPressed] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();

      // Native haptic feedback if supported on mobile
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(15);
        }
      } catch (_) {}

      // Trigger ripple burst
      setRippleKey((k) => k + 1);
      setIsPressed(true);

      // Brief 90ms tactile delay so the user clearly sees the arrow press transition
      setTimeout(() => {
        setIsPressed(false);
        if (typeof onClick === 'function') {
          onClick();
        } else {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate(fallbackRoute);
          }
        }
      }, 90);
    },
    [onClick, navigate, fallbackRoute]
  );

  return (
    <button
      type="button"
      className={`wa-back-btn ${isPressed ? 'is-pressed' : ''} ${className}`}
      onClick={handleClick}
      title={title}
      aria-label={title}
      style={style}
    >
      <span className="wa-back-ripple-anchor">
        <span key={rippleKey} className="wa-back-ripple" />
      </span>
      <svg
        className="wa-back-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      {label && <span className="wa-back-label">{label}</span>}
    </button>
  );
}
