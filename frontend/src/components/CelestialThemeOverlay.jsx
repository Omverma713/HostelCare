import React, { memo } from 'react';
import './CelestialThemeOverlay.css';

/**
 * CelestialThemeOverlay
 * 
 * Cinematic, GPU-accelerated celestial transition between themes:
 * - 'sunrise': Golden sun rises through majestic mountain valley into Warm Linen daylight.
 * - 'sunset': Sun dips behind mountain peaks, stars twinkle, and luminous crescent moon rises into Luxury Obsidian night.
 * 
 * Duration: ~850ms • Zero blocking • 60 FPS CSS Keyframes
 */
function CelestialThemeOverlay({ phase }) {
  if (!phase) return null;

  const isSunrise = phase === 'sunrise';

  return (
    <div
      className={`celestial-overlay-root phase-${phase}`}
      aria-hidden="true"
    >
      {/* Light Bloom Layer */}
      <div
        className="celestial-light-bloom"
        style={{
          background: isSunrise
            ? 'radial-gradient(circle at 50% 60%, rgba(255, 235, 180, 0.5) 0%, rgba(255, 255, 255, 0.8) 60%, transparent 100%)'
            : 'radial-gradient(circle at 50% 50%, rgba(18, 22, 36, 0.4) 0%, rgba(11, 14, 23, 0.8) 70%, transparent 100%)',
        }}
      />

      {/* SVG Celestial Landscape */}
      <svg
        className="celestial-stage"
        viewBox="0 0 1000 650"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sun Gradients */}
          <radialGradient id="sunOrbGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF9E6" />
            <stop offset="35%" stopColor="#FFD166" />
            <stop offset="70%" stopColor="#F77F00" />
            <stop offset="100%" stopColor="#E63946" stopOpacity="0.9" />
          </radialGradient>

          <radialGradient id="sunCorona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE066" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#FF9F1C" stopOpacity="0.45" />
            <stop offset="80%" stopColor="#FF5400" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FF5400" stopOpacity="0" />
          </radialGradient>

          {/* Moon Gradients */}
          <radialGradient id="moonGlowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E0ECFF" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#89AFFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6C8EEF" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="moonBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E4ECF7" />
            <stop offset="100%" stopColor="#BFD3EB" />
          </linearGradient>

          {/* Mountains Gradients - Sunrise Phase */}
          <linearGradient id="mntnBgSunrise" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4A2E35" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#2E1C27" />
            <stop offset="100%" stopColor="#1C101A" />
          </linearGradient>

          <linearGradient id="mntnFgSunrise" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2B1824" />
            <stop offset="60%" stopColor="#1A0D17" />
            <stop offset="100%" stopColor="#0E050D" />
          </linearGradient>

          {/* Mountains Gradients - Sunset Phase */}
          <linearGradient id="mntnBgSunset" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3A3852" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#212036" />
            <stop offset="100%" stopColor="#141324" />
          </linearGradient>

          <linearGradient id="mntnFgSunset" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1A182E" />
            <stop offset="60%" stopColor="#0F0E1E" />
            <stop offset="100%" stopColor="#080711" />
          </linearGradient>
        </defs>

        {/* ─── TWINKLING STARS (Sunset & Moonrise Phase) ─── */}
        {!isSunrise && (
          <g className="celestial-stars" fill="#FFFFFF">
            <circle cx="120" cy="110" r="1.5" opacity="0.85" />
            <circle cx="210" cy="85" r="2" opacity="0.95" />
            <circle cx="280" cy="140" r="1.2" opacity="0.7" />
            <circle cx="390" cy="95" r="1.8" opacity="0.9" />
            <circle cx="480" cy="65" r="2.2" opacity="1" />
            <circle cx="620" cy="80" r="1.5" opacity="0.8" />
            <circle cx="710" cy="120" r="2" opacity="0.95" />
            <circle cx="820" cy="70" r="1.7" opacity="0.85" />
            <circle cx="910" cy="130" r="1.4" opacity="0.75" />
            <circle cx="160" cy="180" r="1.3" opacity="0.6" />
            <circle cx="560" cy="140" r="1.8" opacity="0.85" />
            <circle cx="760" cy="175" r="1.2" opacity="0.65" />
            <circle cx="870" cy="190" r="1.6" opacity="0.8" />
            {/* Sparkling 4-point Stars */}
            <path d="M480,60 L482,65 L487,67 L482,69 L480,74 L478,69 L473,67 L478,65 Z" fill="#EBF4FF" opacity="0.95" />
            <path d="M710,115 L711.5,119 L715.5,120.5 L711.5,122 L710,126 L708.5,122 L704.5,120.5 L708.5,119 Z" fill="#EBF4FF" opacity="0.85" />
          </g>
        )}

        {/* ─── CELESTIAL BODIES (Centered Behind Valley) ─── */}
        <g id="celestial-bodies">
          {isSunrise ? (
            /* Golden Rising Sun (Rises exactly from mountain pass at x=500, y=410) */
            <g className="celestial-sun-sunrise">
              {/* Outer Radiant Corona */}
              <circle cx="500" cy="380" r="170" fill="url(#sunCorona)" />
              {/* Mid Pulse Aura */}
              <circle cx="500" cy="380" r="95" fill="url(#sunCorona)" opacity="0.9" />
              {/* Radiant Light Beams */}
              <g stroke="#FFE259" strokeWidth="2.5" strokeLinecap="round" opacity="0.45">
                <line x1="500" y1="240" x2="500" y2="215" />
                <line x1="500" y1="520" x2="500" y2="545" />
                <line x1="360" y1="380" x2="335" y2="380" />
                <line x1="640" y1="380" x2="665" y2="380" />
                <line x1="400" y1="280" x2="380" y2="260" />
                <line x1="600" y1="280" x2="620" y2="260" />
                <line x1="400" y1="480" x2="380" y2="500" />
                <line x1="600" y1="480" x2="620" y2="500" />
              </g>
              {/* Solid Vibrant Sun Orb */}
              <circle cx="500" cy="380" r="54" fill="url(#sunOrbGrad)" />
            </g>
          ) : (
            /* Sunset Sun Descends & Crescent Moon Ascends */
            <>
              {/* Setting Sun */}
              <g className="celestial-sun-sunset">
                <circle cx="480" cy="380" r="140" fill="url(#sunCorona)" />
                <circle cx="480" cy="380" r="50" fill="url(#sunOrbGrad)" />
              </g>

              {/* Luminous Crescent Moon Rising */}
              <g className="celestial-moon-sunset">
                <circle cx="535" cy="285" r="95" fill="url(#moonGlowGrad)" />
                {/* Elegant Crescent Geometry */}
                <path
                  d="M525,245 C552,245 572,267 572,295 C572,323 552,345 525,345 C538,333 546,315 546,295 C546,275 538,257 525,245 Z"
                  fill="url(#moonBodyGrad)"
                />
              </g>
            </>
          )}
        </g>

        {/* ─── BACKGROUND MOUNTAIN RIDGE (Distant, Softer) ─── */}
        <g className="mountains-bg">
          <path
            d="M-50,650 
               L-50,440 
               L80,390 
               L220,460 
               L360,360 
               L460,425 
               L500,430 
               L540,420 
               L640,350 
               L760,440 
               L880,380 
               L1050,450 
               L1050,650 Z"
            fill={isSunrise ? 'url(#mntnBgSunrise)' : 'url(#mntnBgSunset)'}
            opacity="0.95"
          />
        </g>

        {/* ─── FOREGROUND MAJESTIC MOUNTAINS (Sharp Peaks with Deep Valley Pass) ─── */}
        <g className="mountains-fg">
          <path
            d="M-50,650 
               L-50,480 
               L60,430 
               L180,510 
               L310,400 
               L420,475 
               L495,490 
               L515,490 
               L590,465 
               L700,390 
               L820,490 
               L930,420 
               L1050,500 
               L1050,650 Z"
            fill={isSunrise ? 'url(#mntnFgSunrise)' : 'url(#mntnFgSunset)'}
          />

          {/* Valley Mist / Horizon Atmosphere Glow */}
          <ellipse
            cx="505"
            cy="485"
            rx="130"
            ry="24"
            fill={isSunrise ? '#FF9A3C' : '#3A305A'}
            opacity={isSunrise ? '0.45' : '0.35'}
            filter="blur(10px)"
          />

          {/* Pine Trees Silhouette Accents Along Low Ridges */}
          <g fill={isSunrise ? '#120811' : '#07060F'} opacity="0.9">
            {/* Left Ridge Pines */}
            <polygon points="120,530 126,505 132,530" />
            <polygon points="130,535 135,512 140,535" />
            <polygon points="142,540 147,520 152,540" />
            <polygon points="270,520 275,498 280,520" />
            <polygon points="280,525 285,504 290,525" />
            <polygon points="410,510 415,488 420,510" />

            {/* Right Ridge Pines */}
            <polygon points="585,505 590,482 595,505" />
            <polygon points="597,510 602,488 607,510" />
            <polygon points="730,525 735,500 740,525" />
            <polygon points="742,530 747,506 752,530" />
            <polygon points="860,535 865,510 870,535" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default memo(CelestialThemeOverlay);
