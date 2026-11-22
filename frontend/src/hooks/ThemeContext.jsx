import React, { createContext, useContext, useState, useLayoutEffect, useCallback, useRef } from 'react';
import CelestialThemeOverlay from '../components/CelestialThemeOverlay';

const ThemeContext = createContext(null);

function applyThemeClasses(targetTheme) {
  if (typeof document === 'undefined') return;

  // Signal canvas animations to pause BEFORE the class change triggers style recalc.
  // This prevents the rAF draw call from colliding with the browser's cascade recalculation.
  window.dispatchEvent(new CustomEvent('theme-switching-start'));

  const root = document.documentElement;
  if (targetTheme === 'dark') {
    root.classList.add('dark-theme');
    root.classList.remove('light-theme');
    document.body.classList.add('login-dark-theme');
  } else {
    root.classList.add('light-theme');
    root.classList.remove('dark-theme');
    document.body.classList.remove('login-dark-theme');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const initial = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'light';
    applyThemeClasses(initial);
    return initial;
  });

  // Celestial Transition Animation: 'sunrise' | 'sunset' | null
  const [celestialPhase, setCelestialPhase] = useState(null);
  const transitionTimerRef = useRef(null);
  const flipTimerRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const appliedThemeRef = useRef(null);

  const triggerCelestialTransition = useCallback((nextTheme) => {
    // If user prefers reduced motion, switch instantly without animation
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyThemeClasses(nextTheme);
      appliedThemeRef.current = nextTheme;
      setThemeState(nextTheme);
      try {
        localStorage.setItem('theme', nextTheme);
      } catch (e) {}
      return;
    }

    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // 'sunrise' if transitioning into light mode, 'sunset' if into dark mode
    const phase = nextTheme === 'light' ? 'sunrise' : 'sunset';
    setCelestialPhase(phase);

    // Clear any pending timers
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);

    // Midpoint Flip (580ms): Flip classes underneath right as the full-screen circular wave completely blankets the viewport
    flipTimerRef.current = setTimeout(() => {
      applyThemeClasses(nextTheme);
      appliedThemeRef.current = nextTheme;
      setThemeState(nextTheme);
      try {
        localStorage.setItem('theme', nextTheme);
      } catch (e) {}
    }, 580);

    // Completion (1300ms): Reset celestial overlay smoothly
    transitionTimerRef.current = setTimeout(() => {
      setCelestialPhase(null);
      isTransitioningRef.current = false;
    }, 1300);
  }, []);

  const setTheme = useCallback((newTheme) => {
    const nextTheme = typeof newTheme === 'function' ? newTheme(theme) : newTheme;
    if (nextTheme === theme) return;
    triggerCelestialTransition(nextTheme);
  }, [theme, triggerCelestialTransition]);

  useLayoutEffect(() => {
    if (appliedThemeRef.current !== theme) {
      applyThemeClasses(theme);
      appliedThemeRef.current = theme;
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore quota error
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const targetTheme = theme === 'light' ? 'dark' : 'light';
    triggerCelestialTransition(targetTheme);
  }, [theme, triggerCelestialTransition]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isTransitioning: Boolean(celestialPhase),
    celestialPhase,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {/* Cinematic Mountain Sunrise & Sunset Celestial Overlay */}
      <CelestialThemeOverlay phase={celestialPhase} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
