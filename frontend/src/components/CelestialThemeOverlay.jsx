import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Circular Reveal Theme Transition (View Transitions API):
 * - Inside the expanding circle: Switched new theme.
 * - Outside the expanding circle: Unswitched old theme.
 * - Center of the wave: Radiant 3D Sun (Light) or Pure Crescent Moon (Dark).
 * - Fixed: No yellow wash, no black background circle on Moon, clean and simple.
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <aside
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      {/* ─── CELESTIAL ORB STAGE (Center Epicenter) ─── */}
      <div className="celestial-orb-stage">
        <svg
          className="celestial-svg"
          viewBox="-100 -100 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* ─── SUN GRADIENTS ─── */}
            <radialGradient id="sunCore3D" cx="35%" cy="30%" r="68%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="22%" stopColor="#FFF7D6" />
              <stop offset="50%" stopColor="#FFC107" />
              <stop offset="80%" stopColor="#FF6D00" />
              <stop offset="100%" stopColor="#E64A19" />
            </radialGradient>

            <radialGradient id="sunAuraGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE082" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#FFB300" stopOpacity="0.35" />
              <stop offset="75%" stopColor="#FF6D00" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#FF6D00" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="sunRayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF9C4" />
              <stop offset="50%" stopColor="#FFCA28" />
              <stop offset="100%" stopColor="#FF9800" stopOpacity="0.6" />
            </linearGradient>

            {/* ─── MOON GRADIENTS (Pure Silver/Cyan, NO Black Circle) ─── */}
            <linearGradient id="moonPureCrescent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F8FAFC" />
              <stop offset="70%" stopColor="#E0E7FF" />
              <stop offset="100%" stopColor="#A5B4FC" />
            </linearGradient>

            <radialGradient id="moonAuraGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#A5B4FC" stopOpacity="0.3" />
              <stop offset="75%" stopColor="#6366F1" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>

            {/* Subtle Glow Filter */}
            <filter id="celestialSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {isSunrise ? (
            /* ☀️ ─── 3D RADIANT SUN ─── */
            <g className="sun-burst-art" filter="url(#celestialSoftGlow)">
              {/* Corona Aura Glow */}
              <circle cx="0" cy="0" r="48" fill="url(#sunAuraGlow)" />

              {/* 12 Tapered Diamond Corona Rays (Slowly Rotating) */}
              <g className="sun-rotating-rays">
                {/* 4 Cardinal Rays */}
                <polygon points="0,-38 -3,-24 0,-22 3,-24" fill="url(#sunRayGrad)" />
                <polygon points="0,38 -3,24 0,22 3,24" fill="url(#sunRayGrad)" />
                <polygon points="-38,0 -24,-3 -22,0 -24,3" fill="url(#sunRayGrad)" />
                <polygon points="38,0 24,-3 22,0 24,3" fill="url(#sunRayGrad)" />

                {/* 4 Diagonal Rays */}
                <polygon points="-27,-27 -20,-14 -16,-16 -14,-20" fill="url(#sunRayGrad)" />
                <polygon points="27,27 20,14 16,16 14,20" fill="url(#sunRayGrad)" />
                <polygon points="-27,27 -20,14 -16,16 -14,20" fill="url(#sunRayGrad)" transform="rotate(90)" />
                <polygon points="27,-27 20,-14 16,-16 14,-20" fill="url(#sunRayGrad)" transform="rotate(90)" />

                {/* 4 Intermediate Rays */}
                <polygon points="0,-32 -2,-23 0,-21 2,-23" fill="url(#sunRayGrad)" transform="rotate(30)" opacity="0.8" />
                <polygon points="0,-32 -2,-23 0,-21 2,-23" fill="url(#sunRayGrad)" transform="rotate(60)" opacity="0.8" />
                <polygon points="0,-32 -2,-23 0,-21 2,-23" fill="url(#sunRayGrad)" transform="rotate(120)" opacity="0.8" />
                <polygon points="0,-32 -2,-23 0,-21 2,-23" fill="url(#sunRayGrad)" transform="rotate(150)" opacity="0.8" />
              </g>

              {/* Main 3D Sun Orb (~42px diameter) */}
              <circle cx="0" cy="0" r="21" fill="url(#sunCore3D)" />

              {/* Curved Specular Highlight Arc */}
              <path
                d="M -13 -7 A 15 15 0 0 1 11 -8"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.95"
              />

              {/* Secondary Gleam */}
              <ellipse cx="-5" cy="-9" rx="3.5" ry="1.8" fill="#FFFFFF" opacity="0.8" />
            </g>
          ) : (
            /* 🌙 ─── 3D PURE LUMINOUS MOON (NO Black Background Circle) ─── */
            <g className="moon-glow-art" filter="url(#celestialSoftGlow)">
              {/* Soft Lunar Aura */}
              <circle cx="3" cy="3" r="44" fill="url(#moonAuraGlow)" />

              {/* Pure Crescent Moon (Only the crescent geometry) */}
              <path
                d="M -4 -20 C 9 -20 21 -8 21 7 C 21 22 9 34 -4 34 C 6 27 10 17 10 7 C 10 -3 6 -13 -4 -20 Z"
                fill="url(#moonPureCrescent)"
              />

              {/* Razor Specular Rim Light */}
              <path
                d="M -2 -17 C 9 -15 17 -5 17 7 C 17 19 9 28 -2 30"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.95"
              />

              {/* Twinkling 8-Point Diamond Companion Star */}
              <g className="moon-companion-star">
                <path
                  d="M 25 -12 L 27 -7 L 32 -5 L 27 -3 L 25 2 L 23 -3 L 18 -5 L 23 -7 Z"
                  fill="#FFFFFF"
                  filter="drop-shadow(0 0 8px rgba(255, 255, 255, 1))"
                />
                <circle cx="-18" cy="-10" r="1.3" fill="#FFFFFF" opacity="0.85" />
                <circle cx="26" cy="20" r="1.2" fill="#FFFFFF" opacity="0.8" />
                <circle cx="-12" cy="22" r="1.4" fill="#FFFFFF" opacity="0.9" />
              </g>
            </g>
          )}
        </svg>
      </div>
    </aside>
  );
}

export default memo(CelestialThemeOverlay);
