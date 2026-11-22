import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Cinematic Cosmic Transition:
 * 1. Top-to-Center Straight Drop: Sun/Moon descends gracefully from top-center to screen center.
 * 2. Full-Screen Circular Shockwave: On impact, a massive circular wave expands outward
 *    from the orb, sweeping across the entire viewport to seamlessly switch the theme.
 * 3. Masterpiece Celestial Art:
 *    - Sun: 12-point tapered diamond corona rays (rotating), 3D volumetric core, glossy specular arc, solar aura.
 *    - Moon: 3D illuminated crescent with faint earthshine dark-disc, micro-craters, specular rim, and 8-point diamond star companion.
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <aside
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      {/* ─── FULL-SCREEN EXPANDING CIRCULAR WAVE ─── */}
      <div className="celestial-fullscreen-wave" />

      {/* ─── CENTERED STAGE WITH SUN & MOON ─── */}
      <div className="celestial-center-stage">
        <svg
          className="celestial-svg"
          viewBox="-160 -160 320 320"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* ─── SUN GRADIENTS ─── */}
            <radialGradient id="sunCore3D" cx="35%" cy="30%" r="68%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="20%" stopColor="#FFF7D6" />
              <stop offset="50%" stopColor="#FFC107" />
              <stop offset="80%" stopColor="#FF6D00" />
              <stop offset="100%" stopColor="#DD2C00" />
            </radialGradient>

            <radialGradient id="sunAuraGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE082" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#FFB300" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#FF6D00" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#FF6D00" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="sunRayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF9C4" />
              <stop offset="50%" stopColor="#FFCA28" />
              <stop offset="100%" stopColor="#FF9800" stopOpacity="0.6" />
            </linearGradient>

            {/* ─── MOON GRADIENTS ─── */}
            <linearGradient id="moonCrescent3D" x1="10%" y1="5%" x2="90%" y2="95%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#F1F5F9" />
              <stop offset="65%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            <radialGradient id="moonAuraGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#A5B4FC" stopOpacity="0.35" />
              <stop offset="75%" stopColor="#6366F1" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="earthshineGrad" cx="45%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#334155" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#1E293B" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.6" />
            </radialGradient>

            {/* Atmospheric Glow Filter */}
            <filter id="celestialAtmosphere" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ─── CELESTIAL VERTICAL DROP CONTAINER ─── */}
          <g className="celestial-vertical-carrier">
            {isSunrise ? (
              /* ☀️ ─── ARTISTIC 3D SUN ─── */
              <g className="sun-art-group" filter="url(#celestialAtmosphere)">
                {/* Corona Aura Glow */}
                <circle cx="0" cy="0" r="54" fill="url(#sunAuraGlow)" />

                {/* 12 Tapered Diamond Corona Rays (Rotating) */}
                <g className="sun-rotating-rays">
                  {/* 4 Cardinal Rays (Tall) */}
                  <polygon points="0,-42 -3.5,-26 0,-24 3.5,-26" fill="url(#sunRayGrad)" />
                  <polygon points="0,42 -3.5,26 0,24 3.5,26" fill="url(#sunRayGrad)" />
                  <polygon points="-42,0 -26,-3.5 -24,0 -26,3.5" fill="url(#sunRayGrad)" />
                  <polygon points="42,0 26,-3.5 24,0 26,3.5" fill="url(#sunRayGrad)" />

                  {/* 4 Diagonal Rays (Medium) */}
                  <polygon points="-30,-30 -22,-16 -18,-18 -16,-22" fill="url(#sunRayGrad)" />
                  <polygon points="30,30 22,16 18,18 16,22" fill="url(#sunRayGrad)" />
                  <polygon points="-30,30 -22,16 -18,18 -16,22" fill="url(#sunRayGrad)" transform="rotate(90)" />
                  <polygon points="30,-30 22,-16 18,-18 16,-22" fill="url(#sunRayGrad)" transform="rotate(90)" />

                  {/* 4 Intermediate Subtle Rays */}
                  <polygon points="0,-35 -2,-25 0,-23 2,-25" fill="url(#sunRayGrad)" transform="rotate(30)" opacity="0.8" />
                  <polygon points="0,-35 -2,-25 0,-23 2,-25" fill="url(#sunRayGrad)" transform="rotate(60)" opacity="0.8" />
                  <polygon points="0,-35 -2,-25 0,-23 2,-25" fill="url(#sunRayGrad)" transform="rotate(120)" opacity="0.8" />
                  <polygon points="0,-35 -2,-25 0,-23 2,-25" fill="url(#sunRayGrad)" transform="rotate(150)" opacity="0.8" />
                </g>

                {/* Outer Solar Flare Ring */}
                <circle cx="0" cy="0" r="25" fill="none" stroke="#FFE082" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />

                {/* Main 3D Solar Core Orb (~46px diameter) */}
                <circle cx="0" cy="0" r="23" fill="url(#sunCore3D)" />

                {/* Curved Specular Highlight Arc */}
                <path
                  d="M -14 -8 A 16 16 0 0 1 12 -9"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  opacity="0.9"
                />

                {/* Secondary Core Rim Gleam */}
                <ellipse cx="-6" cy="-10" rx="4" ry="2" fill="#FFFFFF" opacity="0.75" />
              </g>
            ) : (
              /* 🌙 ─── ARTISTIC 3D MOON ─── */
              <g className="moon-art-group" filter="url(#celestialAtmosphere)">
                {/* Lunar Aura Glow */}
                <circle cx="0" cy="0" r="50" fill="url(#moonAuraGlow)" />

                {/* Earthshine: Faint outline of full lunar sphere */}
                <circle cx="0" cy="0" r="22" fill="url(#earthshineGrad)" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="0.8" />

                {/* Luminous 3D Crescent Moon */}
                <path
                  d="M -5 -21 C 9 -21 21 -9 21 7 C 21 23 9 35 -5 35 C 5 27 10 17 10 7 C 10 -3 5 -13 -5 -21 Z"
                  fill="url(#moonCrescent3D)"
                />

                {/* Realistic Lunar Craters with soft shadow */}
                <circle cx="9" cy="4" r="2.4" fill="#94A3B8" opacity="0.45" />
                <circle cx="10" cy="4" r="1.8" fill="#475569" opacity="0.3" />

                <circle cx="14" cy="14" r="2.0" fill="#94A3B8" opacity="0.4" />
                <circle cx="15" cy="14" r="1.4" fill="#475569" opacity="0.25" />

                <circle cx="6" cy="20" r="1.6" fill="#94A3B8" opacity="0.35" />

                {/* Razor Specular Rim Light on Outer Crescent */}
                <path
                  d="M -3 -18 C 9 -16 18 -6 18 7 C 18 20 9 29 -3 31"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  opacity="0.9"
                />

                {/* Twinkling 8-Point Diamond Companion Star */}
                <g className="moon-companion-star">
                  <path
                    d="M 26 -16 L 27.8 -10 L 34 -8 L 27.8 -6 L 26 0 L 24.2 -6 L 18 -8 L 24.2 -10 Z"
                    fill="#FFFFFF"
                    filter="drop-shadow(0 0 6px rgba(255, 255, 255, 0.95))"
                  />
                  <circle cx="-22" cy="-14" r="1.3" fill="#E2E8F0" opacity="0.8" />
                  <circle cx="28" cy="22" r="1.2" fill="#E2E8F0" opacity="0.75" />
                  <circle cx="-16" cy="24" r="1.4" fill="#E2E8F0" opacity="0.85" />
                </g>
              </g>
            )}
          </g>
        </svg>
      </div>
    </aside>
  );
}

export default memo(CelestialThemeOverlay);
