import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { ADMIN_ROLES } from '../constants';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'activate'
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null); // 'admin' | 'student' | null

  // Login Fields State
  const [regNum, setRegNum] = useState('');
  const [password, setPassword] = useState('');

  // Activation Fields State
  const [actRegNum, setActRegNum] = useState('');
  const [actHostel, setActHostel] = useState('');
  const [actRoom, setActRoom] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const doLogin = async (reg, pass) => {
    setLoading(true);
    try {
      const decodedUser = await login(reg, pass);

      // Role filter validation — only if a role button was selected
      if (selectedRole === 'admin' && !ADMIN_ROLES.includes(decodedUser.role)) {
        logout();
        triggerToast('error', '⛔ Access denied. This account is a Student account, not an Admin account.');
        setLoading(false);
        return;
      }

      if (selectedRole === 'student' && decodedUser.role !== 'student') {
        // Admin tried to log in via Student button → reject
        logout();
        triggerToast('error', `⛔ Access denied. This is a ${decodedUser.role} account, not a Student account.`);
        setLoading(false);
        return;
      }

      triggerToast('success', `Welcome, ${decodedUser.name || decodedUser.registrationNumber}!`);
      switch (decodedUser.role) {
        case 'student':        navigate('/student', { replace: true }); break;
        case 'caretaker':      navigate('/caretaker', { replace: true }); break;
        case 'warden':         navigate('/warden', { replace: true }); break;
        case 'superintendent': navigate('/superintendent', { replace: true }); break;
        default:               navigate('/', { replace: true });
      }
    } catch (error) {
      const msg = error.data?.message || error.message || 'Login failed. Please try again.';
      triggerToast('error', msg);
      if (error.status === 403 && msg.toLowerCase().includes('activate')) {
        setActiveTab('activate');
        setActRegNum(reg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!regNum || !password) {
      triggerToast('error', 'Please enter registration number and password.');
      return;
    }
    await doLogin(regNum, password);
  };

  const handleActivateSubmit = async (e) => {
    e.preventDefault();
    if (!actRegNum || !actHostel || !newPassword || !confirmPassword) {
      triggerToast('error', 'All activation fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerToast('error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.activate(actRegNum, actHostel, actRoom, newPassword, confirmPassword);
      if (res.success) {
        triggerToast('success', 'Account activated successfully! You can now log in.');
        setRegNum(actRegNum);
        setPassword('');
        setActiveTab('login');
      } else {
        triggerToast('error', res.message || 'Activation failed.');
      }
    } catch (error) {
      triggerToast('error', error.data?.message || error.message || 'Failed to activate account.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className={`auth-page-container ${theme}-theme`}>
      {/* Floating Theme Switcher */}
      <div className="auth-theme-switcher">
        <button
          type="button"
          className={`auth-theme-btn ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setTheme('light')}
        >
          ☀️ Light
        </button>
        <button
          type="button"
          className={`auth-theme-btn ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          🌙 Dark
        </button>
      </div>

      {/* Background Animated Blobs for Premium Aesthetic */}
      <div className="auth-bg-gradient"></div>
      <div className="auth-bg-blob auth-bg-blob-1"></div>
      <div className="auth-bg-blob auth-bg-blob-2"></div>
      <div className="auth-bg-blob auth-bg-blob-3"></div>

      <div className="auth-card">
        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
            disabled={loading}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${activeTab === 'activate' ? 'active' : ''}`}
            onClick={() => setActiveTab('activate')}
            disabled={loading}
          >
            Activate Account
          </button>
        </div>

        <div className="auth-body">
          {/* Logo */}
          <div className="auth-logo">👥</div>

          <h2 className="auth-title">HostelCare Portal</h2>
          <p className="auth-subtitle">
            {activeTab === 'login'
              ? 'Choose your role to continue'
              : 'Activate your account by establishing a secure password'}
          </p>

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              {/* Compact Role Selector Grid */}
              <div className="auth-role-grid">
                <button
                  type="button"
                  className={`auth-role-btn auth-role-btn-admin ${selectedRole === 'admin' ? 'active' : ''}`}
                  onClick={() => setSelectedRole(selectedRole === 'admin' ? null : 'admin')}
                  disabled={loading}
                >
                  <div className="auth-role-btn-icon">🛡️</div>
                  <div className="auth-role-btn-text">
                    <span className="auth-role-btn-title">Admin</span>
                    <span className="auth-role-btn-sub">Staff / Warden</span>
                  </div>
                  {selectedRole === 'admin' && <span className="auth-role-check">✓</span>}
                </button>

                <button
                  type="button"
                  className={`auth-role-btn auth-role-btn-student ${selectedRole === 'student' ? 'active' : ''}`}
                  onClick={() => setSelectedRole(selectedRole === 'student' ? null : 'student')}
                  disabled={loading}
                >
                  <div className="auth-role-btn-icon">🎓</div>
                  <div className="auth-role-btn-text">
                    <span className="auth-role-btn-title">Student</span>
                    <span className="auth-role-btn-sub">Hostel Resident</span>
                  </div>
                  {selectedRole === 'student' && <span className="auth-role-check">✓</span>}
                </button>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="regNum">
                  {selectedRole === 'admin' ? 'Admin Registration Number' : selectedRole === 'student' ? 'Student Registration Number' : 'Registration Number'}
                </label>
                <input
                  id="regNum"
                  type="text"
                  className="form-input"
                  placeholder={selectedRole === 'admin' ? 'e.g. SUP001 or WRD001' : 'e.g. 2021BCS001'}
                  value={regNum}
                  onChange={(e) => setRegNum(e.target.value.trim())}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '6px' }}
                disabled={loading}
              >
                {loading ? 'Signing In...' : selectedRole ? `Sign In as ${selectedRole === 'admin' ? 'Admin' : 'Student'}` : 'Sign In'}
              </button>
            </form>
          ) : (
            /* Activate Account Form */
            <form onSubmit={handleActivateSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="actRegNum">Registration Number</label>
                <input
                  id="actRegNum"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2021BCS001"
                  value={actRegNum}
                  onChange={(e) => setActRegNum(e.target.value.trim())}
                  disabled={loading}
                  required
                />
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="actHostel">Hostel Name</label>
                  <input
                    id="actHostel"
                    type="text"
                    className="form-input"
                    placeholder="e.g. BH-1"
                    value={actHostel}
                    onChange={(e) => setActHostel(e.target.value.trim())}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="actRoom">Room Number</label>
                  <input
                    id="actRoom"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 302"
                    value={actRoom}
                    onChange={(e) => setActRoom(e.target.value.trim())}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px', padding: '12px' }}
                disabled={loading}
              >
                {loading ? 'Activating...' : 'Activate Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
