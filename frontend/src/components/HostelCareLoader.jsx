import React from 'react';
import './HostelCareLoader.css';

/**
 * HostelCareLoader
 * Classic cartoon dog with bone – inspired by the VectorStock comic style.
 * Running animation with dust trail behind.
 */
export default function HostelCareLoader({
  message = 'Searching records…',
  submessage,
  size = 'md',
  fullscreen = false,
  inline = false,
  showProgress = true,
  className = '',
}) {
  const isCompact = inline || size === 'xs' || size === 'sm';

  /* ── Shared gradient & filter defs ── */
  const defs = (p) => (
    <defs>
      {/* Tan body fur */}
      <linearGradient id={`${p}-body`} x1="0%" y1="0%" x2="20%" y2="100%">
        <stop offset="0%" stopColor="#d4a85c" />
        <stop offset="60%" stopColor="#c49a52" />
        <stop offset="100%" stopColor="#a8823e" />
      </linearGradient>
      {/* Dark brown back patch */}
      <linearGradient id={`${p}-back`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#8b6530" />
        <stop offset="100%" stopColor="#6b4c24" />
      </linearGradient>
      {/* Cream belly */}
      <radialGradient id={`${p}-belly`} cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#f5e6cc" />
        <stop offset="100%" stopColor="#e8d4b0" />
      </radialGradient>
      {/* Ear (darker brown) */}
      <linearGradient id={`${p}-ear`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#a07840" />
        <stop offset="100%" stopColor="#7a5c2e" />
      </linearGradient>
      {/* Snout / muzzle lighter tan */}
      <linearGradient id={`${p}-muzzle`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ddb87a" />
        <stop offset="100%" stopColor="#c9a262" />
      </linearGradient>
      {/* Blue-gray nose */}
      <radialGradient id={`${p}-nose`} cx="38%" cy="32%" r="65%">
        <stop offset="0%" stopColor="#8899aa" />
        <stop offset="50%" stopColor="#667788" />
        <stop offset="100%" stopColor="#445566" />
      </radialGradient>
      {/* Bone */}
      <linearGradient id={`${p}-bone`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#f5f0e8" />
        <stop offset="100%" stopColor="#e0d5c5" />
      </linearGradient>
      {/* Green collar */}
      <linearGradient id={`${p}-collar`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#6aad3a" />
        <stop offset="50%" stopColor="#4a8c28" />
        <stop offset="100%" stopColor="#3a7020" />
      </linearGradient>
      {/* Gold tag */}
      <radialGradient id={`${p}-tag`} cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#ffe066" />
        <stop offset="60%" stopColor="#f0c430" />
        <stop offset="100%" stopColor="#d4a410" />
      </radialGradient>
      {/* Dust */}
      <radialGradient id={`${p}-dust`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#d6d0c4" stopOpacity="0.85" />
        <stop offset="55%" stopColor="#b8b0a0" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#a09888" stopOpacity="0" />
      </radialGradient>
      {/* Ground shadow */}
      <radialGradient id={`${p}-shadow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
        <stop offset="60%" stopColor="#000" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  );

  /* ── The cartoon dog (running pose) ── */
  const cartoonDog = (p) => (
    <g className="xp-running-dog-group">

      {/* ══════ TAIL (wagging) ══════ */}
      <g className="xp-running-tail">
        <path
          d="M40 68 C30 52 26 34 34 22 C38 16 44 20 40 30
             C36 44 40 56 50 64 Z"
          fill={`url(#${p}-back)`}
          stroke="#222222"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Tail wag motion lines */}
        <g className="xp-tail-lines">
          <path d="M28 26 C22 28 18 24" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M26 34 C20 34 16 30" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* ══════ BACK LEGS ══════ */}
      <g className="xp-back-leg-left">
        <path
          d="M58 88 L44 112 C42 116 48 120 54 118 L68 92 Z"
          fill={`url(#${p}-body)`}
          stroke="#222"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Paw */}
        <ellipse cx="50" cy="118" rx="11" ry="6" fill={`url(#${p}-body)`} stroke="#222" strokeWidth="2.5" />
        <path d="M45 118 L45 122" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M50 118 L50 123" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M55 118 L55 122" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      <g className="xp-back-leg-right">
        <path
          d="M66 86 L56 114 C54 118 60 122 66 120 L78 90 Z"
          fill={`url(#${p}-body)`}
          stroke="#222"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse cx="62" cy="120" rx="11" ry="6" fill={`url(#${p}-body)`} stroke="#222" strokeWidth="2.5" />
        <path d="M57 120 L57 124" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M62 120 L62 125" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M67 120 L67 124" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* ══════ BODY ══════ */}
      <g className="xp-running-torso">
        {/* Main body */}
        <ellipse cx="82" cy="80" rx="32" ry="24" fill={`url(#${p}-body)`} stroke="#222" strokeWidth="2.8" />
        {/* Dark brown back patch */}
        <path
          d="M56 66 C64 54 86 50 104 58 C100 70 84 76 68 74 C60 72 56 68 56 66 Z"
          fill={`url(#${p}-back)`}
          stroke="#222"
          strokeWidth="1.2"
          opacity="0.85"
        />
        {/* Cream belly patch */}
        <ellipse cx="84" cy="90" rx="18" ry="12" fill={`url(#${p}-belly)`} stroke="#222" strokeWidth="1" />
      </g>

      {/* ══════ FRONT LEGS ══════ */}
      <g className="xp-front-leg-left">
        <path
          d="M98 84 L114 114 C116 118 122 116 122 112 L108 82 Z"
          fill={`url(#${p}-body)`}
          stroke="#222"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse cx="118" cy="116" rx="10" ry="5.5" fill={`url(#${p}-body)`} stroke="#222" strokeWidth="2.5" />
        <path d="M113 116 L113 120" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M118 116 L118 121" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M123 116 L123 120" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      <g className="xp-front-leg-right">
        <path
          d="M104 80 L130 108 C132 112 138 108 136 104 L114 76 Z"
          fill={`url(#${p}-body)`}
          stroke="#222"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse cx="134" cy="108" rx="10" ry="5.5" fill={`url(#${p}-body)`} stroke="#222" strokeWidth="2.5" />
        <path d="M129 108 L129 112" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M134 108 L134 113" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M139 108 L139 112" stroke="#222" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* ══════ GREEN COLLAR ══════ */}
      <path
        d="M100 62 C110 66 120 72 124 78 C120 82 110 74 98 68 Z"
        fill={`url(#${p}-collar)`}
        stroke="#222"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Collar highlight */}
      <path d="M104 65 C112 68 118 72 121 76" fill="none" stroke="#8cc860" strokeWidth="1.2" opacity="0.6" />
      {/* Gold tag */}
      <ellipse cx="114" cy="78" rx="5.5" ry="6.5" fill={`url(#${p}-tag)`} stroke="#222" strokeWidth="2" />
      <ellipse cx="113" cy="77" rx="2" ry="2.5" fill="#fff4cc" opacity="0.7" />

      {/* ══════ HEAD ══════ */}
      <g className="xp-running-head">

        {/* Big floppy ear (behind head) */}
        <g className="xp-running-ear">
          <path
            d="M106 38 C90 26 78 36 80 54 C82 66 94 64 98 54
               C102 44 104 40 106 38 Z"
            fill={`url(#${p}-ear)`}
            stroke="#222"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Inner ear detail */}
          <path
            d="M96 46 C90 50 88 58 92 62"
            fill="none"
            stroke="#8b6530"
            strokeWidth="1.5"
            opacity="0.5"
          />
        </g>

        {/* Head shape (large cartoon head) */}
        <circle cx="124" cy="48" r="26" fill={`url(#${p}-body)`} stroke="#222" strokeWidth="2.8" />
        {/* Top of head / forehead highlight */}
        <path
          d="M104 36 C112 26 136 26 142 38"
          fill="none"
          stroke="#d4a85c"
          strokeWidth="1"
          opacity="0"
        />
        {/* Dark brown head patch */}
        <path
          d="M108 32 C116 24 136 24 140 34 C136 38 120 40 110 36 Z"
          fill={`url(#${p}-back)`}
          stroke="#222"
          strokeWidth="1.2"
          opacity="0.8"
        />

        {/* Tufts of fur on top */}
        <path
          d="M118 24 L116 18 L120 22 L122 16 L124 22 L128 18 L126 24"
          fill={`url(#${p}-back)`}
          stroke="#222"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ── EYES (big, googly, cartoon) ── */}
        <g className="xp-running-eye">
          {/* Left eye */}
          <ellipse cx="120" cy="42" rx="8" ry="9.5" fill="#ffffff" stroke="#222" strokeWidth="2.5" />
          {/* Left pupil */}
          <ellipse cx="123" cy="42" rx="4" ry="5" fill="#111111" />
          {/* Left eye shine */}
          <circle cx="125" cy="39" r="2.2" fill="#ffffff" />
          <circle cx="121" cy="44" r="1" fill="#ffffff" opacity="0.7" />

          {/* Right eye */}
          <ellipse cx="140" cy="40" rx="7" ry="8.5" fill="#ffffff" stroke="#222" strokeWidth="2.5" />
          {/* Right pupil */}
          <ellipse cx="143" cy="40" rx="3.5" ry="4.5" fill="#111111" />
          {/* Right eye shine */}
          <circle cx="145" cy="37.5" r="2" fill="#ffffff" />
          <circle cx="141" cy="42" r="0.9" fill="#ffffff" opacity="0.7" />

          {/* Eyebrow (raised, expressive) */}
          <path
            d="M112 30 C118 26 126 28 130 32"
            stroke="#222"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Blinking eyelid */}
          <path
            className="xp-eyelid-path xp-eyelid-left"
            d="M112 40 C114 34 126 34 128 40 C128 40 126 48 120 48 C114 48 112 40 112 40 Z"
            fill="#c49a52"
          />
          <path
            className="xp-eyelid-path xp-eyelid-right"
            d="M133 38 C135 32 146 32 148 38 C148 38 146 46 140 46 C134 46 133 38 133 38 Z"
            fill="#c49a52"
          />
        </g>

        {/* ── MUZZLE / SNOUT ── */}
        <g className="xp-running-snout">
          {/* Muzzle shape */}
          <ellipse cx="150" cy="52" rx="16" ry="12" fill={`url(#${p}-muzzle)`} stroke="#222" strokeWidth="2.5" />
          {/* Muzzle light patch */}
          <ellipse cx="148" cy="48" rx="10" ry="6" fill="#e8d4b0" opacity="0.7" />
          {/* Nostril dots */}
          <circle cx="148" cy="50" r="1.5" fill="#6b4c24" />
          <circle cx="153" cy="50" r="1.5" fill="#6b4c24" />

          {/* ── BIG CARTOON NOSE ── */}
          <ellipse cx="160" cy="46" rx="8" ry="6.5" fill={`url(#${p}-nose)`} stroke="#222" strokeWidth="2.5" />
          {/* Nose shine */}
          <ellipse cx="158" cy="43" rx="3.5" ry="2" fill="#aabbcc" opacity="0.5" />
          <circle cx="157" cy="42.5" r="1.5" fill="#ffffff" opacity="0.7" />

          {/* Mouth / grin line */}
          <path
            d="M150 58 C146 62 142 61 140 58"
            stroke="#222"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M150 58 C154 62 158 61 160 58"
            stroke="#222"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Panting tongue */}
          <path
            className="xp-panting-tongue"
            d="M148 58 C147 68 157 68 156 58 Z"
            fill="#ff8093"
            stroke="#cc3355"
            strokeWidth="1.2"
          />
          {/* Tongue highlight */}
          <path
            className="xp-panting-tongue"
            d="M150 60 C150 64 154 64 154 60 Z"
            fill="#ffb0be"
            opacity="0.6"
          />
        </g>
      </g>

      {/* ══════ BONE IN MOUTH ══════ */}
      <g className="xp-bone-in-mouth">
        {/* Bone shaft */}
        <rect x="140" y="52" width="38" height="8" rx="3" fill={`url(#${p}-bone)`} stroke="#222" strokeWidth="2" />
        {/* Bone highlight */}
        <rect x="144" y="53.5" width="30" height="3" rx="1.5" fill="#ffffff" opacity="0.5" />
        {/* Left knobs */}
        <circle cx="140" cy="50" r="5.5" fill={`url(#${p}-bone)`} stroke="#222" strokeWidth="2" />
        <circle cx="140" cy="62" r="5.5" fill={`url(#${p}-bone)`} stroke="#222" strokeWidth="2" />
        <circle cx="139" cy="49" r="1.8" fill="#ffffff" opacity="0.5" />
        <circle cx="139" cy="61" r="1.8" fill="#ffffff" opacity="0.5" />
        {/* Right knobs */}
        <circle cx="178" cy="50" r="5.5" fill={`url(#${p}-bone)`} stroke="#222" strokeWidth="2" />
        <circle cx="178" cy="62" r="5.5" fill={`url(#${p}-bone)`} stroke="#222" strokeWidth="2" />
        <circle cx="177" cy="49" r="1.8" fill="#ffffff" opacity="0.5" />
        <circle cx="177" cy="61" r="1.8" fill="#ffffff" opacity="0.5" />
      </g>
    </g>
  );

  /* ── Dust trail behind ── */
  const dustTrail = (p) => (
    <g className="xp-dust-trail">
      <g className="xp-dust-cloud xp-dust-1">
        <circle cx="32" cy="108" r="12" fill={`url(#${p}-dust)`} />
        <circle cx="20" cy="114" r="9" fill={`url(#${p}-dust)`} />
        <circle cx="38" cy="116" r="7" fill={`url(#${p}-dust)`} />
      </g>
      <g className="xp-dust-cloud xp-dust-2">
        <circle cx="46" cy="114" r="10" fill={`url(#${p}-dust)`} />
        <circle cx="36" cy="120" r="7" fill={`url(#${p}-dust)`} />
      </g>
      <g className="xp-dust-cloud xp-dust-3">
        <circle cx="26" cy="102" r="13" fill={`url(#${p}-dust)`} />
        <circle cx="14" cy="108" r="9" fill={`url(#${p}-dust)`} />
      </g>
      {/* Speed streaks */}
      <line className="xp-speed-streak s-1" x1="54" y1="100" x2="18" y2="100" stroke="#c4b8a8" strokeWidth="2.5" strokeLinecap="round" />
      <line className="xp-speed-streak s-2" x1="46" y1="112" x2="12" y2="112" stroke="#b8ac9c" strokeWidth="2" strokeLinecap="round" />
      <line className="xp-speed-streak s-3" x1="58" y1="120" x2="26" y2="120" stroke="#c4b8a8" strokeWidth="2" strokeLinecap="round" />
    </g>
  );

  // ── Compact Inline ──
  if (isCompact) {
    const inlineWidth = size === 'xs' ? 60 : size === 'sm' ? 80 : size === 'md' ? 98 : 118;
    const inlineHeight = size === 'xs' ? 34 : size === 'sm' ? 44 : size === 'md' ? 54 : 66;

    return (
      <span
        className={`xp-loader-inline size-${size} ${className}`}
        role="status"
        aria-live="polite"
        aria-label={message || 'Loading…'}
      >
        <svg className="xp-dog-inline-svg" viewBox="0 0 200 135" width={inlineWidth} height={inlineHeight} aria-hidden="true">
          {defs('in')}
          {dustTrail('in')}
          <ellipse className="xp-running-ground-shadow" cx="100" cy="124" rx="50" ry="7" fill="url(#in-shadow)" />
          {cartoonDog('in')}
        </svg>
        {message && <span className="xp-inline-text">{message}</span>}
      </span>
    );
  }

  // ── Full / Card-level Loader ──
  return (
    <div
      className={`xp-loader-container ${fullscreen ? 'xp-loader-fullscreen' : ''} size-${size} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading…'}
    >
      <div className="xp-loader-window">
        <div className="xp-speech-bubble" aria-hidden="true">
          <div className="xp-bubble-content">
            <span className="xp-bubble-title">{message}</span>
            {submessage && <span className="xp-bubble-sub">{submessage}</span>}
          </div>
          <div className="xp-bubble-beak" />
        </div>

        <div className="xp-dog-stage">
          <svg className="xp-dog-svg" viewBox="0 0 200 135" width="100%" height="100%" aria-hidden="true">
            {defs('fl')}
            {dustTrail('fl')}
            <ellipse className="xp-running-ground-shadow" cx="100" cy="126" rx="55" ry="8" fill="url(#fl-shadow)" />
            {cartoonDog('fl')}
          </svg>
        </div>

        {showProgress && (
          <div className="xp-progress-wrapper">
            <div className="xp-progress-track">
              <div className="xp-progress-block-group">
                <div className="xp-block block-1" />
                <div className="xp-block block-2" />
                <div className="xp-block block-3" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
