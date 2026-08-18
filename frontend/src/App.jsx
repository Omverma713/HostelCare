import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ToastContainer from './components/Toast';
import BetaBanner from './components/BetaBanner';

// Pages
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import CaretakerDashboard from './pages/CaretakerDashboard';
import WardenDashboard from './pages/WardenDashboard';
import SuperintendentDashboard from './pages/SuperintendentDashboard';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

/**
 * Dashboard Shell Layout containing top mobile nav and sidebar navigation drawer
 */
function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <Outlet />
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Global Toasts notifications display container */}
          <ToastContainer />

          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginRoute />} />

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

                {/* Shared Protected Pages */}
                <Route path="/unauthorized" element={<Unauthorized />} />
              </Route>
            </Route>

            {/* 404 Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Global Beta Banner hanging sign */}
          <BetaBanner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
