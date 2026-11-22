import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Minimalist, Mountain-Free, Perfectly Centered Celestial Transition:
 * - Center Stage (Compact ~70px Celestial Body, 200px Stage)
 * - 'sunrise': Golden sun rises gracefully into exact center of screen.
 * - 'sunset': Sun gently sinks and a luminous silver crescent moon appears in the center.
 * 
 * Duration: 1.4s • Ultra-Smooth 60 FPS GPU-Accelerated
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <div
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      {/* Compact Centered SVG Stage */}
      <div className="celestial-center-stage">
        <svg
          viewBox="0 0 200 200"
          width="200"
          height="200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Sun Gradients */}
            <radialGradient id="compactSunOrb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFDF7" />
              <stop offset="30%" stopColor="#FFE066" />
              <stop offset="65%" stopColor="#F77F00" />
              <stop offset="100%" stopColor="#E63946" />
            </radialGradient>

            <radialGradient id="compactSunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#FF9F43" stopOpacity="0.35" />
              <stop offset="85%" stopColor="#EE5253" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#EE5253" stopOpacity="0" />
            </radialGradient>

            {/* Moon Gradients */}
            <radialGradient id="compactMoonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0ECFF" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#89AFFF" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6C8EEF" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="compactMoonBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#E4ECF7" />
              <stop offset="100%" stopColor="#BFD3EB" />
            </linearGradient>
          </defs>

          {/* ─── DELICATE STARS AROUND CENTER (Sunset Phase) ─── */}
          {!isSunrise && (
            <g className="celestial-stars-centered" fill="#FFFFFF">
              <circle cx="45" cy="48" r="1.2" opacity="0.85" />
              <circle cx="155" cy="42" r="1.4" opacity="0.9" />
              <circle cx="35" cy="135" r="1" opacity="0.7" />
              <circle cx="165" cy="140" r="1.3" opacity="0.8" />
              <circle cx="65" cy="165" r="1.1" opacity="0.75" />
              <circle cx="140" cy="168" r="1" opacity="0.65" />
              {/* Sparkling 4-point Diamond Star */}
              <path d="M155,38 L156.5,41.5 L160,42.5 L156.5,43.5 L155,47 L153.5,43.5 L150,42.5 L153.5,41.5 Z" fill="#EBF4FF" opacity="0.95" />
            </g>
          )}

          {/* ─── CELESTIAL BODIES (Centered at 100, 100) ─── */}
          {isSunrise ? (
            /* Golden Sun Rises into Exact Center */
            <g className="celestial-sun-center-rise">
              {/* Outer Corona Glow */}
              <circle cx="100" cy="100" r="62" fill="url(#compactSunGlow)" />
              {/* Mid Warm Aura */}
              <circle cx="100" cy="100" r="42" fill="url(#compactSunGlow)" opacity="0.9" />
              {/* Sleek Minimalist Sun Rays */}
              <g stroke="#FFEAA7" strokeWidth="2" strokeLinecap="round" opacity="0.55">
                <line x1="100" y1="62" x2="100" y2="52" />
                <line x1="100" y1="138" x2="100" y2="148" />
                <line x1="62" y1="100" x2="52" y2="100" />
                <line x1="138" y1="100" x2="148" y2="100" />
                <line x1="73" y1="73" x2="66" y2="66" />
                <line x1="127" y1="73" x2="134" y2="66" />
                <line x1="73" y1="127" x2="66" y2="134" />
                <line x1="127" y1="127" x2="134" y2="134" />
              </g>
              {/* Solid Sun Orb (~52px diameter) */}
              <circle cx="100" cy="100" r="26" fill="url(#compactSunOrb)" />
            </g>
          ) : (
            /* Sunset: Sun Sinks, Crescent Moon Takes Center */
            <>
              {/* Sun Sinking */}
              <g className="celestial-sun-center-set">
                <circle cx="100" cy="100" r="54" fill="url(#compactSunGlow)" />
                <circle cx="100" cy="100" r="24" fill="url(#compactSunOrb)" />
              </g>

              {/* Luminous Crescent Moon in Center (~50px diameter) */}
              <g className="celestial-moon-center-rise">
                <circle cx="100" cy="100" r="52" fill="url(#compactMoonGlow)" />
                {/* Crescent Geometry */}
                <path
                  d="M93,76 C111,76 125,90 125,108 C125,126 111,140 93,140 C102,131 107,120 107,108 C107,96 102,85 93,76 Z"
                  fill="url(#compactMoonBody)"
                />
              </g>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export default memo(CelestialThemeOverlay);
