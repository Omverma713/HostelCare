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
            {/* ─── WARM LINEN SUN GRADIENTS (Sophisticated, Amber-Gold & Terracotta, Not Blinding Neon) ─── */}
            <radialGradient id="sunCore3D" cx="35%" cy="30%" r="68%">
              <stop offset="0%" stopColor="#FFFDF9" />
              <stop offset="20%" stopColor="#FDE6C8" />
              <stop offset="48%" stopColor="#F3A87C" />
              <stop offset="80%" stopColor="#D27357" />
              <stop offset="100%" stopColor="#A8523A" />
            </radialGradient>

            <radialGradient id="sunAuraGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FCD9B8" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#E89574" stopOpacity="0.22" />
              <stop offset="70%" stopColor="#D27357" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#D27357" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="sunRayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF6E9" />
              <stop offset="50%" stopColor="#F5BA99" />
              <stop offset="100%" stopColor="#D27357" stopOpacity="0.3" />
            </linearGradient>

            {/* ─── MOON GRADIENTS (Pure Silver/Cyan, NO Black Circle) ─── */}
            <linearGradient id="moonPureCrescent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F8FAFC" />
              <stop offset="70%" stopColor="#E0E7FF" />
              <stop offset="100%" stopColor="#A5B4FC" />
            </linearGradient>

            <radialGradient id="moonAuraGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.75" />
              <stop offset="36%" stopColor="#A5B4FC" stopOpacity="0.25" />
              <stop offset="72%" stopColor="#6366F1" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {isSunrise ? (
            /* ☀️ ─── WARM LINEN AMBER-GOLD SUN ─── */
            <g className="sun-burst-art">
              {/* Soft Ambient Golden Dawn Halo */}
              <circle cx="0" cy="0" r="46" fill="url(#sunAuraGlow)" />

              {/* 8 Elegant Symmetrical Solar Rays */}
              <g className="sun-elegant-rays">
                {/* 4 Cardinal Rays */}
                <polygon points="0,-36 -2.5,-24 0,-22 2.5,-24" fill="url(#sunRayGrad)" />
                <polygon points="0,36 -2.5,24 0,22 2.5,24" fill="url(#sunRayGrad)" />
                <polygon points="-36,0 -24,-2.5 -22,0 -24,2.5" fill="url(#sunRayGrad)" />
                <polygon points="36,0 24,-2.5 22,0 24,2.5" fill="url(#sunRayGrad)" />

                {/* 4 Diagonal Rays */}
                <polygon points="0,-31 -2,-22 0,-20 2,-22" fill="url(#sunRayGrad)" transform="rotate(45)" opacity="0.8" />
                <polygon points="0,-31 -2,-22 0,-20 2,-22" fill="url(#sunRayGrad)" transform="rotate(135)" opacity="0.8" />
                <polygon points="0,-31 -2,-22 0,-20 2,-22" fill="url(#sunRayGrad)" transform="rotate(225)" opacity="0.8" />
                <polygon points="0,-31 -2,-22 0,-20 2,-22" fill="url(#sunRayGrad)" transform="rotate(315)" opacity="0.8" />
              </g>

              {/* Main 3D Sun Orb (~40px diameter) */}
              <circle cx="0" cy="0" r="20" fill="url(#sunCore3D)" />

              {/* Curved Specular Highlight Arc (Warm Ivory) */}
              <path
                d="M -12 -6 A 14 14 0 0 1 10 -7"
                fill="none"
                stroke="#FFF9F2"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Delicate Warm Pearlescent Gleam */}
              <ellipse cx="-4.5" cy="-8.5" rx="3" ry="1.5" fill="#FFF9F2" opacity="0.75" />
            </g>
          ) : (
            /* 🌙 ─── 3D PURE LUMINOUS MOON (NO Black Background Circle) ─── */
            <g className="moon-glow-art">
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
