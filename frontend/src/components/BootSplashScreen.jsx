import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import './BootSplashScreen.css';

/**
 * Animated Brand Boot Splash Screen
 * 
 * Sequenced physics-based boot animation:
 * 1. Immediate Native Splash Dismissal (0ms) so web animation takes over seamlessly.
 * 2. Stage 1 (0ms - 100ms): Screen is warm linen cream, squircle card appears.
 * 3. Stage 2 (100ms - 1100ms): Black Serif "H" glides in from left (-120px)
 *    and Terracotta "C" glides in from right (+120px), merging in center.
 * 4. Stage 3 (1100ms - 1600ms): 4-point sparkle star bursts at top-right with golden shine flare.
 * 5. Stage 4 (1500ms - 2400ms): Brand typography & living shimmer progress bar appear.
 * 6. Stage 5 (2500ms - 2900ms): Silky 400ms fade-out reveal of the dashboard.
 */
export default function BootSplashScreen({ onComplete }) {
  const [animStage, setAnimStage] = useState('entering'); // 'entering' -> 'merging' -> 'sparkle' -> 'reveal' -> 'fading'
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 1. Immediately dismiss native splash so the animated view is 100% visible
    if (Capacitor.isNativePlatform()) {
      try {
        SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }

    // 2. Timeline sequence
    const t1 = setTimeout(() => setAnimStage('merging'), 100);
    const t2 = setTimeout(() => setAnimStage('sparkle'), 1050);
    const t3 = setTimeout(() => setAnimStage('reveal'), 1450);
    const t4 = setTimeout(() => setAnimStage('fading'), 2500);
    const t5 = setTimeout(() => {
      setVisible(false);
      if (onComplete) onComplete();
    }, 2950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  if (!visible) return null;

  const isFading = animStage === 'fading';
  const isMerging = animStage !== 'entering';
  const isSparkled = animStage === 'sparkle' || animStage === 'reveal' || animStage === 'fading';
  const isRevealed = animStage === 'reveal' || animStage === 'fading';

  return (
    <div className={`hc-boot-overlay ${isFading ? 'hc-boot-fading' : ''}`}>
      <div className="hc-boot-center">
        {/* Emblem Squircle Card with Glowing Aura */}
        <div className="hc-emblem-card">
          <div className={`hc-card-aura ${isSparkled ? 'flare' : ''}`} />
          <svg viewBox="0 0 200 200" width="94" height="94" fill="none" xmlns="http://www.w3.org/2000/svg" className="hc-emblem-svg">
            {/* Bold Black Serif Letter H */}
            <path 
              className={`hc-letter-h-anim ${isMerging ? 'docked' : 'start-left'}`} 
              d="M 42 48 H 70 V 58 H 63 V 90 H 87 V 58 H 80 V 48 H 108 V 58 H 101 V 142 H 108 V 152 H 80 V 142 H 87 V 104 H 63 V 142 H 70 V 152 H 42 V 142 H 49 V 58 H 42 Z" 
              fill="#1C1B1A"
            />
            {/* Terracotta Curved Letter C */}
            <path 
              className={`hc-letter-c-anim ${isMerging ? 'docked' : 'start-right'}`} 
              d="M 148 64 C 143 56 133 50 119 50 C 97 50 82 68 82 100 C 82 132 97 150 119 150 C 134 150 144 143 149 135 L 136 122 C 132 128 126 132 119 132 C 108 132 101 120 101 100 C 101 80 108 68 119 68 C 126 68 131 72 135 77 Z" 
              fill="#C07660"
            />
            {/* 4-Point Terracotta Sparkle Star */}
            <polygon 
              className={`hc-sparkle-star-anim ${isSparkled ? 'popped' : 'hidden'}`} 
              points="156,26 160,39 173,43 160,47 156,60 152,47 139,43 152,39" 
              fill="#C07660"
            />
          </svg>
        </div>

        {/* Brand Name Typography */}
        <h1 className={`hc-boot-brand-name ${isRevealed ? 'visible' : ''}`}>HostelCare</h1>
        <p className={`hc-boot-brand-tag ${isRevealed ? 'visible' : ''}`}>Campus Living Sanctuary</p>

        {/* Living Progress Shimmer Bar */}
        <div className={`hc-boot-track ${isRevealed ? 'visible' : ''}`}>
          <div className="hc-boot-bar" />
        </div>
      </div>
    </div>
  );
}
