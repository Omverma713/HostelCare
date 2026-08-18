import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

/**
 * Natively decodes the payload of a JWT token
 */
function decodeToken(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and decode token on mount / token change
  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      
      // Check if token has expired
      if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
        console.warn('Authentication token expired. Logging out.');
        handleLogout();
      } else if (decoded) {
        setUser(decoded);
      } else {
        handleLogout();
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [token]);

  // Handle global 401 session expiration events
  useEffect(() => {
    const handleSessionExpired = () => {
      handleLogout();
      // Dispatch a browser-level toast/notification alert request
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: 'Your session has expired. Please log in again.' }
        })
      );
    };

    window.addEventListener('auth-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth-session-expired', handleSessionExpired);
    };
  }, []);

  const handleLogin = async (registrationNumber, password) => {
    try {
      const data = await api.login(registrationNumber, password);
      if (data && data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        const decoded = decodeToken(data.token);
        setUser(decoded);
        return decoded; // Return user info for dashboard routing
      } else {
        throw new Error(data.message || 'Login failed.');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    token,
    user,
    loading,
    login: handleLogin,
    logout: handleLogout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
