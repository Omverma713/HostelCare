import React, { useState, useEffect } from 'react';
import './BootSplashScreen.css';

/**
 * Animated Brand Boot Splash Screen
 * Plays the signature HostelCare animation:
 * 1. Bold Black Serif "H" glides in from the left.
 * 2. Terracotta "C" glides in from the right.
 * 3. H and C dock together into the unified brand emblem.
 * 4. 4-point sparkle star twinkles and flares at top-right.
 * 5. Brand typography fades in, followed by a smooth 400ms fade-out reveal of the app.
 */
export default function BootSplashScreen({ onComplete }) {
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Hold animation for 1.5 seconds, then initiate silky fade-out
    const timer = setTimeout(() => {
      setFading(true);
      const removeTimer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 420);
      return () => clearTimeout(removeTimer);
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className={`hc-boot-overlay ${fading ? 'hc-boot-fading' : ''}`}>
      <div className="hc-boot-center">
        {/* Emblem Squircle Card with Glowing Aura */}
        <div className="hc-emblem-card">
          <div className="hc-card-aura" />
          <svg viewBox="0 0 200 200" width="88" height="88" fill="none" xmlns="http://www.w3.org/2000/svg" className="hc-emblem-svg">
            {/* Bold Black Serif Letter H */}
            <path 
              className="hc-letter-h-anim" 
              d="M 42 48 H 70 V 58 H 63 V 90 H 87 V 58 H 80 V 48 H 108 V 58 H 101 V 142 H 108 V 152 H 80 V 142 H 87 V 104 H 63 V 142 H 70 V 152 H 42 V 142 H 49 V 58 H 42 Z" 
              fill="#1C1B1A"
            />
            {/* Terracotta Curved Letter C */}
            <path 
              className="hc-letter-c-anim" 
              d="M 148 64 C 143 56 133 50 119 50 C 97 50 82 68 82 100 C 82 132 97 150 119 150 C 134 150 144 143 149 135 L 136 122 C 132 128 126 132 119 132 C 108 132 101 120 101 100 C 101 80 108 68 119 68 C 126 68 131 72 135 77 Z" 
              fill="#C07660"
            />
            {/* 4-Point Terracotta Sparkle Star */}
            <polygon 
              className="hc-sparkle-star-anim" 
              points="156,26 160,39 173,43 160,47 156,60 152,47 139,43 152,39" 
              fill="#C07660"
            />
          </svg>
        </div>

        {/* Brand Name Typography */}
        <h1 className="hc-boot-brand-name">HostelCare</h1>
        <p className="hc-boot-brand-tag">Campus Living Sanctuary</p>

        {/* Living Progress Shimmer Bar */}
        <div className="hc-boot-track">
          <div className="hc-boot-bar" />
        </div>
      </div>
    </div>
  );
}

