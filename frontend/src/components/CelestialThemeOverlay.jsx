import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Minimalist, Mountain-Free Luxury Celestial Theme Transition:
 * - 'sunrise': Golden sun rises gracefully from bottom-left of screen, sweeping morning warmth across the sky.
 * - 'sunset': Sun sets smoothly down, twinkling stars emerge, and a luminous silver crescent moon ascends.
 * 
 * Duration: 1.6s • Ultra-Smooth 60 FPS GPU-Accelerated
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <div
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      {/* Dynamic Ambient Bloom Flare */}
      <div
        className="celestial-light-bloom"
        style={{
          background: isSunrise
            ? 'radial-gradient(circle at 35% 45%, rgba(255, 230, 160, 0.55) 0%, rgba(255, 245, 220, 0.75) 50%, transparent 100%)'
            : 'radial-gradient(circle at 70% 50%, rgba(30, 36, 60, 0.45) 0%, rgba(11, 14, 23, 0.8) 65%, transparent 100%)',
        }}
      />

      {/* Fullscreen SVG Celestial Canvas */}
      <svg
        className="celestial-stage"
        viewBox="0 0 1000 650"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sun Gradients */}
          <radialGradient id="sunOrbGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFDF5" />
            <stop offset="30%" stopColor="#FFE066" />
            <stop offset="65%" stopColor="#F77F00" />
            <stop offset="100%" stopColor="#D62828" stopOpacity="0.9" />
          </radialGradient>

          <radialGradient id="sunCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#FD9644" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#FA8231" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#FA8231" stopOpacity="0" />
          </radialGradient>

          {/* Left-Side Horizon Dawn Glow */}
          <radialGradient id="dawnHorizonGlow" cx="15%" cy="85%" r="65%">
            <stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#FF9F43" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#EE5253" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#EE5253" stopOpacity="0" />
          </radialGradient>

          {/* Moon Gradients */}
          <radialGradient id="moonGlowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E0ECFF" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#89AFFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6C8EEF" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="moonBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E6EEF8" />
            <stop offset="100%" stopColor="#C4D7ED" />
          </linearGradient>

          {/* Subtle Ambient Horizon Beam */}
          <linearGradient id="horizonBeam" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFA502" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FF7F50" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FF6B81" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ─── LEFT-SIDE HORIZON GLOW (Sunrise Phase) ─── */}
        {isSunrise && (
          <ellipse
            className="horizon-glow-left"
            cx="150"
            cy="550"
            rx="380"
            ry="240"
            fill="url(#dawnHorizonGlow)"
          />
        )}

        {/* ─── TWINKLING STARS (Sunset & Moonrise Phase) ─── */}
        {!isSunrise && (
          <g className="celestial-stars-pure" fill="#FFFFFF">
            <circle cx="80" cy="110" r="1.5" opacity="0.85" />
            <circle cx="160" cy="75" r="2" opacity="0.95" />
            <circle cx="240" cy="140" r="1.2" opacity="0.7" />
            <circle cx="340" cy="85" r="1.8" opacity="0.9" />
            <circle cx="440" cy="55" r="2.2" opacity="1" />
            <circle cx="530" cy="110" r="1.5" opacity="0.8" />
            <circle cx="630" cy="65" r="2" opacity="0.95" />
            <circle cx="750" cy="130" r="1.7" opacity="0.85" />
            <circle cx="840" cy="80" r="1.4" opacity="0.75" />
            <circle cx="920" cy="140" r="1.6" opacity="0.8" />
            <circle cx="190" cy="210" r="1.3" opacity="0.6" />
            <circle cx="390" cy="170" r="1.8" opacity="0.85" />
            <circle cx="580" cy="200" r="1.2" opacity="0.65" />
            <circle cx="790" cy="230" r="1.6" opacity="0.8" />
            {/* Sparkling 4-point Diamond Stars */}
            <path d="M440,50 L442,55 L447,57 L442,59 L440,64 L438,59 L433,57 L438,55 Z" fill="#EBF4FF" opacity="0.95" />
            <path d="M630,60 L631.5,64 L635.5,65.5 L631.5,67 L630,71 L628.5,67 L624.5,65.5 L628.5,64 Z" fill="#EBF4FF" opacity="0.9" />
            <path d="M840,75 L841.5,79 L845.5,80.5 L841.5,82 L840,86 L838.5,82 L834.5,80.5 L838.5,79 Z" fill="#EBF4FF" opacity="0.85" />
          </g>
        )}

        {/* ─── CELESTIAL BODIES ─── */}
        <g id="celestial-movers">
          {isSunrise ? (
            /* Left-Side Sunrise (Rises from bottom-left to upper sky) */
            <g className="celestial-sun-sunrise-arc">
              {/* Outer Radiant Corona */}
              <circle cx="100" cy="500" r="190" fill="url(#sunCorona)" />
              {/* Mid Pulse Aura */}
              <circle cx="100" cy="500" r="110" fill="url(#sunCorona)" opacity="0.95" />
              {/* Dynamic Sunlight Rays */}
              <g stroke="#FFEAA7" strokeWidth="3" strokeLinecap="round" opacity="0.5">
                <line x1="100" y1="350" x2="100" y2="310" />
                <line x1="100" y1="650" x2="100" y2="690" />
                <line x1="-50" y1="500" x2="-90" y2="500" />
                <line x1="250" y1="500" x2="290" y2="500" />
                <line x1="-10" y1="390" x2="-40" y2="360" />
                <line x1="210" y1="390" x2="240" y2="360" />
                <line x1="-10" y1="610" x2="-40" y2="640" />
                <line x1="210" y1="610" x2="240" y2="640" />
              </g>
              {/* Solid Radiant Sun Orb */}
              <circle cx="100" cy="500" r="62" fill="url(#sunOrbGrad)" />
            </g>
          ) : (
            /* Sunset: Sun Sets & Crescent Moon Rises */
            <>
              {/* Setting Sun Arcing Downward */}
              <g className="celestial-sun-sunset-arc">
                <circle cx="100" cy="500" r="160" fill="url(#sunCorona)" />
                <circle cx="100" cy="500" r="58" fill="url(#sunOrbGrad)" />
              </g>

              {/* Luminous Crescent Moon Rising at Upper-Right */}
              <g className="celestial-moon-sunset-arc">
                <circle cx="100" cy="500" r="110" fill="url(#moonGlowGrad)" />
                {/* Crescent Geometry */}
                <path
                  d="M90,455 C122,455 146,479 146,510 C146,541 122,565 90,565 C105,551 114,531 114,510 C114,489 105,469 90,455 Z"
                  fill="url(#moonBodyGrad)"
                />
              </g>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

export default memo(CelestialThemeOverlay);
