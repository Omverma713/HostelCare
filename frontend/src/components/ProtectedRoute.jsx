import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Route protection wrapper based on authentication status and user roles.
 */
export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="loading-spinner-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // User is not authenticated, redirect to Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but does not have the required role, redirect to Unauthorized page
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Authorized, render nested routes
  return <Outlet />;
}
