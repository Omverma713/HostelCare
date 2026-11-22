import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Choreographed Celestial Theme Transition:
 * - "Left se upar aaya": Celestial body enters from bottom-left and arcs up into the sky.
 * - "Right se niche aaye": Opposite celestial body sinks down to bottom-right horizon.
 * - Compact refined ~44px orb size • Mountain-free pure sky • 1.4s duration
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <div
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      <svg
        className="celestial-stage-arc"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sun Gradients */}
          <radialGradient id="arcSunOrb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="30%" stopColor="#FFE066" />
            <stop offset="65%" stopColor="#F77F00" />
            <stop offset="100%" stopColor="#E63946" />
          </radialGradient>

          <radialGradient id="arcSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#FF9F43" stopOpacity="0.35" />
            <stop offset="85%" stopColor="#EE5253" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#EE5253" stopOpacity="0" />
          </radialGradient>

          {/* Moon Gradients */}
          <radialGradient id="arcMoonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E0ECFF" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#89AFFF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6C8EEF" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="arcMoonBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E4ECF7" />
            <stop offset="100%" stopColor="#BFD3EB" />
          </linearGradient>
        </defs>

        {/* ─── TWINKLING STARS IN SKY (Sunset Phase) ─── */}
        {!isSunrise && (
          <g className="celestial-stars-arc" fill="#FFFFFF">
            <circle cx="180" cy="110" r="1.3" opacity="0.85" />
            <circle cx="270" cy="75" r="1.5" opacity="0.9" />
            <circle cx="360" cy="130" r="1.1" opacity="0.75" />
            <circle cx="450" cy="80" r="1.7" opacity="0.95" />
            <circle cx="540" cy="115" r="1.3" opacity="0.8" />
            <circle cx="630" cy="70" r="1.6" opacity="0.9" />
            <circle cx="710" cy="135" r="1.2" opacity="0.7" />
            <circle cx="230" cy="180" r="1.4" opacity="0.75" />
            <circle cx="490" cy="170" r="1.2" opacity="0.8" />
            {/* Sparkling 4-point Diamond Star */}
            <path d="M450,75 L451.5,78.5 L455,79.5 L451.5,80.5 L450,84 L448.5,80.5 L445,79.5 L448.5,78.5 Z" fill="#EBF4FF" opacity="0.95" />
            <path d="M630,65 L631.5,68.5 L635,69.5 L631.5,70.5 L630,74 L628.5,70.5 L625,69.5 L628.5,68.5 Z" fill="#EBF4FF" opacity="0.9" />
          </g>
        )}

        {/* ─── CHOREOGRAPHY 1: SUNRISE (Switch to Light Mode) ─── */}
        {isSunrise ? (
          <>
            {/* ☀️ Sun: Left se upar aaya (Rising from bottom-left to upper-center) */}
            <g className="sun-rise-from-left">
              {/* Outer Corona Glow */}
              <circle cx="160" cy="360" r="54" fill="url(#arcSunGlow)" />
              {/* Mid Aura */}
              <circle cx="160" cy="360" r="36" fill="url(#arcSunGlow)" opacity="0.9" />
              {/* Delicate Sun Rays */}
              <g stroke="#FFEAA7" strokeWidth="2" strokeLinecap="round" opacity="0.55">
                <line x1="160" y1="324" x2="160" y2="315" />
                <line x1="160" y1="396" x2="160" y2="405" />
                <line x1="124" y1="360" x2="115" y2="360" />
                <line x1="196" y1="360" x2="205" y2="360" />
                <line x1="135" y1="335" x2="128" y2="328" />
                <line x1="185" y1="335" x2="192" y2="328" />
                <line x1="135" y1="385" x2="128" y2="392" />
                <line x1="185" y1="385" x2="192" y2="392" />
              </g>
              {/* Compact Solid Sun Orb (~46px diameter) */}
              <circle cx="160" cy="360" r="23" fill="url(#arcSunOrb)" />
            </g>

            {/* 🌙 Moon: Right se niche gaya (Sinking from upper-right to bottom-right) */}
            <g className="moon-set-to-right">
              <circle cx="580" cy="200" r="46" fill="url(#arcMoonGlow)" />
              {/* Crescent Geometry (~44px diameter) */}
              <path
                d="M573,178 C589,178 602,191 602,207 C602,223 589,236 573,236 C581,228 585,218 585,207 C585,196 581,186 573,178 Z"
                fill="url(#arcMoonBody)"
              />
            </g>
          </>
        ) : (
          /* ─── CHOREOGRAPHY 2: SUNSET (Switch to Dark Mode) ─── */
          <>
            {/* ☀️ Sun: Right se niche gaya (Sinking from upper-center to bottom-right) */}
            <g className="sun-set-to-right">
              <circle cx="480" cy="200" r="50" fill="url(#arcSunGlow)" />
              <circle cx="480" cy="200" r="22" fill="url(#arcSunOrb)" />
            </g>

            {/* 🌙 Moon: Left se upar aaya (Rising from bottom-left to upper-center) */}
            <g className="moon-rise-from-left">
              <circle cx="160" cy="360" r="46" fill="url(#arcMoonGlow)" />
              {/* Crescent Geometry */}
              <path
                d="M153,338 C169,338 182,351 182,367 C182,383 169,396 153,396 C161,388 165,378 165,367 C165,356 161,346 153,338 Z"
                fill="url(#arcMoonBody)"
              />
            </g>
          </>
        )}
      </svg>
    </div>
  );
}

export default memo(CelestialThemeOverlay);
