import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Vertical Descent + Concentric Circular Shockwave Transition:
 * - "Sabse upar beech se straight niche aayega": Orb drops straight down from top-center into exact center.
 * - "Circular wave animated transition": Concentric ripple shockwaves radiate outward as it lands.
 * - Richer, interactive-feel SVG art:
 *   • Sun: Multi-layered golden-amber core, specular glass shine, rotating corona rays, and radiating solar shockwaves.
 *   • Moon: Luminous pearlescent crescent, subtle lunar glow, twinkling companion stars, and ethereal indigo ripples.
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <aside
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      <div className="celestial-center-stage">
        <svg
          className="celestial-svg"
          viewBox="-160 -160 320 320"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* ─── SUN GRADIENTS ─── */}
            <radialGradient id="sunCoreRich" cx="38%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#FFF4D0" />
              <stop offset="55%" stopColor="#FFBA38" />
              <stop offset="85%" stopColor="#FF7714" />
              <stop offset="100%" stopColor="#EB3B14" />
            </radialGradient>

            <radialGradient id="sunAuraRich" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE082" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#FFB300" stopOpacity="0.35" />
              <stop offset="75%" stopColor="#FF7043" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FF7043" stopOpacity="0" />
            </radialGradient>

            {/* ─── MOON GRADIENTS ─── */}
            <linearGradient id="moonCoreRich" x1="15%" y1="10%" x2="85%" y2="90%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F1F5F9" />
              <stop offset="70%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            <radialGradient id="moonAuraRich" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#A5B4FC" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#6366F1" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>

            {/* Filter: Subtle Glow for Celestial Elements */}
            <filter id="celestialSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ─── EXPANDING CONCENTRIC CIRCULAR RIPPLES ("Circular Wave") ─── */}
          <g className="celestial-ripples-group">
            <circle
              className="celestial-ripple ripple-1"
              cx="0"
              cy="0"
              r="24"
              fill="none"
              strokeWidth="2.5"
            />
            <circle
              className="celestial-ripple ripple-2"
              cx="0"
              cy="0"
              r="24"
              fill="none"
              strokeWidth="2"
            />
            <circle
              className="celestial-ripple ripple-3"
              cx="0"
              cy="0"
              r="24"
              fill="none"
              strokeWidth="1.5"
            />
          </g>

          {/* ─── VERTICAL DROP CARRIER (Straight from top-center into center) ─── */}
          <g className="celestial-vertical-carrier">
            {isSunrise ? (
              /* ☀️ ─── ENHANCED SUN BODY ─── */
              <g className="celestial-sun-body" filter="url(#celestialSoftGlow)">
                {/* Outer Solar Aura */}
                <circle cx="0" cy="0" r="48" fill="url(#sunAuraRich)" />

                {/* Rotating Corona Rays */}
                <g className="sun-corona-spin" stroke="#FFCA28" strokeLinecap="round">
                  <line x1="0" y1="-32" x2="0" y2="-24" strokeWidth="2.5" />
                  <line x1="0" y1="24" x2="0" y2="32" strokeWidth="2.5" />
                  <line x1="-32" y1="0" x2="-24" y2="0" strokeWidth="2.5" />
                  <line x1="24" y1="0" x2="32" y2="0" strokeWidth="2.5" />
                  <line x1="-22" y1="-22" x2="-17" y2="-17" strokeWidth="2" />
                  <line x1="17" y1="17" x2="22" y2="22" strokeWidth="2" />
                  <line x1="-22" y1="22" x2="-17" y2="17" strokeWidth="2" />
                  <line x1="17" y1="-17" x2="22" y2="-22" strokeWidth="2" />
                </g>

                {/* Main Sun Orb (~42px diameter) */}
                <circle cx="0" cy="0" r="21" fill="url(#sunCoreRich)" />

                {/* Top Glass Specular Arc */}
                <path
                  d="M -13 -7 A 15 15 0 0 1 11 -8"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </g>
            ) : (
              /* 🌙 ─── ENHANCED MOON BODY ─── */
              <g className="celestial-moon-body" filter="url(#celestialSoftGlow)">
                {/* Outer Lunar Aura */}
                <circle cx="0" cy="0" r="46" fill="url(#moonAuraRich)" />

                {/* Twinkling Companion Little Stars */}
                <g className="moon-star-companions" fill="#FFFFFF">
                  {/* Primary 4-point Star near moon tip */}
                  <path
                    d="M 22 -18 L 24 -13 L 29 -11 L 24 -9 L 22 -4 L 20 -9 L 15 -11 L 20 -13 Z"
                    fill="#F8FAFC"
                    opacity="0.9"
                  />
                  <circle cx="-24" cy="-16" r="1.4" opacity="0.8" />
                  <circle cx="26" cy="18" r="1.2" opacity="0.75" />
                  <circle cx="-18" cy="22" r="1.5" opacity="0.85" />
                </g>

                {/* Elegant Luminous Crescent Geometry (~40px) */}
                <path
                  d="M -6 -18 C 8 -18 19 -7 19 8 C 19 23 8 34 -6 34 C 3 26 7 17 7 8 C 7 -1 3 -10 -6 -18 Z"
                  fill="url(#moonCoreRich)"
                />

                {/* Crescent Inner Crater Accents */}
                <circle cx="8" cy="5" r="2.2" fill="#94A3B8" opacity="0.4" />
                <circle cx="12" cy="14" r="1.8" fill="#94A3B8" opacity="0.35" />
                <circle cx="5" cy="19" r="1.4" fill="#94A3B8" opacity="0.3" />

                {/* Specular Edge Arc */}
                <path
                  d="M -3 -15 C 8 -13 16 -4 16 8"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              </g>
            )}
          </g>
        </svg>
      </div>
    </aside>
  );
}

export default memo(CelestialThemeOverlay);
