import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Modern High-Tech App Footer
 * Highlights backend creator credentials with interactive links to Portfolio & LinkedIn.
 */
export default function AppFooter() {
  const location = useLocation();
  const isChatPage = location.pathname === '/chat' || location.pathname === '/feedback';
  if (isChatPage) return null;

  return (
    <footer className="spatial-app-footer">
      <div className="footer-glass-pod">
        <div className="footer-left-author">
          <div className="author-avatar-glow">⚡</div>
          <div className="author-text-meta">
            <span className="footer-tagline">PLATFORM ARCHITECTURE & BACKEND</span>
            <div className="author-name-row">
              <span className="author-name">Engineered by <strong>Om Verma</strong></span>
              <span className="footer-live-beacon">
                <span className="footer-ping-dot" /> API v1.0 Live
              </span>
            </div>
          </div>
        </div>

        <div className="footer-right-links">
          <a
            href="https://github.com/Omverma713"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-hyperlink-btn link-portfolio"
            title="View Developer Portfolio & GitHub"
          >
            <span className="link-icon">🌐</span>
            <span className="link-label">Portfolio</span>
            <span className="link-external-arrow">↗</span>
          </a>

          <a
            href="https://www.linkedin.com/in/om-verma-713b19280/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-hyperlink-btn link-linkedin"
            title="Connect on LinkedIn"
          >
            <span className="link-icon">💼</span>
            <span className="link-label">LinkedIn</span>
            <span className="link-external-arrow">↗</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
