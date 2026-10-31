import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { ADMIN_ROLES } from '../constants';
import { biometricService } from '../services/biometricService';
import { Capacitor } from '@capacitor/core';
import './WarmLinenLogin.css';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  // Tab State: 'login' | 'activate'
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);

  // Role Selection: 'student' | 'admin' (Defaults to student)
  const [selectedRole, setSelectedRole] = useState('student');

  // Login Input States
  const [regNum, setRegNum] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // POP-OUT BUTTON ANIMATION STATE
  // false = button rests inside the password input
  // true = button pops out and expands into full pill shape below
  const [isButtonPopped, setIsButtonPopped] = useState(false);
  const [shakeInputs, setShakeInputs] = useState(false);
  const autoRetractTimerRef = React.useRef(null);

  // Biometric saved user
  const [savedBiometricUser, setSavedBiometricUser] = useState(null);

  // Activation Fields
  const [actRegNum, setActRegNum] = useState('');
  const [actHostel, setActHostel] = useState('');
  const [actRoom, setActRoom] = useState('');
  const [actToken, setActToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Auto-retract submit button after 7 seconds of inactivity
  useEffect(() => {
    if (isButtonPopped && !loading) {
      if (autoRetractTimerRef.current) clearTimeout(autoRetractTimerRef.current);
      autoRetractTimerRef.current = setTimeout(() => {
        setIsButtonPopped(false);
      }, 7000);
    }
    return () => {
      if (autoRetractTimerRef.current) clearTimeout(autoRetractTimerRef.current);
    };
  }, [isButtonPopped, loading]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const saved = biometricService.getSavedUser();
      if (saved && saved.regNum) {
        setSavedBiometricUser(saved);
        setRegNum((prev) => prev || saved.regNum);
      }
    }
  }, []);

  // Core Login Procedure
  const doLogin = async (reg, pass, options = {}) => {
    setLoading(true);
    try {
      const decodedUser = await login(reg, pass);

      // Role filter check
      if (selectedRole === 'admin' && !ADMIN_ROLES.includes(decodedUser.role)) {
        logout();
        triggerToast('error', '⛔ Access denied. This account is a Student account, not an Admin account.');
        return;
      }

      if (selectedRole === 'student' && decodedUser.role !== 'student') {
        logout();
        triggerToast('error', `⛔ Access denied. This is a ${decodedUser.role} account, not a Student account.`);
        return;
      }

      // Auto-save credentials on Android Mobile APK for 1-Touch Fingerprint
      if (Capacitor.isNativePlatform()) {
        try {
          await biometricService.saveCredentials(reg, pass, decodedUser);
          setSavedBiometricUser({ regNum: String(reg).trim().toUpperCase(), userName: decodedUser?.name });
        } catch (saveErr) {
          console.warn('[Login] auto-save biometric warning:', saveErr);
        }
      }

      const toastTitle = options?.viaBiometric ? '👆 Fingerprint Login' : 'Sanctuary Access';
      triggerToast('success', `Welcome back, ${decodedUser.name || decodedUser.registrationNumber}!`, toastTitle);

      switch (decodedUser.role) {
        case 'student':        navigate('/student', { replace: true }); break;
        case 'caretaker':      navigate('/caretaker', { replace: true }); break;
        case 'warden':         navigate('/warden', { replace: true }); break;
        case 'superintendent': navigate('/superintendent', { replace: true }); break;
        case 'superadmin':     navigate('/superadmin', { replace: true }); break;
        default:               navigate('/', { replace: true });
      }
    } catch (error) {
      const msg = error.data?.message || error.message || 'Login failed. Please verify credentials.';
      triggerToast('error', msg);

      // Trigger tactile shake error on input boxes
      setShakeInputs(true);
      setTimeout(() => setShakeInputs(false), 650);

      // Auto-tuck button back into password box after 5 seconds on error
      if (autoRetractTimerRef.current) clearTimeout(autoRetractTimerRef.current);
      autoRetractTimerRef.current = setTimeout(() => {
        setIsButtonPopped(false);
      }, 5000);
      if (error.status === 403 && msg.toLowerCase().includes('activate')) {
        setActiveTab('activate');
        setActRegNum(reg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Pop-Out & Submit Handler
  const handleTriggerPop = (e) => {
    e?.preventDefault?.();
    if (!isButtonPopped) {
      setIsButtonPopped(true);
    }
    if (autoRetractTimerRef.current) clearTimeout(autoRetractTimerRef.current);
    autoRetractTimerRef.current = setTimeout(() => {
      setIsButtonPopped(false);
    }, 7000);

    // If inputs already filled, submit immediately
    if (regNum.trim() && password) {
      doLogin(regNum.trim(), password);
    } else if (!regNum.trim()) {
      triggerToast('info', 'Please enter your Registration Number');
    } else if (!password) {
      triggerToast('info', 'Please enter your Passcode');
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!isButtonPopped) {
      setIsButtonPopped(true);
    }
    if (!regNum.trim() || !password) {
      triggerToast('error', 'Please enter registration number and password.');
      return;
    }
    doLogin(regNum.trim(), password);
  };

  // Biometric Handler
  const handleBiometricLogin = async () => {
    try {
      setLoading(true);
      const creds = await biometricService.loginWithBiometric();
      if (creds && creds.regNum && creds.password) {
        await doLogin(creds.regNum, creds.password, { viaBiometric: true });
      }
    } catch (err) {
      const msg = err?.message || '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('negative') && !msg.toLowerCase().includes('user cancelled')) {
        triggerToast('error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Activation Submit Handler
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
      const res = await api.activate(actRegNum, actHostel, actRoom, newPassword, confirmPassword, actToken.trim() || undefined);
      if (res.success) {
        triggerToast('success', 'Account activated successfully! You can now log in.');
        setRegNum(actRegNum);
        setPassword('');
        setActToken('');
        setActiveTab('login');
        setIsButtonPopped(false);
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
    <div className="wl-login-page">
      <div className="wl-login-card">

        {/* Top Organic Emblem Badge */}
        <div className="wl-emblem">
          🌿
        </div>

        <div className="text-center">
          <span className="wl-badge-pill">
            HostelCare • Warm Linen Edition
          </span>
          <h1 className="wl-title">Welcome Back</h1>
          <p className="wl-subtitle">
            Access your private student sanctuary and hostel services
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Activate Account with Smooth Sliding Pill */}
        <div className="wl-auth-tabs">
          <div 
            className="wl-sliding-indicator" 
            style={{ transform: activeTab === 'login' ? 'translateX(0%)' : 'translateX(100%)' }} 
          />
          <button
            type="button"
            className={`wl-auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setIsButtonPopped(false); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`wl-auth-tab-btn ${activeTab === 'activate' ? 'active' : ''}`}
            onClick={() => { setActiveTab('activate'); setIsButtonPopped(false); }}
          >
            Activate Account
          </button>
        </div>

        {/* -------------------------------------------------------------
            TAB 1: SIGN IN (ZEN PAVILION WITH MORPHING BUTTON)
            ------------------------------------------------------------- */}
        {activeTab === 'login' ? (
          <form onSubmit={handleFormSubmit}>

            {/* Dual Role Switcher with Smooth Sliding Pill */}
            <div className="wl-role-grid">
              <div 
                className="wl-role-sliding-indicator" 
                style={{ transform: selectedRole === 'student' ? 'translateX(0%)' : 'translateX(100%)' }} 
              />
              <button
                type="button"
                className={`wl-role-btn ${selectedRole === 'student' ? 'active' : ''}`}
                onClick={() => setSelectedRole('student')}
              >
                <span>🎓</span>
                <span>Student Resident</span>
              </button>
              <button
                type="button"
                className={`wl-role-btn ${selectedRole === 'admin' ? 'active' : ''}`}
                onClick={() => setSelectedRole('admin')}
              >
                <span>🛡️</span>
                <span>Warden & Staff</span>
              </button>
            </div>

            {/* Registration Number Field */}
            <div className="wl-form-group">
              <label className="wl-form-label" htmlFor="regNumInput">
                {selectedRole === 'admin' ? 'Staff / Admin Registration #' : 'Registration Number'}
              </label>
              <div className={`wl-input-wrapper ${shakeInputs ? 'shake-error' : ''}`}>
                <input
                  id="regNumInput"
                  type="text"
                  className="wl-text-input"
                  placeholder={selectedRole === 'admin' ? 'e.g. SUP001 or WRD001' : 'e.g. 24E114B14'}
                  value={regNum}
                  onChange={(e) => setRegNum(e.target.value.trim())}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password Field with Embedded Morphing Button */}
            <div className="wl-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="wl-form-label" htmlFor="passwordInput" style={{ margin: 0 }}>
                  Passcode
                </label>
                <span
                  style={{ fontSize: 11.5, color: '#728D7A', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => triggerToast('info', 'Contact your Hostel Warden or Superintendent to reset password.')}
                >
                  Forgot PIN?
                </span>
              </div>

              {/* Password Box */}
              <div className={`wl-input-wrapper ${shakeInputs ? 'shake-error' : ''}`}>
                <input
                  id="passwordInput"
                  type={showPassword ? 'text' : 'password'}
                  className="wl-text-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTriggerPop();
                    }
                  }}
                  disabled={loading}
                  required
                />

                {/* Password Eye Toggle */}
                <button
                  type="button"
                  className="wl-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label="Toggle password view"
                >
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>

                {/* INSIDE STATE: Submit button nestled snugly right inside password box */}
                {!isButtonPopped && (
                  <button
                    type="button"
                    onClick={handleTriggerPop}
                    className="wl-inside-submit-btn"
                    title="Click to launch submit pill button"
                    aria-label="Unlock Sanctuary"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* OUTSIDE STATE: Popped-Out Pill Button (Animated Downward Morph) */}
            {isButtonPopped && (
              <div className="wl-popped-pill-wrap">
                <button
                  type="submit"
                  className="wl-popped-pill-btn"
                  disabled={loading}
                  id="btn-login-submit"
                >
                  {loading ? (
                    <>
                      <span className="wl-spinner"></span>
                      <span>Authenticating Sanctuary...</span>
                    </>
                  ) : (
                    <>
                      <span>Unlock Sanctuary</span>
                      <span>✨</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Biometric Fingerprint Button (Native APK & Supported Browsers) */}
            {(Capacitor.isNativePlatform() || savedBiometricUser) && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 9999,
                    background: '#EEF3EE',
                    border: '1px solid #D5E2D7',
                    color: '#587360',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: 15 }}>👆</span>
                  <span>Sign In with Fingerprint {savedBiometricUser?.regNum ? `(${savedBiometricUser.regNum})` : ''}</span>
                </button>
              </div>
            )}

          </form>
        ) : (
          /* -------------------------------------------------------------
              TAB 2: ACTIVATE ACCOUNT
              ------------------------------------------------------------- */
          <form onSubmit={handleActivateSubmit}>
            <div className="wl-form-group">
              <label className="wl-form-label" htmlFor="actReg">Registration Number</label>
              <div className="wl-input-wrapper">
                <input
                  id="actReg"
                  type="text"
                  className="wl-text-input"
                  placeholder="e.g. 24E114B14"
                  value={actRegNum}
                  onChange={(e) => setActRegNum(e.target.value.trim())}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="wl-form-group">
                <label className="wl-form-label" htmlFor="actHostel">Hostel Name</label>
                <div className="wl-input-wrapper">
                  <input
                    id="actHostel"
                    type="text"
                    className="wl-text-input"
                    placeholder="e.g. BH-8"
                    value={actHostel}
                    onChange={(e) => setActHostel(e.target.value.trim())}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="wl-form-group">
                <label className="wl-form-label" htmlFor="actRoom">Room Number</label>
                <div className="wl-input-wrapper">
                  <input
                    id="actRoom"
                    type="text"
                    className="wl-text-input"
                    placeholder="e.g. 215"
                    value={actRoom}
                    onChange={(e) => setActRoom(e.target.value.trim())}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="wl-form-group">
              <label className="wl-form-label" htmlFor="newPass">New Password</label>
              <div className="wl-input-wrapper">
                <input
                  id="newPass"
                  type={showNewPassword ? 'text' : 'password'}
                  className="wl-text-input"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="wl-eye-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  👁️
                </button>
              </div>
            </div>

            <div className="wl-form-group">
              <label className="wl-form-label" htmlFor="confPass">Confirm Password</label>
              <div className="wl-input-wrapper">
                <input
                  id="confPass"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="wl-text-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="wl-eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  👁️
                </button>
              </div>
            </div>

            <div className="wl-form-group">
              <label className="wl-form-label" htmlFor="tokenInput">
                Setup Token <span style={{ textTransform: 'none', color: '#9C9B94' }}>(Optional)</span>
              </label>
              <div className="wl-input-wrapper">
                <input
                  id="tokenInput"
                  type="text"
                  className="wl-text-input"
                  placeholder="Paste single-use token if provisioned"
                  value={actToken}
                  onChange={(e) => setActToken(e.target.value.trim())}
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                type="submit"
                className="wl-popped-pill-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="wl-spinner"></span>
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <span>Complete Activation →</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Guest Mess Menu Shortcut Card */}
        <div className="wl-guest-mess-card">
          <div>
            <h4 className="wl-mess-title">Hungry right now?</h4>
            <p className="wl-mess-sub">Check weekly mess schedule (No login required)</p>
          </div>
          <button
            type="button"
            className="wl-mess-btn"
            onClick={() => navigate('/mess-menu')}
          >
            Mess Menu →
          </button>
        </div>

        {/* Footer Support Links */}
        <div className="wl-footer-links">
          <a href="#" onClick={(e) => { e.preventDefault(); triggerToast('info', 'Contact campus caretaker for room assistance.'); }}>Need Help?</a>
          <span>•</span>
          <a href="#" onClick={(e) => { e.preventDefault(); triggerToast('info', 'ITER Security Gate 1 active 24/7.'); }}>Campus Security</a>
          <span>•</span>
          <a href="#" onClick={(e) => { e.preventDefault(); triggerToast('info', 'HostelCare v1.2.2 - Campus Living Sanctuary.'); }}>Terms</a>
        </div>

      </div>
    </div>
  );
}
