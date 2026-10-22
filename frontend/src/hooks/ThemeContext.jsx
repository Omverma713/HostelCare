import React, { createContext, useContext, useState, useLayoutEffect, useCallback } from 'react';

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

  const setTheme = useCallback((newTheme) => {
    setThemeState((prev) => {
      const nextTheme = typeof newTheme === 'function' ? newTheme(prev) : newTheme;
      if (nextTheme === prev) return prev;
      applyThemeClasses(nextTheme);
      try {
        localStorage.setItem('theme', nextTheme);
      } catch (e) {
        // ignore quota error
      }
      return nextTheme;
    });
  }, []);

  useLayoutEffect(() => {
    applyThemeClasses(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore quota error
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, [setTheme]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
