import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Premium floating BetaBanner component designed as a hanging sign.
 * Uses purely CSS for cords, border, gradients, shadows, and subtle tilt.
 * pointer-events: none is applied to ensure it does not intercept clicks/interactions.
 */
export default function BetaBanner() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  // On Login page, the banner is rendered natively inside the top header flex bar
  if (isLoginPage) return null;

  return (
    <div 
      className="beta-banner-container on-dashboard" 
      aria-hidden="true"
    >
      <div className="beta-banner-cords">
        <div className="beta-banner-cord cord-left"></div>
        <div className="beta-banner-cord cord-right"></div>
      </div>
      <div className="beta-banner-sign">
        <span className="beta-banner-text">BETA VERSION</span>
      </div>
    </div>
  );
}
