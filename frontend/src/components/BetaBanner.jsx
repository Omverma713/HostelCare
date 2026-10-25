import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Signature Hanging BETA Version sign with realistic cords and subtle 3D swing.
 * pointer-events: none is applied to ensure it does not intercept clicks/interactions.
 */
export default function BetaBanner() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isChatPage = location.pathname === '/chat' || location.pathname === '/feedback';

  // Do not show hanging banner on login or full-screen dev chat pages
  if (isLoginPage || isChatPage) return null;

  return (
    <div className="beta-banner-container on-dashboard" aria-label="Beta Version Notice">
      <div className="beta-banner-cords">
        <div className="beta-banner-cord cord-left" />
        <div className="beta-banner-cord cord-right" />
      </div>
      <div className="beta-banner-sign">
        <span className="beta-banner-text">BETA VERSION</span>
      </div>
    </div>
  );
}
