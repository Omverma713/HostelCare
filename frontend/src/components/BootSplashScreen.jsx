import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import './BootSplashScreen.css';

/**
 * Theme-Aware Animated Brand Boot Splash Screen
 * 
 * Automatically detects whether the mobile device / app is in Dark mode or Light mode:
 * - Dark Mode: Deep espresso (#141312) background, warm dark squircle (#201A17), 
 *   pure white/ivory "H" (#FAF7F2), terracotta "C" (#E28771), and gold/terracotta sparkle star (#F5B895).
 * - Light Mode: Warm linen cream (#FAF7F2) background, crisp squircle (#FFF9F5), 
 *   black serif "H" (#1C1B1A), terracotta "C" (#C07660), and terracotta sparkle star (#C07660).
 */
export default function BootSplashScreen({ onComplete }) {
  const [animStage, setAnimStage] = useState('entering'); // 'entering' -> 'merging' -> 'sparkle' -> 'reveal' -> 'fading'
  const [visible, setVisible] = useState(true);

  // Detect whether device / environment is in dark mode
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      if (document.documentElement.classList.contains('dark-theme')) return true;
      if (document.body.classList.contains('login-dark-theme')) return true;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    // Crossfade dismiss native splash after first React DOM paint (seamless transition)
    if (Capacitor.isNativePlatform()) {
      requestAnimationFrame(() => {
        try {
          SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {});
        } catch (e) {
          // ignore
        }
      });
    }
  }, []);

  useEffect(() => {
    // 3. Listen to system dark mode changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e) => {
        const saved = localStorage.getItem('theme');
        if (!saved) {
          setIsDark(e.matches);
        }
      };
      if (mq.addEventListener) {
        mq.addEventListener('change', listener);
      } else if (mq.addListener) {
        mq.addListener(listener);
      }
      return () => {
        if (mq.removeEventListener) {
          mq.removeEventListener('change', listener);
        } else if (mq.removeListener) {
          mq.removeListener(listener);
        }
      };
    }
  }, []);

  useEffect(() => {
    // 4. Timeline sequence
    const t1 = setTimeout(() => setAnimStage('merging'), 100);
    const t2 = setTimeout(() => setAnimStage('sparkle'), 1050);
    const t3 = setTimeout(() => setAnimStage('reveal'), 1450);
    const t4 = setTimeout(() => setAnimStage('fading'), 2500);
    const t5 = setTimeout(() => {
      setVisible(false);
      try {
        } catch (e) {}
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
    <div className={`hc-boot-overlay ${isDark ? 'hc-dark-mode' : 'hc-light-mode'} ${isFading ? 'hc-boot-fading' : ''}`}>
      <div className="hc-boot-center">
        {/* Emblem Squircle Card with Glowing Aura */}
        <div className="hc-emblem-card">
          <div className={`hc-card-aura ${isSparkled ? 'flare' : ''}`} />
          <svg viewBox="0 0 200 200" width="94" height="94" fill="none" xmlns="http://www.w3.org/2000/svg" className="hc-emblem-svg">
            {/* Serif Letter H: Crisp White (#FAF7F2) in Dark mode, Black (#1C1B1A) in Light mode */}
            <path 
              className={`hc-letter-h-anim ${isMerging ? 'docked' : 'start-left'}`} 
              d="M 42 48 H 70 V 58 H 63 V 90 H 87 V 58 H 80 V 48 H 108 V 58 H 101 V 142 H 108 V 152 H 80 V 142 H 87 V 104 H 63 V 142 H 70 V 152 H 42 V 142 H 49 V 58 H 42 Z" 
              fill={isDark ? '#FAF7F2' : '#1C1B1A'}
            />
            {/* Terracotta Curved Letter C: Luminous Terracotta (#E28771) in Dark mode, Warm Terracotta (#C07660) in Light mode */}
            <path 
              className={`hc-letter-c-anim ${isMerging ? 'docked' : 'start-right'}`} 
              d="M 148 64 C 143 56 133 50 119 50 C 97 50 82 68 82 100 C 82 132 97 150 119 150 C 134 150 144 143 149 135 L 136 122 C 132 128 126 132 119 132 C 108 132 101 120 101 100 C 101 80 108 68 119 68 C 126 68 131 72 135 77 Z" 
              fill={isDark ? '#E28771' : '#C07660'}
            />
            {/* 4-Point Sparkle Star: Warm Golden Terracotta (#F5B895) in Dark mode, Terracotta (#C07660) in Light mode */}
            <polygon 
              className={`hc-sparkle-star-anim ${isSparkled ? 'popped' : 'hidden'}`} 
              points="156,26 160,39 173,43 160,47 156,60 152,47 139,43 152,39" 
              fill={isDark ? '#F5B895' : '#C07660'}
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
