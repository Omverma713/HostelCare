import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { ADMIN_ROLES } from '../constants';
import { biometricService } from '../services/biometricService';
import { Capacitor } from '@capacitor/core';
import './WarmLinenLogin.css';

export default function Login() {
  const { login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  // --- PASSWORD MODAL STATES (Change vs Forgot) ---
  const [authModal, setAuthModal] = useState(null); // 'change' | 'forgot' | null

  // Change Password (Old -> New)
  const [cpRegNum, setCpRegNum] = useState('');
  const [cpOldPassword, setCpOldPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpShowOld, setCpShowOld] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpShowConfirm, setCpShowConfirm] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);

  // Forgot Password (OTP / Email Link / Campus Verify)
  // fpStep: 'init' | 'campusVerify' | 'verifyAndReset'
  const [fpStep, setFpStep] = useState('init');
  const [fpRegNum, setFpRegNum] = useState('');
  const [fpHostel, setFpHostel] = useState('');
  const [fpRoom, setFpRoom] = useState('');
  const [fpEmail, setFpEmail] = useState('');
  const [fpMaskedEmail, setFpMaskedEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpToken, setFpToken] = useState('');
  const [fpResetAuthToken, setFpResetAuthToken] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowNew, setFpShowNew] = useState(false);
  const [fpShowConfirm, setFpShowConfirm] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpCountdown, setFpCountdown] = useState(0);

  // Detect 1-Click Link Token in URL on mount
  useEffect(() => {
    try {
      const search = window.location.search;
      if (search) {
        const params = new URLSearchParams(search);
        const tokenParam = params.get('token');
        const regParam = params.get('reg');
        if (tokenParam) {
          setFpToken(tokenParam);
          if (regParam) setFpRegNum(regParam);
          setFpStep('verifyAndReset');
          setAuthModal('forgot');
        }
      }
    } catch (_) {}
  }, []);

  // Resend Countdown Timer
  useEffect(() => {
    if (fpCountdown > 0) {
      const timer = setTimeout(() => setFpCountdown(fpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [fpCountdown]);

  // Handle Change Password (when current passcode is known)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!cpRegNum.trim() || !cpOldPassword || !cpNewPassword) {
      triggerToast('error', 'Please fill in all required fields.');
      return;
    }
    if (cpNewPassword.length < 6) {
      triggerToast('error', 'New passcode must be at least 6 characters.');
      return;
    }
    if (cpNewPassword !== cpConfirmPassword) {
      triggerToast('error', 'New passcodes do not match.');
      return;
    }
    setCpLoading(true);
    try {
      const res = await api.changePassword(cpRegNum.trim(), cpOldPassword, cpNewPassword, cpConfirmPassword);
      if (res.success) {
        triggerToast('success', res.message || 'Passcode changed successfully! Please log in.');
        setRegNum(cpRegNum.trim());
        setPassword('');
        setAuthModal(null);
      } else {
        triggerToast('error', res.message || 'Failed to change passcode.');
      }
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Failed to change passcode.');
    } finally {
      setCpLoading(false);
    }
  };

  // Handle Forgot Password - Step 1: Send OTP / Link
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const cleanReg = fpRegNum.trim().toUpperCase();
    if (!cleanReg) {
      triggerToast('error', 'Please enter your Registration Number.');
      return;
    }
    setFpLoading(true);
    try {
      const res = await api.forgotPassword(cleanReg);
      if (res.requiresCampusVerification || res.code === 'NO_EMAIL_LINKED') {
        triggerToast('info', 'No email linked to this account yet. Verify hostel & room to link your email.');
        setFpStep('campusVerify');
      } else if (res.success) {
        triggerToast('success', res.message || 'Reset code & link sent to your registered email.');
        setFpMaskedEmail(res.maskedEmail || '');
        setFpCountdown(60);
        setFpStep('verifyAndReset');
      } else {
        triggerToast('error', res.message || 'Account not found.');
      }
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Failed to process request.');
    } finally {
      setFpLoading(false);
    }
  };

  // Handle Campus Verification (for students without email in DB)
  const handleCampusVerifySubmit = async (e) => {
    e.preventDefault();
    const cleanReg = fpRegNum.trim().toUpperCase();
    const cleanHostel = fpHostel.trim();
    const cleanRoom = fpRoom.trim();
    const cleanEmail = fpEmail.trim().toLowerCase();

    if (!cleanReg || !cleanHostel || !cleanRoom || !cleanEmail) {
      triggerToast('error', 'Please fill all hostel and email details.');
      return;
    }
    setFpLoading(true);
    try {
      const res = await api.forgotPasswordCampusVerify(cleanReg, cleanHostel, cleanRoom, cleanEmail);
      if (res.success) {
        triggerToast('success', res.message || 'Verification email dispatched successfully!');
        setFpMaskedEmail(cleanEmail);
        setFpCountdown(60);
        setFpStep('verifyAndReset');
      } else {
        triggerToast('error', res.message || 'Campus verification failed.');
      }
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Hostel or room details did not match records.');
    } finally {
      setFpLoading(false);
    }
  };

  // Handle Final Password Reset (with OTP or 1-Click Token)
  const handleFinalResetSubmit = async (e) => {
    e.preventDefault();
    const cleanReg = fpRegNum.trim().toUpperCase();

    if (!fpNewPassword || fpNewPassword.length < 6) {
      triggerToast('error', 'New passcode must be at least 6 characters.');
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      triggerToast('error', 'Passcodes do not match.');
      return;
    }
    if (!fpToken && !fpOtp.trim()) {
      triggerToast('error', 'Please enter the 6-digit OTP from your email.');
      return;
    }

    setFpLoading(true);
    try {
      let authToken = fpResetAuthToken;
      // If student typed OTP, verify OTP first
      if (!fpToken && !authToken && fpOtp.trim()) {
        const otpRes = await api.verifyResetOtp(cleanReg, fpOtp.trim());
        if (!otpRes.success) {
          triggerToast('error', otpRes.message || 'Invalid OTP code.');
          setFpLoading(false);
          return;
        }
        authToken = otpRes.resetAuthToken;
        setFpResetAuthToken(authToken);
      }

      const resetRes = await api.resetPassword({
        registrationNumber: cleanReg,
        token: fpToken || undefined,
        resetAuthToken: authToken || undefined,
        newPassword: fpNewPassword,
        confirmPassword: fpConfirmPassword,
      });

      if (resetRes.success) {
        triggerToast('success', 'Passcode reset successfully! Please sign in with your new passcode.');
        setRegNum(cleanReg);
        setPassword('');
        setAuthModal(null);
        if (window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        triggerToast('error', resetRes.message || 'Failed to reset passcode.');
      }
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Failed to reset passcode.');
    } finally {
      setFpLoading(false);
    }
  };

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
      {/* Floating Theme Switcher Button */}
      <button
        type="button"
        className="wl-login-theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Warm Linen Light' : 'Switch to Espresso Luxury Dark'}
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>

      <div className="wl-login-card">

        {/* Top Organic Emblem Badge */}
        <div className="wl-emblem">
          🌿
        </div>

        <div className="text-center">
          <span className="wl-badge-pill">
            HostelCare • {theme === 'dark' ? 'Espresso Dark Edition' : 'Warm Linen Edition'}
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 11.5, color: '#8E8A83', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      setCpRegNum(regNum);
                      setAuthModal('change');
                    }}
                  >
                    Reset PIN
                  </button>
                  <span style={{ fontSize: 9, color: '#A8A29E' }}>•</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 11.5, color: '#C07660', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      setFpRegNum(regNum);
                      setFpStep('init');
                      setAuthModal('forgot');
                    }}
                  >
                    Forgot PIN?
                  </button>
                </div>
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
              <div className="wl-popped-pill-wrap" style={{ overflow: 'visible', background: 'transparent' }}>
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
                    background: '#F9EBE6',
                    border: '1px solid #F4D3C9',
                    color: '#9C5B49',
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

        {/* =========================================================================
            MODAL 1: RESET PIN (WHEN OLD PASSCODE IS KNOWN)
            ========================================================================= */}
        {authModal === 'change' && (
          <div className="wl-modal-backdrop" onClick={() => setAuthModal(null)}>
            <div className="wl-modal-card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="wl-modal-close-btn"
                onClick={() => setAuthModal(null)}
                aria-label="Close"
              >
                ✕
              </button>

              <div className="wl-modal-header">
                <h3 className="wl-modal-title">Reset Passcode</h3>
                <p className="wl-modal-sub">Update your current passcode with your existing credentials.</p>
              </div>

              <form onSubmit={handleChangePassword}>
                <div className="wl-form-group">
                  <label className="wl-form-label">Registration Number</label>
                  <div className="wl-input-wrapper">
                    <input
                      type="text"
                      className="wl-text-input"
                      placeholder="e.g. 24E114B14"
                      value={cpRegNum}
                      onChange={(e) => setCpRegNum(e.target.value.trim().toUpperCase())}
                      disabled={cpLoading}
                      required
                    />
                  </div>
                </div>

                <div className="wl-form-group">
                  <label className="wl-form-label">Old Passcode</label>
                  <div className="wl-input-wrapper">
                    <input
                      type={cpShowOld ? 'text' : 'password'}
                      className="wl-text-input"
                      placeholder="Current passcode"
                      value={cpOldPassword}
                      onChange={(e) => setCpOldPassword(e.target.value)}
                      disabled={cpLoading}
                      required
                    />
                    <button
                      type="button"
                      className="wl-eye-btn"
                      onClick={() => setCpShowOld(!cpShowOld)}
                      aria-label="Toggle password"
                    >
                      {cpShowOld ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div className="wl-form-group">
                  <label className="wl-form-label">New Passcode</label>
                  <div className="wl-input-wrapper">
                    <input
                      type={cpShowNew ? 'text' : 'password'}
                      className="wl-text-input"
                      placeholder="At least 6 characters"
                      value={cpNewPassword}
                      onChange={(e) => setCpNewPassword(e.target.value)}
                      disabled={cpLoading}
                      required
                    />
                    <button
                      type="button"
                      className="wl-eye-btn"
                      onClick={() => setCpShowNew(!cpShowNew)}
                      aria-label="Toggle password"
                    >
                      {cpShowNew ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div className="wl-form-group">
                  <label className="wl-form-label">Confirm New Passcode</label>
                  <div className="wl-input-wrapper">
                    <input
                      type={cpShowConfirm ? 'text' : 'password'}
                      className="wl-text-input"
                      placeholder="Re-enter new passcode"
                      value={cpConfirmPassword}
                      onChange={(e) => setCpConfirmPassword(e.target.value)}
                      disabled={cpLoading}
                      required
                    />
                    <button
                      type="button"
                      className="wl-eye-btn"
                      onClick={() => setCpShowConfirm(!cpShowConfirm)}
                      aria-label="Toggle password"
                    >
                      {cpShowConfirm ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="wl-modal-submit-btn"
                  disabled={cpLoading}
                >
                  {cpLoading ? 'Updating Passcode...' : 'Save New Passcode →'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 2: FORGOT PIN (BREVO OTP / EMAIL LINK / CAMPUS VERIFY)
            ========================================================================= */}
        {authModal === 'forgot' && (
          <div className="wl-modal-backdrop" onClick={() => setAuthModal(null)}>
            <div className="wl-modal-card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="wl-modal-close-btn"
                onClick={() => setAuthModal(null)}
                aria-label="Close"
              >
                ✕
              </button>

              <div className="wl-modal-header">
                <h3 className="wl-modal-title">Recover Account</h3>
                <p className="wl-modal-sub">
                  {fpStep === 'init' && 'Enter your registration number to receive a 6-digit OTP & 1-click reset link.'}
                  {fpStep === 'campusVerify' && 'Verify your campus hostel & room to securely link your email.'}
                  {fpStep === 'verifyAndReset' && 'Enter your recovery code and choose a new passcode.'}
                </p>
              </div>

              {/* STEP 1: INITIAL REGISTRATION NUMBER ENTRY */}
              {fpStep === 'init' && (
                <form onSubmit={handleForgotSubmit}>
                  <div className="wl-form-group">
                    <label className="wl-form-label">Registration Number</label>
                    <div className="wl-input-wrapper">
                      <input
                        type="text"
                        className="wl-text-input"
                        placeholder="e.g. 24E114B14"
                        value={fpRegNum}
                        onChange={(e) => setFpRegNum(e.target.value.trim().toUpperCase())}
                        disabled={fpLoading}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="wl-modal-info-banner">
                    ✉️ We'll send a 6-digit OTP and direct 1-click password reset link to your registered email address.
                  </div>

                  <button
                    type="submit"
                    className="wl-modal-submit-btn"
                    disabled={fpLoading}
                  >
                    {fpLoading ? 'Checking Records...' : 'Send OTP & Reset Link →'}
                  </button>
                </form>
              )}

              {/* STEP 2: CAMPUS VERIFICATION (FOR USERS WITHOUT LINKED EMAIL) */}
              {fpStep === 'campusVerify' && (
                <form onSubmit={handleCampusVerifySubmit}>
                  <div className="wl-modal-info-banner warning">
                    ⚠️ <strong>Email Not Linked Yet</strong><br />
                    To protect your account, verify your current hostel room records. We'll link your email permanently.
                  </div>

                  <div className="wl-form-group">
                    <label className="wl-form-label">Hostel Name</label>
                    <div className="wl-input-wrapper">
                      <input
                        type="text"
                        className="wl-text-input"
                        placeholder="e.g. BH-8 or GH-2"
                        value={fpHostel}
                        onChange={(e) => setFpHostel(e.target.value.toUpperCase())}
                        disabled={fpLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="wl-form-group">
                    <label className="wl-form-label">Room Number</label>
                    <div className="wl-input-wrapper">
                      <input
                        type="text"
                        className="wl-text-input"
                        placeholder="e.g. 302"
                        value={fpRoom}
                        onChange={(e) => setFpRoom(e.target.value.trim())}
                        disabled={fpLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="wl-form-group">
                    <label className="wl-form-label">Your Email ID</label>
                    <div className="wl-input-wrapper">
                      <input
                        type="email"
                        className="wl-text-input"
                        placeholder="yourname@gmail.com"
                        value={fpEmail}
                        onChange={(e) => setFpEmail(e.target.value.trim())}
                        disabled={fpLoading}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="wl-modal-submit-btn"
                    disabled={fpLoading}
                  >
                    {fpLoading ? 'Verifying Records...' : 'Verify & Send OTP →'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#8E8A83', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => setFpStep('init')}
                    >
                      ← Back
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: OTP / 1-CLICK VERIFICATION & NEW PASSWORD */}
              {fpStep === 'verifyAndReset' && (
                <form onSubmit={handleFinalResetSubmit}>
                  {fpToken ? (
                    <div className="wl-modal-info-banner">
                      ✅ <strong>1-Click Email Link Verified!</strong><br />
                      Set your new passcode below to complete password recovery.
                    </div>
                  ) : (
                    <>
                      <div className="wl-modal-info-banner">
                        ✉️ 6-digit OTP code sent to <strong>{fpMaskedEmail || 'your email'}</strong>. Valid for 15 minutes.
                      </div>

                      <div className="wl-form-group">
                        <label className="wl-form-label" style={{ textAlign: 'center', display: 'block' }}>Enter 6-Digit Code</label>
                        <div className="wl-otp-box-wrap">
                          <input
                            type="text"
                            maxLength={6}
                            className="wl-otp-input-field"
                            placeholder="000000"
                            value={fpOtp}
                            onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={fpLoading}
                            autoFocus
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="wl-form-group">
                    <label className="wl-form-label">New Passcode</label>
                    <div className="wl-input-wrapper">
                      <input
                        type={fpShowNew ? 'text' : 'password'}
                        className="wl-text-input"
                        placeholder="At least 6 characters"
                        value={fpNewPassword}
                        onChange={(e) => setFpNewPassword(e.target.value)}
                        disabled={fpLoading}
                        required
                      />
                      <button
                        type="button"
                        className="wl-eye-btn"
                        onClick={() => setFpShowNew(!fpShowNew)}
                        aria-label="Toggle password"
                      >
                        {fpShowNew ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>

                  <div className="wl-form-group">
                    <label className="wl-form-label">Confirm New Passcode</label>
                    <div className="wl-input-wrapper">
                      <input
                        type={fpShowConfirm ? 'text' : 'password'}
                        className="wl-text-input"
                        placeholder="Re-enter new passcode"
                        value={fpConfirmPassword}
                        onChange={(e) => setFpConfirmPassword(e.target.value)}
                        disabled={fpLoading}
                        required
                      />
                      <button
                        type="button"
                        className="wl-eye-btn"
                        onClick={() => setFpShowConfirm(!fpShowConfirm)}
                        aria-label="Toggle password"
                      >
                        {fpShowConfirm ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="wl-modal-submit-btn"
                    disabled={fpLoading}
                  >
                    {fpLoading ? 'Resetting Passcode...' : 'Reset Passcode & Sign In →'}
                  </button>

                  {!fpToken && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12 }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#8E8A83', cursor: 'pointer' }}
                        onClick={() => setFpStep('init')}
                      >
                        ← Change Reg Number
                      </button>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: fpCountdown > 0 ? '#A8A29E' : '#C07660', cursor: fpCountdown > 0 ? 'default' : 'pointer', fontWeight: 600 }}
                        disabled={fpCountdown > 0 || fpLoading}
                        onClick={handleForgotSubmit}
                      >
                        {fpCountdown > 0 ? `Resend in ${fpCountdown}s` : 'Resend Code'}
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
