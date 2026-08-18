import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { ROLE_LABELS } from '../constants';

/**
 * Sidebar component that dynamically renders links based on user roles
 */
export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const userRole = user.role;

  // Get active dashboard link according to role
  const getDashboardPath = () => {
    switch (userRole) {
      case 'student':
        return '/student';
      case 'caretaker':
        return '/caretaker';
      case 'warden':
        return '/warden';
      case 'superintendent':
        return '/superintendent';
      default:
        return '/';
    }
  };

  return (
    <>
      {/* Mobile drawer overlay backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">🛡️ HostelCare</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to={getDashboardPath()}
            onClick={onClose}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            {userRole === 'student' && <span>📝 My Complaints</span>}
            {userRole === 'caretaker' && <span>🛠️ Hostel Complaints</span>}
            {userRole === 'warden' && <span>📊 Warden Dashboard</span>}
            {userRole === 'superintendent' && <span>📈 Superintendent Overview</span>}
          </NavLink>
        </nav>

        {/* User profile card */}
        <div className="sidebar-user">
          <div className="sidebar-user-name">👤 {user.name || 'User'}</div>
          <div className="sidebar-user-detail">Reg: {user.registrationNumber}</div>
          <div className="sidebar-user-detail">Role: {ROLE_LABELS[userRole] || userRole}</div>
          <div className="sidebar-user-detail">Hostel: {user.hostel}</div>
        </div>

        <div className="sidebar-footer">
          {/* Theme switcher panel inside sidebar */}
          <div className="sidebar-theme-toggle-group">
            <button
              type="button"
              className={`sidebar-theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              className={`sidebar-theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              🌙 Dark
            </button>
          </div>

          <button
            onClick={() => {
              logout();
              if (onClose) onClose();
            }}
            className="btn btn-danger"
            style={{ width: '100%' }}
          >
            🚪 Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
