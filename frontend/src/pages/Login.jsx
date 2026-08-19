import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { ADMIN_ROLES } from '../constants';
import IsometricHostelRoom3D from '../components/IsometricHostelRoom3D';
import InteractiveLamp from '../components/InteractiveLamp';
import Canvas3DBackground from '../components/Canvas3DBackground';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Active Concepts:
  // 'concept1' -> 1. 🌌 Classic Portal (Original GitHub theme - Default)
  // 'concept2' -> 2. 🏠 3D Room Pod (Split 3D Isometric Hostel Room & Floating Particles)
  // 'concept3' -> 3. 💡 Cute Lamp (Interactive Lamp Pull-Cord Experience)
  const [activeConcept, setActiveConcept] = useState('concept1');

  // Lamp State for Concept 3 (Cute Lamp)
  const [isLampOn, setIsLampOn] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);

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

  // 3D Card Tilt & Specular Glare State
  const cardRef = useRef(null);
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const handleCardMouseMove = (e) => {
    if (!cardRef.current || (activeConcept === 'concept3' && !isLampOn)) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setCardTilt({ rotateX, rotateY, glareX, glareY });
  };

  const handleCardMouseLeave = () => {
    setCardTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const doLogin = async (reg, pass) => {
    setLoading(true);
    try {
      const decodedUser = await login(reg, pass);

      // Role filter validation
      if (selectedRole === 'admin' && !ADMIN_ROLES.includes(decodedUser.role)) {
        logout();
        triggerToast('error', '⛔ Access denied. This account is a Student account, not an Admin account.');
        setLoading(false);
        return;
      }

      if (selectedRole === 'student' && decodedUser.role !== 'student') {
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
    <div
      className={`auth-page-container ${theme}-theme ${activeConcept}-mode ${
        selectedRole ? `role-active-${selectedRole}` : ''
      } ${activeConcept === 'concept3' ? (isLampOn ? 'lamp-state-on' : 'lamp-state-off') : ''}`}
    >
      {/* Smooth Theme Background Cross-Fade Overlays */}
      <div className="auth-theme-backdrop auth-backdrop-dark" />
      <div className="auth-theme-backdrop auth-backdrop-light" />

      {/* Option 1 Unique Dark Theme: 3D Cyber Horizon & Neon Wireframe Grid (Zero Floating Particles) */}
      {activeConcept === 'concept1' && theme === 'dark' && (
        <div className="classic-dark-cyber-stage" aria-hidden="true">
          <div className="cyber-aurora-glow" />
          <div className="cyber-horizon-line" />
          <div className="cyber-horizon-sun" />
          <div className="cyber-grid-plane" />
          <div className="cyber-light-beams" />
        </div>
      )}

      {/* 3D Floating Particle Nebula Background (Active ONLY for Option 2, 4, and Concept 1 Light) */}
      {(activeConcept === 'concept2' || activeConcept === 'concept4' || (activeConcept === 'concept1' && theme === 'light')) && (
        <Canvas3DBackground role={selectedRole} theme={theme} concept={activeConcept} />
      )}

      {/* Top Header Control Bar: Concept Switcher (4 Options) & Theme Switcher */}
      <div className="auth-top-controls">
        {/* Concept Switcher (4 Independent 3D Tactile Object Buttons with 8px Gap) */}
        <div className="auth-concept-switcher">
          <button
            type="button"
            className={`auth-concept-btn concept-btn-1 ${activeConcept === 'concept1' ? 'active' : ''}`}
            onClick={() => setActiveConcept('concept1')}
          >
            <span className="concept-badge">1</span>
            <span className="concept-icon">🌌</span>
            <span className="concept-label">Classic</span>
          </button>
          <button
            type="button"
            className={`auth-concept-btn concept-btn-2 ${activeConcept === 'concept2' ? 'active' : ''}`}
            onClick={() => setActiveConcept('concept2')}
          >
            <span className="concept-badge">2</span>
            <span className="concept-icon">🏠</span>
            <span className="concept-label">3D Room Pod</span>
          </button>
          <button
            type="button"
            className={`auth-concept-btn concept-btn-3 ${activeConcept === 'concept3' ? 'active' : ''}`}
            onClick={() => setActiveConcept('concept3')}
          >
            <span className="concept-badge">3</span>
            <span className="concept-icon">💡</span>
            <span className="concept-label">Cute Lamp</span>
          </button>
          <button
            type="button"
            className={`auth-concept-btn concept-btn-4 ${activeConcept === 'concept4' ? 'active' : ''}`}
            onClick={() => setActiveConcept('concept4')}
          >
            <span className="concept-badge">4</span>
            <span className="concept-icon">🔮</span>
            <span className="concept-label">Cyber Velvet</span>
          </button>
        </div>

        {/* Theme Switcher (2 Independent 3D Tactile Object Buttons with 8px Gap) */}
        <div className="auth-theme-toggle">
          <button
            type="button"
            className={`auth-theme-btn theme-btn-light ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <span className="theme-icon">☀️</span>
            <span className="theme-label">Light</span>
          </button>
          <button
            type="button"
            className={`auth-theme-btn theme-btn-dark ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <span className="theme-icon">🌙</span>
            <span className="theme-label">Dark</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          OPTION 1 & 4: CENTERED CARD LAYOUT (CLASSIC & CYBER VELVET)
          =================================================================== */}
      {(activeConcept === 'concept1' || activeConcept === 'concept4') && (
        <div className={`auth-main-layout centered-layout ${activeConcept}-layout`}>
          {/* Original Background Animated Glow Blobs */}
          <div className="auth-bg-blob auth-bg-blob-1" />
          <div className="auth-bg-blob auth-bg-blob-2" />
          <div className="auth-bg-blob auth-bg-blob-3" />

          <div className="auth-card auth-card-classic">
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
                  {/* Role Selector Grid */}
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
                    <label className="form-label" htmlFor="regNum1">
                      {selectedRole === 'admin' ? 'Admin Registration Number' : selectedRole === 'student' ? 'Student Registration Number' : 'Registration Number'}
                    </label>
                    <input
                      id="regNum1"
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
                    <label className="form-label" htmlFor="password1">Password</label>
                    <input
                      id="password1"
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
                    <label className="form-label" htmlFor="actRegNum1">Registration Number</label>
                    <input
                      id="actRegNum1"
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
                      <label className="form-label" htmlFor="actHostel1">Hostel Name</label>
                      <input
                        id="actHostel1"
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
                      <label className="form-label" htmlFor="actRoom1">Room Number</label>
                      <input
                        id="actRoom1"
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
                    <label className="form-label" htmlFor="newPassword1">New Password</label>
                    <input
                      id="newPassword1"
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
                    <label className="form-label" htmlFor="confirmPassword1">Confirm Password</label>
                    <input
                      id="confirmPassword1"
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
      )}

      {/* ===================================================================
          OPTION 2: 3D ISOMETRIC HOSTEL ROOM POD
          =================================================================== */}
      {activeConcept === 'concept2' && (
        <div className="auth-main-layout split-layout concept2-layout">
          <div className="auth-hero-3d-column">
            <div className="auth-hero-text">
              <span className="auth-hero-tag">Smart Campus Living</span>
              <h1 className="auth-hero-heading">Welcome to HostelCare</h1>
              <p className="auth-hero-sub">
                Your intelligent 3D portal for seamless room allocation, maintenance requests, and automated access.
              </p>
            </div>
            <IsometricHostelRoom3D role={selectedRole} />
          </div>

          <div className="auth-card-3d-wrapper">
            <div
              ref={cardRef}
              className="auth-card auth-card-3d"
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={{
                transform: `perspective(1100px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg) scale3d(1, 1, 1)`,
              }}
            >
              <div
                className="auth-card-glare"
                style={{
                  background: `radial-gradient(circle at ${cardTilt.glareX}% ${cardTilt.glareY}%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 65%)`,
                }}
              />

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
                <div className="auth-logo auth-logo-3d">
                  <span className="logo-3d-glyph">🏢</span>
                </div>

                <h2 className="auth-title">HostelCare Portal</h2>
                <p className="auth-subtitle">
                  {activeTab === 'login'
                    ? 'Choose your role to enter the portal'
                    : 'Activate your account with a secure credential'}
                </p>

                {activeTab === 'login' ? (
                  <form onSubmit={handleLoginSubmit}>
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
                      <label className="form-label" htmlFor="regNum2">
                        {selectedRole === 'admin' ? 'Admin Registration Number' : selectedRole === 'student' ? 'Student Registration Number' : 'Registration Number'}
                      </label>
                      <input
                        id="regNum2"
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
                      <label className="form-label" htmlFor="password2">Password</label>
                      <input
                        id="password2"
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
                  <form onSubmit={handleActivateSubmit}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="actRegNum2">Registration Number</label>
                      <input
                        id="actRegNum2"
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
                        <label className="form-label" htmlFor="actHostel2">Hostel Name</label>
                        <input
                          id="actHostel2"
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
                        <label className="form-label" htmlFor="actRoom2">Room Number</label>
                        <input
                          id="actRoom2"
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
                      <label className="form-label" htmlFor="newPassword2">New Password</label>
                      <input
                        id="newPassword2"
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
                      <label className="form-label" htmlFor="confirmPassword2">Confirm Password</label>
                      <input
                        id="confirmPassword2"
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
        </div>
      )}

      {/* ===================================================================
          OPTION 3: CUTE LAMP PULL-CORD EXPERIENCE
          =================================================================== */}
      {activeConcept === 'concept3' && (
        <div className="concept4-lamp-layout concept3-mode">
          {/* Left: Cute Interactive Lamp with Pull Cord */}
          <div className="concept4-lamp-column">
            <InteractiveLamp
              isOn={isLampOn}
              onToggle={(newState) => setIsLampOn(newState)}
              isTypingPassword={isTypingPassword}
            />
          </div>

          {/* Right: The Login Card */}
          <div className="concept4-card-column">
            <div
              ref={cardRef}
              className={`concept4-card ${isLampOn ? 'card-illuminated' : 'card-dormant'}`}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={{
                transform: isLampOn
                  ? `perspective(1000px) rotateX(${cardTilt.rotateX * 0.6}deg) rotateY(${cardTilt.rotateY * 0.6}deg) scale(1) translateY(0)`
                  : 'perspective(1000px) scale(0.2) translateY(40px)',
              }}
            >
              {/* Warm Light Glow Sheen when ON */}
              {isLampOn && <div className="concept4-card-warm-halo" />}

              <div className="concept4-card-header">
                <div className="concept4-lamp-status-pill">
                  {isLampOn ? (
                    <>
                      <span className="pulse-dot on" />
                      <span>Lamp Illuminated</span>
                    </>
                  ) : (
                    <>
                      <span className="pulse-dot off" />
                      <span>Pull string to turn on</span>
                    </>
                  )}
                </div>
                <h1 className="concept4-card-title">
                  {activeTab === 'login' ? 'Sign in to HostelCare' : 'Activate Resident Account'}
                </h1>
                <p className="concept4-card-subtitle">
                  {activeTab === 'login'
                    ? 'Enter your institutional credentials to enter the portal'
                    : 'Establish your room access credentials'}
                </p>
              </div>

              {/* Concept 3 Tabs */}
              <div className="concept4-auth-tabs">
                <button
                  type="button"
                  className={`concept4-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                  onClick={() => setActiveTab('login')}
                  disabled={loading || !isLampOn}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`concept4-tab-btn ${activeTab === 'activate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('activate')}
                  disabled={loading || !isLampOn}
                >
                  Activate Account
                </button>
              </div>

              {activeTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="concept4-form">
                  {/* Role Selector Grid */}
                  <div className="auth-role-grid">
                    <button
                      type="button"
                      className={`auth-role-btn auth-role-btn-admin ${selectedRole === 'admin' ? 'active' : ''}`}
                      onClick={() => setSelectedRole(selectedRole === 'admin' ? null : 'admin')}
                      disabled={loading || !isLampOn}
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
                      disabled={loading || !isLampOn}
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
                    <label className="form-label" htmlFor="regNum3">
                      {selectedRole === 'admin' ? 'Admin Registration Number' : selectedRole === 'student' ? 'Student Registration Number' : 'Registration Number'}
                    </label>
                    <input
                      id="regNum3"
                      type="text"
                      className="form-input"
                      placeholder={selectedRole === 'admin' ? 'e.g. SUP001 or WRD001' : 'e.g. 2021BCS001'}
                      value={regNum}
                      onChange={(e) => setRegNum(e.target.value.trim())}
                      disabled={loading || !isLampOn}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="password3">
                      Password
                      {isTypingPassword && <span className="lamp-peek-hint">🙈 Lamp is peeking away!</span>}
                    </label>
                    <input
                      id="password3"
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsTypingPassword(true)}
                      onBlur={() => setIsTypingPassword(false)}
                      disabled={loading || !isLampOn}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="concept4-login-btn"
                    disabled={loading || !isLampOn}
                  >
                    {loading ? 'Signing In...' : selectedRole ? `Sign In as ${selectedRole === 'admin' ? 'Admin' : 'Student'} →` : 'Sign In →'}
                  </button>
                </form>
              ) : (
                /* Activate Account Form */
                <form onSubmit={handleActivateSubmit} className="concept4-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="actRegNum3">Registration Number</label>
                    <input
                      id="actRegNum3"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2021BCS001"
                      value={actRegNum}
                      onChange={(e) => setActRegNum(e.target.value.trim())}
                      disabled={loading || !isLampOn}
                      required
                    />
                  </div>

                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="actHostel3">Hostel Name</label>
                      <input
                        id="actHostel3"
                        type="text"
                        className="form-input"
                        placeholder="e.g. BH-1"
                        value={actHostel}
                        onChange={(e) => setActHostel(e.target.value.trim())}
                        disabled={loading || !isLampOn}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="actRoom3">Room Number</label>
                      <input
                        id="actRoom3"
                        type="text"
                        className="form-input"
                        placeholder="e.g. 302"
                        value={actRoom}
                        onChange={(e) => setActRoom(e.target.value.trim())}
                        disabled={loading || !isLampOn}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="newPassword3">New Password</label>
                    <input
                      id="newPassword3"
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading || !isLampOn}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="confirmPassword3">Confirm Password</label>
                    <input
                      id="confirmPassword3"
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading || !isLampOn}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="concept4-login-btn"
                    disabled={loading || !isLampOn}
                  >
                    {loading ? 'Activating Account...' : 'Activate Account →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
