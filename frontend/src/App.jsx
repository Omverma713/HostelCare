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
  const location = useLocation();
  const navigate = useNavigate();

  const p = location.pathname;
  const isHome = p === '/' || p === '/student';
  const isMess = p.startsWith('/mess');
  const isComplaints = p.startsWith('/complaints');
  const isChat = p.startsWith('/chat') || p.startsWith('/feedback');
  const isAdmin = p.startsWith('/superadmin') || p.startsWith('/admin');

  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: '#F6F3EC', display: 'flex', flexDirection: 'column' }}>
      {/* 1. TOP NAVBAR */}
      <header className="top-navbar" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', background: '#F6F3EC', borderBottom: '1px solid #E6E0D5' }}>
        <div 
          style={{ fontSize: 23, fontWeight: 600, color: '#242523', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'Playfair Display', Georgia, serif" }}
          onClick={() => navigate('/')}
        >
          <span>HostelCare</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#587360', background: '#EEF3EE', padding: '3px 10px', borderRadius: 9999, letterSpacing: '0.02em', border: '1px solid #D5E2D7' }}>
            Warm Linen Edition
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#FFFFFF', border: '1px solid #E6E0D5', borderRadius: 9999, fontSize: 13, color: '#575854' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#728D7A' }}></span>
            <span>
              {user?.role === 'superadmin' 
                ? `${user?.name || 'Master Super Admin'} • RBAC SuperAdmin`
                : `${user?.name || 'Resident'} • ${user?.roomNumber ? `Room ${user.roomNumber}` : 'Room 205 (BH-8)'}`}
            </span>
          </div>

          <button 
            className="terracotta-menu-btn" 
            title={`Account: ${user?.name || 'Resident'} (${user?.role || 'student'})`}
            onClick={() => {
              if (window.confirm(`Logged in as ${user?.name || 'Resident'} (${user?.role || 'student'}). Sign out?`)) {
                logout();
                navigate('/login');
              }
            }}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* 2. WORKSPACE LAYOUT (SLIM ICON RAIL + MAIN VIEWPORT) */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* SLIM VERTICAL ICON SIDEBAR (EXACTLY LIKE IMAGE 1) */}
        <aside style={{ width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, borderRight: '1px solid #E6E0D5', gap: 28, background: '#F6F3EC' }}>
          {/* Home Icon */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate(user?.role === 'superadmin' ? '/superadmin' : '/student')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: isHome ? '#242523' : '#7D7F7A' }}
              title="Home Sanctuary"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            {isHome && <div style={{ position: 'absolute', right: 0, width: 3.5, height: 24, background: '#242523', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />}
          </div>

          {/* Calendar / Mess Icon */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/mess-menu')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: isMess ? '#242523' : '#7D7F7A' }}
              title="Weekly Dining Schedule"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
            {isMess && <div style={{ position: 'absolute', right: 0, width: 3.5, height: 24, background: '#242523', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />}
          </div>

          {/* Living Space / Room Icon */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/student')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: '#7D7F7A' }}
              title="My Living Space & Outing Pass"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          </div>

          {/* Complaints / Wrench Icon */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/student')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: isComplaints ? '#242523' : '#7D7F7A' }}
              title="Maintenance Pipeline"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </button>
            {isComplaints && <div style={{ position: 'absolute', right: 0, width: 3.5, height: 24, background: '#242523', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />}
          </div>

          {/* Chat Icon */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/chat')}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: isChat ? '#242523' : '#7D7F7A' }}
              title="Support Chat (E2EE)"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            {isChat && <div style={{ position: 'absolute', right: 0, width: 3.5, height: 24, background: '#242523', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />}
          </div>

          {/* Super Admin Shield Icon (Only if user.role === 'superadmin') */}
          {user?.role === 'superadmin' && (
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button 
                onClick={() => navigate('/superadmin')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 12, color: isAdmin ? '#242523' : '#7D7F7A' }}
                title="Super Admin Suite"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </button>
              {isAdmin && <div style={{ position: 'absolute', right: 0, width: 3.5, height: 24, background: '#242523', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />}
            </div>
          )}
        </aside>

        {/* MAIN VIEWPORT */}
        <main style={{ flex: 1, padding: '36px 48px 80px', maxWidth: 1140, boxSizing: 'border-box' }}>
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
                  <Route path="/student" element={<Suspense fallback={<PageFallback />}><WarmLinenApp embedded={true} /></Suspense>} />
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
