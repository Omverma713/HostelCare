import React from 'react';
import './HostelCareLoader.css';

/**
 * HostelCareLoader
 * Nostalgic Windows XP-inspired animated dog search & loading assistant.
 *
 * @param {string}  message      - Primary loading message (e.g. 'Fetching complaints...')
 * @param {string}  submessage   - Optional secondary tip/subtext
 * @param {string}  size         - 'xs' | 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 * @param {boolean} fullscreen   - If true, renders as a centered overlay backdrop
 * @param {boolean} inline       - If true, renders compact inline layout for buttons/badges
 * @param {boolean} showProgress - Whether to show the Windows XP segmented progress bar (default: true for md/lg)
 * @param {string}  className    - Additional CSS classes
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

  // Compact inline mode (designed for buttons & small action controls)
  if (isCompact) {
    const inlineWidth = size === 'xs' ? 36 : size === 'sm' ? 52 : size === 'md' ? 68 : 84;
    const inlineHeight = size === 'xs' ? 30 : size === 'sm' ? 44 : size === 'md' ? 56 : 70;

    return (
      <span
        className={`xp-loader-inline size-${size} ${className}`}
        role="status"
        aria-live="polite"
        aria-label={message || 'Loading…'}
      >
        <svg
          className="xp-dog-inline-svg"
          viewBox="0 0 160 130"
          width={inlineWidth}
          height={inlineHeight}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="xp-in-ground-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.32" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="xp-in-fur-body" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbb034" />
              <stop offset="50%" stopColor="#f39c12" />
              <stop offset="100%" stopColor="#d35400" />
            </linearGradient>
            <linearGradient id="xp-in-fur-chest" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff2cc" />
              <stop offset="100%" stopColor="#fed37f" />
            </linearGradient>
            <linearGradient id="xp-in-fur-ear" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b33927" />
              <stop offset="100%" stopColor="#7a1f1d" />
            </linearGradient>
            <linearGradient id="xp-in-bone-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {/* Ground Shadow */}
          <ellipse
            className="xp-ground-shadow-el"
            cx="80"
            cy="120"
            rx="48"
            ry="7.5"
            fill="url(#xp-in-ground-shadow)"
          />

          {/* TAIL */}
          <g className="xp-tail-group">
            <path
              className="xp-tail-path"
              d="M42 92 C20 80 16 54 28 36 C32 30 36 34 32 44 C26 56 32 74 46 84 Z"
              fill="url(#xp-in-fur-body)"
              stroke="#c0392b"
              strokeWidth="1"
            />
            <circle cx="28" cy="38" r="4.5" fill="#fed37f" />
          </g>

          {/* BACK LEGS & BODY */}
          <g className="xp-body-group">
            <ellipse cx="50" cy="98" rx="24" ry="18" fill="#d35400" />
            <ellipse cx="52" cy="96" rx="22" ry="16" fill="url(#xp-in-fur-body)" />
            <ellipse cx="40" cy="118" rx="14" ry="7" fill="#c0392b" />
            <ellipse cx="40" cy="117" rx="12" ry="5.5" fill="#f8b739" />
            <line x1="36" y1="114" x2="36" y2="119" stroke="#d35400" strokeWidth="1.5" />
            <line x1="42" y1="114" x2="42" y2="119" stroke="#d35400" strokeWidth="1.5" />

            <ellipse cx="76" cy="88" rx="30" ry="25" fill="url(#xp-in-fur-body)" />
            <path
              d="M74 70 C88 74 96 86 94 102 C82 108 72 102 68 88 C66 78 70 72 74 70 Z"
              fill="url(#xp-in-fur-chest)"
            />

            {/* Left Front Leg */}
            <path d="M76 96 L72 120 C72 123 78 124 82 124 L86 100 Z" fill="#d35400" />
            <ellipse cx="78" cy="122" rx="9" ry="5" fill="#f39c12" />

            {/* Right Front Leg & Paw */}
            <g className="xp-front-paw-group">
              <path d="M92 94 L94 120 C94 124 102 125 106 123 L102 96 Z" fill="url(#xp-in-fur-body)" />
              <ellipse cx="102" cy="122" rx="10" ry="5.5" fill="#f8b739" stroke="#d35400" strokeWidth="1" />
              <line x1="99" y1="119" x2="99" y2="124" stroke="#d35400" strokeWidth="1.5" />
              <line x1="104" y1="119" x2="104" y2="124" stroke="#d35400" strokeWidth="1.5" />
            </g>

            {/* Collar & Golden Tag */}
            <path
              d="M84 65 C96 68 108 76 112 82 C108 85 96 76 82 72 Z"
              fill="#2563eb"
              stroke="#1d4ed8"
              strokeWidth="1.5"
            />
            <circle cx="98" cy="78" r="4" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
            <circle cx="98" cy="78" r="1.5" fill="#ffffff" />
          </g>

          {/* HEAD GROUP */}
          <g className="xp-head-group">
            <path
              className="xp-back-ear"
              d="M88 40 C84 26 74 24 72 32 C70 42 78 54 84 56 Z"
              fill="#7a1f1d"
            />
            <circle cx="106" cy="52" r="26" fill="url(#xp-in-fur-body)" />
            <ellipse cx="114" cy="50" rx="18" ry="16" fill="#f8b739" />
            <ellipse cx="100" cy="42" rx="10" ry="8" fill="#ffeaa7" opacity="0.6" />

            <g className="xp-front-ear">
              <path
                d="M92 40 C84 32 76 48 78 66 C80 78 90 74 94 62 C96 50 96 44 92 40 Z"
                fill="url(#xp-in-fur-ear)"
                stroke="#5c1514"
                strokeWidth="1.2"
              />
              <path
                d="M86 46 C82 52 82 62 86 66 C88 64 88 56 88 50 Z"
                fill="#e17055"
                opacity="0.7"
              />
            </g>

            {/* Eyes */}
            <g className="xp-eyes-cluster">
              <g className="xp-left-eye">
                <ellipse cx="102" cy="46" rx="5" ry="6.5" fill="#ffffff" stroke="#d35400" strokeWidth="0.8" />
                <ellipse cx="104" cy="46" rx="3.2" ry="4.2" fill="#1e293b" />
                <circle cx="105.5" cy="44" r="1.4" fill="#ffffff" />
                <circle cx="103" cy="48" r="0.7" fill="#ffffff" />
                <path
                  className="xp-eyelid-path"
                  d="M97 44 C99 40 106 40 108 44 C108 44 107 48 102 48 C97 48 97 44 97 44 Z"
                  fill="#f39c12"
                />
                <path d="M98 38 C101 36 106 37 108 39" stroke="#b33927" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>

              <g className="xp-right-eye">
                <ellipse cx="118" cy="46" rx="5" ry="6.5" fill="#ffffff" stroke="#d35400" strokeWidth="0.8" />
                <ellipse cx="120" cy="46" rx="3.2" ry="4.2" fill="#1e293b" />
                <circle cx="121.5" cy="44" r="1.4" fill="#ffffff" />
                <circle cx="119" cy="48" r="0.7" fill="#ffffff" />
                <path
                  className="xp-eyelid-path"
                  d="M113 44 C115 40 122 40 124 44 C124 44 123 48 118 48 C113 48 113 44 113 44 Z"
                  fill="#f39c12"
                />
                <path d="M115 38 C118 36 123 37 125 39" stroke="#b33927" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>
            </g>

            {/* Snout & Nose */}
            <g className="xp-snout">
              <ellipse cx="122" cy="58" rx="14" ry="10" fill="#f8b739" />
              <ellipse cx="122" cy="56" rx="11" ry="7" fill="#ffeaa7" />
              <path
                d="M124 50 C129 50 132 53 130 56 C128 59 124 60 122 60 C120 60 116 59 114 56 C112 53 115 50 120 50 Z"
                fill="#0f172a"
              />
              <ellipse cx="122" cy="52" rx="3.5" ry="1.5" fill="#475569" />
              <circle cx="123" cy="51.5" r="1" fill="#ffffff" />
              <path d="M122 60 L122 63 C118 64 115 63 113 61" stroke="#871b12" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <path d="M122 63 C126 64 129 63 131 61" stroke="#871b12" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </g>

            {/* Cartoon Bone */}
            <g className="xp-bone-interactive">
              <path
                d="M100 66 L138 66 C141 66 142 70 138 72 L100 72 C96 72 97 66 100 66 Z"
                fill="url(#xp-in-bone-grad)"
                stroke="#94a3b8"
                strokeWidth="1.2"
              />
              <circle cx="98" cy="65" r="4.5" fill="url(#xp-in-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
              <circle cx="98" cy="73" r="4.5" fill="url(#xp-in-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
              <circle cx="140" cy="65" r="4.5" fill="url(#xp-in-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
              <circle cx="140" cy="73" r="4.5" fill="url(#xp-in-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
              <path d="M104 68 L134 68" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </g>
        </svg>
        {message && <span className="xp-inline-text">{message}</span>}
      </span>
    );
  }

  // Full & Card-level Loader
  return (
    <div
      className={`xp-loader-container ${fullscreen ? 'xp-loader-fullscreen' : ''} size-${size} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading…'}
    >
      <div className="xp-loader-window">
        {/* Animated Speech Bubble */}
        <div className="xp-speech-bubble" aria-hidden="true">
          <div className="xp-bubble-content">
            <span className="xp-bubble-title">{message}</span>
            {submessage && <span className="xp-bubble-sub">{submessage}</span>}
          </div>
          <div className="xp-bubble-beak" />
        </div>

        {/* Nostalgic Cartoon Puppy Character */}
        <div className="xp-dog-stage">
          <svg
            className="xp-dog-svg"
            viewBox="0 0 160 140"
            width="100%"
            height="100%"
            aria-hidden="true"
          >
            <defs>
              {/* Retro Soft Drop Shadow */}
              <radialGradient id="xp-ground-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.28" />
                <stop offset="65%" stopColor="#000000" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>
              {/* Fur Gradients */}
              <linearGradient id="xp-fur-body" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbb034" />
                <stop offset="50%" stopColor="#f39c12" />
                <stop offset="100%" stopColor="#d35400" />
              </linearGradient>
              <linearGradient id="xp-fur-chest" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff2cc" />
                <stop offset="100%" stopColor="#fed37f" />
              </linearGradient>
              <linearGradient id="xp-fur-ear" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#b33927" />
                <stop offset="100%" stopColor="#7a1f1d" />
              </linearGradient>
              <linearGradient id="xp-bone-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>

            {/* Ground Shadow */}
            <ellipse
              className="xp-ground-shadow-el"
              cx="80"
              cy="126"
              rx="55"
              ry="9"
              fill="url(#xp-ground-shadow)"
            />

            {/* TAIL */}
            <g className="xp-tail-group">
              <path
                className="xp-tail-path"
                d="M42 92 C20 80 16 54 28 36 C32 30 36 34 32 44 C26 56 32 74 46 84 Z"
                fill="url(#xp-fur-body)"
                stroke="#c0392b"
                strokeWidth="1"
              />
              <circle cx="28" cy="38" r="4.5" fill="#fed37f" />
            </g>

            {/* BACK LEGS & BODY */}
            <g className="xp-body-group">
              {/* Back Hip / Haunch */}
              <ellipse cx="50" cy="98" rx="24" ry="18" fill="#d35400" />
              <ellipse cx="52" cy="96" rx="22" ry="16" fill="url(#xp-fur-body)" />
              {/* Back Paw */}
              <ellipse cx="40" cy="118" rx="14" ry="7" fill="#c0392b" />
              <ellipse cx="40" cy="117" rx="12" ry="5.5" fill="#f8b739" />
              <line x1="36" y1="114" x2="36" y2="119" stroke="#d35400" strokeWidth="1.5" />
              <line x1="42" y1="114" x2="42" y2="119" stroke="#d35400" strokeWidth="1.5" />

              {/* Main Torso */}
              <ellipse cx="76" cy="88" rx="30" ry="25" fill="url(#xp-fur-body)" />
              {/* Chest Fur Highlight */}
              <path
                d="M74 70 C88 74 96 86 94 102 C82 108 72 102 68 88 C66 78 70 72 74 70 Z"
                fill="url(#xp-fur-chest)"
              />

              {/* Left Front Leg */}
              <path
                d="M76 96 L72 120 C72 123 78 124 82 124 L86 100 Z"
                fill="#d35400"
              />
              <ellipse cx="78" cy="122" rx="9" ry="5" fill="#f39c12" />

              {/* Right Front Leg & Paw (Interactive Tapping) */}
              <g className="xp-front-paw-group">
                <path
                  d="M92 94 L94 120 C94 124 102 125 106 123 L102 96 Z"
                  fill="url(#xp-fur-body)"
                />
                <ellipse cx="102" cy="122" rx="10" ry="5.5" fill="#f8b739" stroke="#d35400" strokeWidth="1" />
                <line x1="99" y1="119" x2="99" y2="124" stroke="#d35400" strokeWidth="1.5" />
                <line x1="104" y1="119" x2="104" y2="124" stroke="#d35400" strokeWidth="1.5" />
              </g>

              {/* Collar & Golden Tag */}
              <path
                d="M84 65 C96 68 108 76 112 82 C108 85 96 76 82 72 Z"
                fill="#2563eb"
                stroke="#1d4ed8"
                strokeWidth="1.5"
              />
              <circle cx="98" cy="78" r="4" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
              <circle cx="98" cy="78" r="1.5" fill="#ffffff" />
            </g>

            {/* HEAD GROUP (Animated bobbing & looking around) */}
            <g className="xp-head-group">
              {/* Back Ear (Behind Head) */}
              <path
                className="xp-back-ear"
                d="M88 40 C84 26 74 24 72 32 C70 42 78 54 84 56 Z"
                fill="#7a1f1d"
              />

              {/* Head Base */}
              <circle cx="106" cy="52" r="26" fill="url(#xp-fur-body)" />
              {/* Cheek / Forehead Highlights */}
              <ellipse cx="114" cy="50" rx="18" ry="16" fill="#f8b739" />
              <ellipse cx="100" cy="42" rx="10" ry="8" fill="#ffeaa7" opacity="0.6" />

              {/* Front Floppy Ear (Bouncing) */}
              <g className="xp-front-ear">
                <path
                  d="M92 40 C84 32 76 48 78 66 C80 78 90 74 94 62 C96 50 96 44 92 40 Z"
                  fill="url(#xp-fur-ear)"
                  stroke="#5c1514"
                  strokeWidth="1.2"
                />
                <path
                  d="M86 46 C82 52 82 62 86 66 C88 64 88 56 88 50 Z"
                  fill="#e17055"
                  opacity="0.7"
                />
              </g>

              {/* Eyes & Blinking Eyelids */}
              <g className="xp-eyes-cluster">
                {/* Left Eye */}
                <g className="xp-left-eye">
                  <ellipse cx="102" cy="46" rx="5" ry="6.5" fill="#ffffff" stroke="#d35400" strokeWidth="0.8" />
                  <ellipse cx="104" cy="46" rx="3.2" ry="4.2" fill="#1e293b" />
                  <circle cx="105.5" cy="44" r="1.4" fill="#ffffff" />
                  <circle cx="103" cy="48" r="0.7" fill="#ffffff" />
                  {/* Blinking Eyelid */}
                  <path
                    className="xp-eyelid-path"
                    d="M97 44 C99 40 106 40 108 44 C108 44 107 48 102 48 C97 48 97 44 97 44 Z"
                    fill="#f39c12"
                  />
                  {/* Eyebrow */}
                  <path d="M98 38 C101 36 106 37 108 39" stroke="#b33927" strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>

                {/* Right Eye */}
                <g className="xp-right-eye">
                  <ellipse cx="118" cy="46" rx="5" ry="6.5" fill="#ffffff" stroke="#d35400" strokeWidth="0.8" />
                  <ellipse cx="120" cy="46" rx="3.2" ry="4.2" fill="#1e293b" />
                  <circle cx="121.5" cy="44" r="1.4" fill="#ffffff" />
                  <circle cx="119" cy="48" r="0.7" fill="#ffffff" />
                  {/* Blinking Eyelid */}
                  <path
                    className="xp-eyelid-path"
                    d="M113 44 C115 40 122 40 124 44 C124 44 123 48 118 48 C113 48 113 44 113 44 Z"
                    fill="#f39c12"
                  />
                  {/* Eyebrow */}
                  <path d="M115 38 C118 36 123 37 125 39" stroke="#b33927" strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>
              </g>

              {/* Snout & Cute Button Nose */}
              <g className="xp-snout">
                <ellipse cx="122" cy="58" rx="14" ry="10" fill="#f8b739" />
                <ellipse cx="122" cy="56" rx="11" ry="7" fill="#ffeaa7" />
                {/* Nose */}
                <path
                  d="M124 50 C129 50 132 53 130 56 C128 59 124 60 122 60 C120 60 116 59 114 56 C112 53 115 50 120 50 Z"
                  fill="#0f172a"
                />
                <ellipse cx="122" cy="52" rx="3.5" ry="1.5" fill="#475569" />
                <circle cx="123" cy="51.5" r="1" fill="#ffffff" />
                {/* Mouth line */}
                <path d="M122 60 L122 63 C118 64 115 63 113 61" stroke="#871b12" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                <path d="M122 63 C126 64 129 63 131 61" stroke="#871b12" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              </g>

              {/* ICONIC CARTOON BONE */}
              <g className="xp-bone-interactive">
                {/* Bone Shaft */}
                <path
                  d="M100 66 L138 66 C141 66 142 70 138 72 L100 72 C96 72 97 66 100 66 Z"
                  fill="url(#xp-bone-grad)"
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                />
                {/* Left Knobs */}
                <circle cx="98" cy="65" r="4.5" fill="url(#xp-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
                <circle cx="98" cy="73" r="4.5" fill="url(#xp-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
                {/* Right Knobs */}
                <circle cx="140" cy="65" r="4.5" fill="url(#xp-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
                <circle cx="140" cy="73" r="4.5" fill="url(#xp-bone-grad)" stroke="#94a3b8" strokeWidth="1" />
                {/* Bone Sheen / Highlights */}
                <path d="M104 68 L134 68" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </div>

        {/* Windows XP Iconic Segmented Progress Bar */}
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
