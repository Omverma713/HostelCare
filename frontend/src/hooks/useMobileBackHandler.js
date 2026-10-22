import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Mobile Hardware Back Button Hook
 * 
 * Intercepts Android hardware back button events from Capacitor:
 * 1. Close any open modal dialog
 * 2. Close mobile drawer / sidebar if open
 * 3. Navigate back in React Router history
 * 4. Exit / minimize application gracefully if on a root dashboard / login page
 */
export function useMobileBackHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const capacitor = typeof window !== 'undefined' ? window.Capacitor : null;
    if (!capacitor) return;

    let handle = null;

    const setupListener = async () => {
      try {
        const AppPlugin = capacitor.Plugins?.App;
        if (!AppPlugin) return;

        handle = await AppPlugin.addListener('backButton', ({ canGoBack }) => {
          // 1. If any modal is open -> close it
          const modalBackdrop = document.querySelector('.modal-backdrop');
          if (modalBackdrop) {
            const closeBtn = modalBackdrop.querySelector('.modal-close');
            if (closeBtn) {
              closeBtn.click();
              return;
            }
          }

          // 2. If mobile sidebar drawer is open -> close it
          const sidebarOpen = document.querySelector('.sidebar.open');
          const sidebarBackdrop = document.querySelector('.sidebar-backdrop');
          if (sidebarOpen && sidebarBackdrop) {
            sidebarBackdrop.click();
            return;
          }

          // 3. Root routes where back button should minimize/exit app
          const rootRoutes = ['/login', '/student', '/caretaker', '/warden', '/superintendent', '/superadmin', '/'];
          const isRoot = rootRoutes.includes(location.pathname) || location.pathname.startsWith('/superadmin');

          if (!isRoot && (canGoBack || window.history.length > 1)) {
            navigate(-1);
          } else if (isRoot) {
            AppPlugin.exitApp?.();
          } else {
            navigate(-1);
          }
        });
      } catch (err) {
        console.warn('Capacitor BackButton handler error:', err);
      }
    };

    setupListener();

    return () => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
    };
  }, [navigate, location.pathname]);
}

/**
 * Component wrapper to attach the back handler inside React Router context
 */
export function MobileBackHandler() {
  useMobileBackHandler();
  return null;
}
