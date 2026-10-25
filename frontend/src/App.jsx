import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider, useTheme } from './hooks/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ToastContainer from './components/Toast';
import BetaBanner from './components/BetaBanner';
import Canvas3DBackground from './components/Canvas3DBackground';
import AppFooter from './components/AppFooter';
import MaintenanceScreen from './components/MaintenanceScreen';
import ImpersonationBanner from './components/ImpersonationBanner';
import AppUpdateModal from './components/AppUpdateModal';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './services/api';
import { MobileBackHandler } from './hooks/useMobileBackHandler';
import { initPushNotifications } from './services/notificationService';
import { initMessAutoNotifications } from './services/messNotificationService';

// Immediate Load
import Login from './pages/Login';

// Lazy Loaded Routes for Instant Startup and Smooth Transitions
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const CaretakerDashboard = lazy(() => import('./pages/CaretakerDashboard'));
const WardenDashboard = lazy(() => import('./pages/WardenDashboard'));
const SuperintendentDashboard = lazy(() => import('./pages/SuperintendentDashboard'));
const DevChatPage = lazy(() => import('./pages/DevChatPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SuperAdminPortal = lazy(() => import('./pages/SuperAdminPortal'));
const MessMenuPage = lazy(() => import('./pages/MessMenuPage'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * Lightweight, GPU-friendly page fallback loader
 */
function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-secondary)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', fontWeight: 600 }}>
        <span style={{ width: '16px', height: '16px', border: '2px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <span>Loading...</span>
      </div>
    </div>
  );
}

/**
 * Dashboard Shell Layout containing top mobile nav, 3D Canvas, and sidebar navigation drawer
 */
function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  const isChatRoute = location.pathname === '/chat' || location.pathname === '/feedback';

  useEffect(() => {
    if (user) {
      initPushNotifications();
    }
  }, [user]);

  return (
    <div className={`app-container ${isChatRoute ? 'is-chat-layout' : ''}`}>
      {!isChatRoute && <Canvas3DBackground theme={theme} role="student" />}
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
        {!isChatRoute && <AppFooter />}
      </main>
    </div>
  );
}

/**
 * Helper component that intercepts authenticated roots and redirects to respective role dashboards
 */
function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect corresponding to decoded JWT role
  switch (user.role) {
    case 'student':
      return <Navigate to="/student" replace />;
    case 'caretaker':
      return <Navigate to="/caretaker" replace />;
    case 'warden':
      return <Navigate to="/warden" replace />;
    case 'superintendent':
      return <Navigate to="/superintendent" replace />;
    case 'superadmin':
      return <Navigate to="/superadmin" replace />;
    default:
      // Safety fallback
      return <Navigate to="/unauthorized" replace />;
  }
}

/**
 * Helper component that blocks authenticated users from accessing login page
 */
function LoginRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : <Login />;
}

/**
 * Maintenance manager component that coordinates Global & Selective maintenance screens
 */
function MaintenanceManager({ children }) {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    // 1. Listen for real-time 503 maintenance signals from API layer
    const onMaintenanceEvent = (e) => {
      if (user?.role === 'superadmin') return;
      setMaintenance(e.detail);
    };
    window.addEventListener('maintenance-mode-active', onMaintenanceEvent);

    // 2. Query initial status on load to inform clients immediately
    let isMounted = true;
    api
      .getMaintenanceStatus()
      .then((res) => {
        if (!isMounted || !res?.success) return;
        if (user?.role === 'superadmin') return;

        const m = res.maintenance || {};
        if (m.global?.enabled) {
          setMaintenance({ mode: 'global', ...m.global });
        } else if (m.selective?.enabled) {
          const affectedRoles = m.selective.affectedRoles || [];
          const affectedRegs = m.selective.affectedRegistrationNumbers || [];
          if (user && (affectedRoles.includes(user.role) || affectedRegs.includes(user.registrationNumber))) {
            setMaintenance({ mode: 'selective', ...m.selective });
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      window.removeEventListener('maintenance-mode-active', onMaintenanceEvent);
    };
  }, [user]);

  // Safe recovery path: Super Admin portal and login are not obscured
  const pathname = window.location.pathname;
  const isSuperAdminPortal = pathname.startsWith('/superadmin');
  const isAdminLogin = pathname === '/login' && window.location.search.includes('admin');

  if (maintenance && user?.role !== 'superadmin' && !isSuperAdminPortal && !isAdminLogin) {
    return <MaintenanceScreen maintenance={maintenance} onResolved={() => setMaintenance(null)} />;
  }

  return children;
}

/**
 * Autonomous Meal Reminder Daemon
 * Registers OS alarm schedules for all meal start timings immediately on app launch,
 * completely independent of whether user is authenticated or guest.
 */
function MessMealAlarmScheduler() {
  useEffect(() => {
    initMessAutoNotifications().catch((err) => {
      console.warn('Mess auto notification scheduler notice:', err);
    });
  }, []);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <MaintenanceManager>
            {/* Autonomous Meal Start Timings Alarm Scheduler (Works logged in or logged out) */}
            <MessMealAlarmScheduler />

            {/* Super Admin User Impersonation Session Banner */}
            <ImpersonationBanner />

            {/* Mobile App In-App Version Update Management Modal */}
            <ErrorBoundary fallback={null}>
              <AppUpdateModal />
            </ErrorBoundary>

            {/* Mobile Hardware Back Button Handler */}
            <MobileBackHandler />

            {/* Global Toasts notifications display container */}
            <ToastContainer />

            <Routes>
              {/* Public Authentication Route */}
              <Route path="/login" element={<LoginRoute />} />

              {/* Public Mess Menu Route (Accessible without login & when logged in) */}
              <Route
                path="/mess-menu"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <MessMenuPage />
                  </Suspense>
                }
              />

            {/* Protected Dashboards Route Nesting */}
            <Route element={<ProtectedRoute />}>
              {/* Index redirection route */}
              <Route path="/" element={<HomeRedirect />} />

              {/* Dashboard Shell layout container */}
              <Route element={<DashboardLayout />}>
                {/* Role-specific Dashboard Views */}
                <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                  <Route path="/student" element={<StudentDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['caretaker']} />}>
                  <Route path="/caretaker" element={<CaretakerDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['warden']} />}>
                  <Route path="/warden" element={<WardenDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['superintendent']} />}>
                  <Route path="/superintendent" element={<SuperintendentDashboard />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
                  <Route path="/superadmin" element={<SuperAdminPortal />} />
                  <Route path="/superadmin/*" element={<SuperAdminPortal />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Route>

                {/* Shared Protected Pages: Real-time Developer Support Chat */}
                <Route path="/feedback" element={<DevChatPage />} />
                <Route path="/chat" element={<DevChatPage />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
              </Route>
            </Route>

            {/* 404 Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Signature Hanging Beta Banner */}
          <BetaBanner />
          </MaintenanceManager>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
