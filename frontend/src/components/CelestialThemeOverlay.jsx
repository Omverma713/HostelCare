import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Centered, frosted-blur transition between Day and Night:
 * - Dead-center positioning (viewBox="-160 -100 320 200", center at (0, 0))
 * - Frosted backdrop blur with gentle, single-tint ambient wash (no multi-color flash)
 * - "Left se upar": rising body enters from lower-left to center
 * - "Right se niche": sinking body exits from center to lower-right
 * - Compact refined ~38-42px orbs, smooth 60 FPS single-pass trajectory (no stutter)
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
          viewBox="-160 -100 320 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Sun Core Radial */}
            <radialGradient id="sunCoreGrad" cx="45%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#FFFDF5" />
              <stop offset="35%" stopColor="#FFD152" />
              <stop offset="70%" stopColor="#FF8F1C" />
              <stop offset="100%" stopColor="#E84A27" />
            </radialGradient>

            {/* Sun Corona Glow */}
            <radialGradient id="sunAuraGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE082" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#FFA726" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FF7043" stopOpacity="0" />
            </radialGradient>

            {/* Moon Core Linear */}
            <linearGradient id="moonCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            {/* Moon Glow */}
            <radialGradient id="moonAuraGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.75" />
              <stop offset="55%" stopColor="#818CF8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ─── DELICATE TWINKLE STARS (During Sunset / Night) ─── */}
          {!isSunrise && (
            <g className="celestial-stars" fill="#FFFFFF">
              <circle cx="-90" cy="-45" r="1.2" opacity="0.8" />
              <circle cx="-50" cy="-65" r="1.5" opacity="0.9" />
              <circle cx="60" cy="-55" r="1.3" opacity="0.85" />
              <circle cx="100" cy="-35" r="1.4" opacity="0.75" />
              <circle cx="-30" cy="50" r="1.1" opacity="0.7" />
              <circle cx="75" cy="45" r="1.2" opacity="0.8" />
              {/* Subtle 4-point Diamond Star */}
              <path d="M-50,-68 L-48.5,-65 L-45.5,-64 L-48.5,-63 L-50,-60 L-51.5,-63 L-54.5,-64 L-51.5,-65 Z" fill="#E0E7FF" opacity="0.9" />
            </g>
          )}

          {/* ─── SUNRISE CHOREOGRAPHY (Switching to Light Mode) ─── */}
          {isSunrise ? (
            <>
              {/* 🌙 Moon sinks: starts center-right, slips down-right */}
              <g className="moon-sink-flow">
                <circle cx="0" cy="0" r="32" fill="url(#moonAuraGrad)" />
                <path
                  d="M-4,-14 C7,-14 16,-5 16,7 C16,19 7,28 -4,28 C2,22 6,14 6,7 C6,0 2,-8 -4,-14 Z"
                  fill="url(#moonCoreGrad)"
                />
              </g>

              {/* ☀️ Sun rises: enters from lower-left into exact center */}
              <g className="sun-rise-flow">
                {/* Corona Glow */}
                <circle cx="0" cy="0" r="42" fill="url(#sunAuraGrad)" />
                {/* Soft Ray Spikes */}
                <g stroke="#FFD54F" strokeWidth="1.8" strokeLinecap="round" opacity="0.6">
                  <line x1="0" y1="-28" x2="0" y2="-22" />
                  <line x1="0" y1="22" x2="0" y2="28" />
                  <line x1="-28" y1="0" x2="-22" y2="0" />
                  <line x1="22" y1="0" x2="28" y2="0" />
                  <line x1="-20" y1="-20" x2="-15" y2="-15" />
                  <line x1="15" y1="15" x2="20" y2="20" />
                  <line x1="-20" y1="20" x2="-15" y2="15" />
                  <line x1="15" y1="-15" x2="20" y2="-20" />
                </g>
                {/* Compact Sun Orb (38px diameter) */}
                <circle cx="0" cy="0" r="19" fill="url(#sunCoreGrad)" />
              </g>
            </>
          ) : (
            /* ─── SUNSET CHOREOGRAPHY (Switching to Dark Mode) ─── */
            <>
              {/* ☀️ Sun sinks: slips from center-left down-right */}
              <g className="sun-sink-flow">
                <circle cx="0" cy="0" r="36" fill="url(#sunAuraGrad)" />
                <circle cx="0" cy="0" r="18" fill="url(#sunCoreGrad)" />
              </g>

              {/* 🌙 Moon rises: enters from lower-left into exact center */}
              <g className="moon-rise-flow">
                {/* Moon Glow */}
                <circle cx="0" cy="0" r="36" fill="url(#moonAuraGrad)" />
                {/* Crisp Crescent Moon (36px diameter) */}
                <path
                  d="M-5,-16 C8,-16 18,-6 18,7 C18,20 8,30 -5,30 C2,23 6,15 6,7 C6,-1 2,-9 -5,-16 Z"
                  fill="url(#moonCoreGrad)"
                />
              </g>
            </>
          )}
        </svg>
      </div>
    </aside>
  );
}

export default memo(CelestialThemeOverlay);
