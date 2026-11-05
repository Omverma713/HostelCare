import './pages/WarmLinenApp.css';
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
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

import Login from './pages/Login';
import GlobalNoticePopup from './components/GlobalNoticePopup';
import BootSplashScreen from './components/BootSplashScreen';

// Lazy Loaded Routes for Instant Startup and Smooth Transitions
const WarmLinenApp = lazy(() => import('./pages/WarmLinenApp'));
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
 * Graceful error fallback if any lazy-loaded dashboard throws a render error
 */
function RouteErrorFallback() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '24px',
      textAlign: 'center',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '16px',
        padding: '32px 24px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Interface Load Error</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
          An error occurred while loading this view. This can be resolved by refreshing or clearing cached scripts.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'var(--primary, #3b82f6)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🔄 Reload Page
          </button>
          <button
            onClick={() => {
              if ('caches' in window) {
                caches.keys().then((names) => {
                  names.forEach((name) => caches.delete(name));
                });
              }
              window.location.href = '/';
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🧹 Clear Cache & Home
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard Shell Layout containing top mobile nav, 3D Canvas, and sidebar navigation drawer
 */
function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const p = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab');

  const role = user?.role || 'student';
  const isSuperAdmin = role === 'superadmin';
  const isCaretaker = role === 'caretaker';
  const isWarden = role === 'warden';
  const isSuperintendent = role === 'superintendent';
  const isStudent = role === 'student';

  const isChat = p === '/chat' || p === '/feedback';
  const isMess = p.startsWith('/mess') || tabParam === 'mess';

  // Role-specific Active States
  let isHome = false;
  let isUsers = false;
  let isRoom = false;
  let isComplaints = false;
  let isSessions = false;

  if (isSuperAdmin) {
    isHome = (p === '/superadmin' && (!tabParam || tabParam === 'overview'));
    isUsers = tabParam === 'users';
    isComplaints = tabParam === 'maintenance';
    isSessions = tabParam === 'sessions';
  } else if (isCaretaker) {
    isHome = p === '/caretaker';
    isComplaints = isHome;
  } else if (isWarden) {
    isHome = p === '/warden';
  } else if (isSuperintendent) {
    isHome = p === '/superintendent';
  } else {
    isHome = (p === '/student' || p === '/') && (!tabParam || tabParam === 'home') && !isMess && !isChat;
    isRoom = tabParam === 'room';
    isComplaints = tabParam === 'complaints';
  }

  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 1. TOP NAVBAR */}
      <header className="top-navbar">
        <div 
          className="brand-title"
          onClick={() => navigate(isSuperAdmin ? '/superadmin?tab=overview' : '/student')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
        >
          <img 
            src="/hostelcare-logo.svg" 
            alt="HostelCare" 
            style={{ width: '28px', height: '28px', borderRadius: '8px', objectFit: 'contain', flexShrink: 0 }} 
          />
          <span className="brand-name">HostelCare</span>
        </div>

        <div className="navbar-right-group">
          <div className="navbar-user-pill">
            <img 
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80" 
              alt="Avatar" 
              className="navbar-avatar-img" 
            />
            <span className="user-text-full">
              {isSuperAdmin 
                ? `${user?.name || 'Master Super Admin'} • RBAC SuperAdmin`
                : `${user?.name || 'Om Verma'} • Room ${user?.roomNumber || '205'} (${user?.hostelBlock || 'BH-8'})`}
            </span>
            <span className="user-text-mobile">
              {isSuperAdmin ? 'Admin' : (user?.roomNumber ? `Rm ${user.roomNumber}` : 'Rm 205')}
            </span>
          </div>

          <button 
            className="theme-toggle-warm-btn" 
            title={theme === 'dark' ? 'Switch to Warm Linen Light' : 'Switch to Espresso Luxury Dark'}
            aria-label="Toggle Theme"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          <button 
            className="terracotta-menu-btn header-logout-btn" 
            title={`Log Out (${user?.name || 'Resident'})`}
            aria-label="Log Out"
            onClick={() => {
              if (window.confirm(`Logged in as ${user?.name || 'Resident'} (${user?.role || 'student'}). Sign out?`)) {
                logout();
                navigate('/login');
              }
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* 2. WORKSPACE LAYOUT (CENTERED CONTAINER WITH FLOATING CAPSULE DOCK) */}
      <div className={`workspace-layout ${isSuperAdmin ? 'superadmin-layout' : ''} ${isChat ? 'chat-layout' : ''}`}>
        {/* DOCK SPACER TO PRESERVE NATURAL FLEX FLOW ON DESKTOP */}
        <div className="sidebar-dock-spacer" />

        {/* SLIM VERTICAL ICON SIDEBAR - FIXED ON DESKTOP, FLOATING CAPSULE ON MOBILE */}
        <aside className="icon-sidebar">
          {/* 1. Home / Overview */}
          <div className="sidebar-icon-wrap">
            <button 
              onClick={() => {
                if (isSuperAdmin) navigate('/superadmin?tab=overview');
                else if (isCaretaker) navigate('/caretaker');
                else if (isWarden) navigate('/warden');
                else if (isSuperintendent) navigate('/superintendent');
                else navigate('/student');
              }}
              className={`sidebar-icon-btn ${isHome ? 'active' : ''}`}
              title={isSuperAdmin ? "System Overview & Analytics" : isStudent ? "Home Sanctuary" : "Dashboard Overview"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
          </div>

          {/* 2. Dining / Mess Schedule */}
          <div className="sidebar-icon-wrap">
            <button 
              onClick={() => navigate(isStudent ? '/student?tab=mess' : '/mess-menu')}
              className={`sidebar-icon-btn ${isMess ? 'active' : ''}`}
              title="Campus Dining Schedule"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
          </div>

          {/* 3. Section-specific 3rd icon: SuperAdmin Users OR Student Living Space */}
          {isSuperAdmin && (
            <div className="sidebar-icon-wrap">
              <button 
                onClick={() => navigate('/superadmin?tab=users')}
                className={`sidebar-icon-btn ${isUsers ? 'active' : ''}`}
                title="User Directory & Permissions"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </button>
            </div>
          )}

          {isStudent && (
            <div className="sidebar-icon-wrap">
              <button 
                onClick={() => navigate('/student?tab=room')}
                className={`sidebar-icon-btn ${isRoom ? 'active' : ''}`}
                title="My Living Space & Outing Pass"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </button>
            </div>
          )}

          {/* 4. Section-specific 4th icon: Maintenance / Complaints */}
          {(isStudent || isSuperAdmin || isCaretaker || isWarden || isSuperintendent) && (
            <div className="sidebar-icon-wrap">
              <button 
                onClick={() => navigate(isSuperAdmin ? '/superadmin?tab=maintenance' : '/student?tab=complaints')}
                className={`sidebar-icon-btn ${isComplaints ? 'active' : ''}`}
                title={isSuperAdmin ? "Hostel Maintenance Oversight" : "Maintenance Pipeline"}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </button>
            </div>
          )}

          {/* 5. Support Chat */}
          <div className="sidebar-icon-wrap">
            <button 
              onClick={() => navigate('/chat')}
              className={`sidebar-icon-btn ${isChat ? 'active' : ''}`}
              title="Real-time E2EE Support & Dev Chat"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>

          {/* 6. Hardware Sessions (SuperAdmin Only) */}
          {isSuperAdmin && (
            <div className="sidebar-icon-wrap">
              <button 
                onClick={() => navigate('/superadmin?tab=sessions')}
                className={`sidebar-icon-btn ${isSessions ? 'active' : ''}`}
                title="Hardware Sessions & Active Devices"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </button>
            </div>
          )}
        </aside>

        {/* MAIN VIEWPORT */}
        <main className={`main-viewport ${isChat ? 'chat-viewport' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

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
function PushNotificationRegistrar() {
  const { user } = useAuth();

  useEffect(() => {
    initPushNotifications().catch((err) => {
      console.warn('Push notification initialization notice:', err);
    });
  }, [user]);

  return null;
}

function MessMealAlarmScheduler() {
  useEffect(() => {
    initMessAutoNotifications().catch((err) => {
      console.warn('Mess auto notification scheduler notice:', err);
    });
  }, []);

  return null;
}

export default function App() {
  const [showBootSplash, setShowBootSplash] = useState(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider>
      {showBootSplash && <BootSplashScreen onComplete={() => setShowBootSplash(false)} />}
      <AuthProvider>
        <BrowserRouter>
          <MaintenanceManager>
            {/* Autonomous Meal Start Timings Alarm Scheduler (Works logged in or logged out) */}
            <PushNotificationRegistrar />
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
              {/* Public Standalone Warm Linen Showcase Preview */}
              <Route path="/warm-linen" element={<Suspense fallback={<PageFallback />}><WarmLinenApp embedded={false} /></Suspense>} />

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
                  <Route path="/student" element={<Suspense fallback={<PageFallback />}><WarmLinenApp embedded={true} initialTab="home" /></Suspense>} />
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
          {/* <BetaBanner /> */}

          {/* Emergency / Global Pop-up Notice with corner cross */}
          <GlobalNoticePopup />
          </MaintenanceManager>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
