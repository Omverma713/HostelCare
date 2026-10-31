import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './WarmLinenApp.css';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
export default function WarmLinenApp({ embedded = false, initialTab }) {
  const { user, login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const displayName = user?.name || 'Om Verma';
  const displayRoom = user?.roomNumber ? `Room ${user.roomNumber}, Block ${user.hostelBlock || user.hostel || 'BH-8'}` : 'Room 205, Block BH-8';
  const displayReg = user?.registrationNumber || '2021BCS001';

  const [currentUserRole, setCurrentUserRole] = useState(user?.role === 'superadmin' ? 'admin' : 'student');
  const [adminSubTab, setAdminSubTab] = useState('overview');
  const [broadcastTitle, setBroadcastTitle] = useState('Important Campus Notice');
  const [broadcastBody, setBroadcastBody] = useState('Water supply maintenance scheduled in Block BH-8 from 2:00 PM to 4:00 PM.');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [sessionsData, setSessionsData] = useState([
    { id: 'sess_1', user: 'SA-2026-001', name: 'Master Super Admin', role: 'superadmin', device: 'Edge on Windows', ip: '172.18.0.1', status: 'active', time: 'Just now' },
    { id: 'sess_2', user: '24E101A63', name: 'Bhavya Arnav', role: 'student', device: 'Android App (FCM)', ip: '172.18.0.1', status: 'active', time: '12m ago' },
    { id: 'sess_3', user: '24E122A11', name: 'Om Verma', role: 'student', device: 'Android App (FCM)', ip: '172.18.0.1', status: 'active', time: '35m ago' },
    { id: 'sess_4', user: '24E114B14', name: 'Rakesh Sharma', role: 'student', device: 'Chrome on macOS', ip: '172.18.0.1', status: 'active', time: '1h ago' },
  ]);
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const defaultTab = initialTab || urlTab || (window.location.pathname.startsWith('/superadmin') ? 'admin' : 'home');
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
      if (urlTab === 'room') setShowQrModal(true);
      if (urlTab === 'complaints') setShowComplaintModal(true);
    } else if (initialTab) {
      setActiveTab(initialTab);
    } else if (window.location.pathname.startsWith('/superadmin')) {
      setActiveTab('admin');
    } else if (window.location.pathname.startsWith('/student')) {
      setActiveTab('home');
    }
  }, [urlTab, initialTab, searchParams]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'superadmin',
      senderName: 'Master Super Admin',
      text: 'Hello Om! Caretaker Ramesh will visit Room 205 at 4:30 PM with the replacement tube-light. Please ensure someone is present.',
      time: '02:15 PM',
      read: true,
    },
    {
      id: 2,
      sender: 'student',
      senderName: 'Om Verma',
      text: 'Sure sir, my roommate Jagat is in the room. He will assist the caretaker. Thank you for the quick resolution!',
      time: '02:18 PM',
      read: true,
    },
  ]);
  const [inputMsg, setInputMsg] = useState('');

  
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!loginRegNum || !loginPassword) {
      triggerToast('error', 'Please enter registration number and password');
      return;
    }
    setLoginLoading(true);
    try {
      const u = await login(loginRegNum, loginPassword);
      triggerToast('success', `Welcome back, ${u.name || u.registrationNumber}!`);
      setShowLoginModal(false);
      setLoginPassword('');
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'student',
      senderName: 'Om Verma',
      text: inputMsg,
      time: 'Just now',
      read: false,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    // Simulate auto caretaker acknowledgment
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'caretaker',
          senderName: 'Caretaker Ramesh',
          text: 'Acknowledged Om! Reaching your room shortly with tools.',
          time: 'Just now',
          read: true,
        },
      ]);
    }, 1800);
  };

  return (
    <div className={embedded ? "warm-linen-embedded" : "app-shell"} style={embedded ? { width: '100%', maxWidth: 1080, margin: '0 auto', background: 'transparent' } : {}}>
      {/* 1. TOP NAVBAR */}
      {!embedded && (
        <header className="top-navbar">
        <div className="brand-title" onClick={() => setActiveTab('home')}>
          <span>HostelCare</span>
          <span className="brand-badge">Warm Linen Edition</span>
        </div>

        {/* ROLE SWITCHER FOR DEMO VERIFICATION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'inline-flex', background: '#EAE5DB', padding: 3, borderRadius: 9999, border: '1px solid #DED8CC' }}>
            <button
              onClick={() => { setCurrentUserRole('student'); if (activeTab === 'admin') setActiveTab('home'); }}
              style={{
                border: 'none',
                background: currentUserRole === 'student' ? '#FFFFFF' : 'transparent',
                color: currentUserRole === 'student' ? '#242523' : '#73756F',
                padding: '6px 16px',
                borderRadius: 9999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: currentUserRole === 'student' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🎓 Student Interface
            </button>
            <button
              onClick={() => { setCurrentUserRole('admin'); setActiveTab('admin'); }}
              style={{
                border: 'none',
                background: currentUserRole === 'admin' ? '#FFFFFF' : 'transparent',
                color: currentUserRole === 'admin' ? '#242523' : '#73756F',
                padding: '6px 16px',
                borderRadius: 9999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: currentUserRole === 'admin' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ⚡ Super Admin Portal
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <button 
              className="terracotta-menu-btn" 
              title={isAuthenticated ? `Logged in: ${displayName}` : "Sign In to HostelCare"}
              onClick={() => {
                if (isAuthenticated) {
                  if (window.confirm(`Logged in as ${displayName} (${displayRoom}). Sign out?`)) {
                    logout();
                    triggerToast('info', 'Signed out successfully');
                  }
                } else {
                  setShowLoginModal(true);
                }
              }}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      )}
      {/* 2. WORKSPACE LAYOUT (SIDEBAR + MAIN CONTENT) */}
      <div className="workspace-layout">
        {/* SLIM VERTICAL ICON SIDEBAR */}
        {!embedded && (
          <aside className="icon-sidebar">
          {/* Home Icon */}
          <div className="sidebar-icon-wrap">
            <button
              className={`sidebar-icon-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
              title="Home Sanctuary"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            {activeTab === 'home' && <div className="active-indicator-bar" />}
          </div>

          {/* Calendar / Mess Icon */}
          <div className="sidebar-icon-wrap">
            <button
              className={`sidebar-icon-btn ${activeTab === 'mess' ? 'active' : ''}`}
              onClick={() => setActiveTab('mess')}
              title="Weekly Dining Schedule"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
            {activeTab === 'mess' && <div className="active-indicator-bar" />}
          </div>

          {/* Living Space / Room Icon */}
          <div className="sidebar-icon-wrap">
            <button
              className={`sidebar-icon-btn ${activeTab === 'room' ? 'active' : ''}`}
              onClick={() => setActiveTab('room')}
              title="My Living Space & Outing Pass"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
            {activeTab === 'room' && <div className="active-indicator-bar" />}
          </div>

          {/* Complaints / Maintenance Icon */}
          <div className="sidebar-icon-wrap">
            <button
              className={`sidebar-icon-btn ${activeTab === 'complaints' ? 'active' : ''}`}
              onClick={() => setActiveTab('complaints')}
              title="Maintenance & Complaints"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </button>
            {activeTab === 'complaints' && <div className="active-indicator-bar" />}
          </div>

          {/* Support Chat Icon */}
          <div className="sidebar-icon-wrap">
            <button
              className={`sidebar-icon-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => navigate('/chat')}
              title="Support Chat (E2EE)"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            {activeTab === 'chat' && <div className="active-indicator-bar" />}
          </div>

          {/* Admin Icon (ONLY VISIBLE FOR SUPER ADMINS / WARDENS - NEVER STUDENTS) */}
          {currentUserRole === 'admin' && (
            <div className="sidebar-icon-wrap">
              <button
                className={`sidebar-icon-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
                title="Super Admin Command"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </button>
              {activeTab === 'admin' && <div className="active-indicator-bar" />}
            </div>
          )}
          </aside>
        )}

        {/* MAIN VIEWPORT */}
        <main className="main-viewport" style={embedded ? { padding: '12px 0 60px', flex: 1 } : {}}>
          {/* =========================================================================
              VIEW 1: EXACT MOCKUP HOME (Today's Meal & My Living Space)
             ========================================================================= */}
          {activeTab === 'home' && (
            <div className="detailed-view-container">
              <div className="view-mode-bar">
                <span className="view-mode-title">Resident Sanctuary • Overview</span>
                <div className="resident-quick-tag">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#728D7A' }}></span>
                  <span>Om Verma • Room 205 (BH-8)</span>
                </div>
              </div>

              {/* THE TWO EXACT HERO CARDS FROM THE MOCKUP */}
              <div className="mockup-hero-cards">
                {/* 1. Today's Meal Card */}
                <div 
                  className="mockup-card" 
                  onClick={() => setActiveTab('mess')}
                  title="Click to view full weekly dining timetable"
                >
                  <div className="mockup-card-header">
                    <h2 className="mockup-card-title">Today's Meal</h2>
                    <div className="matcha-circle-badge">
                      {/* Leaf SVG */}
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
                        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="mockup-card-footer">
                    <p className="mockup-card-subtitle">Dinner is being served • 8:30 PM</p>
                    <p className="mockup-card-menu-hint">Menu: Lentil Stew, Organic Veg, Rice</p>
                  </div>
                </div>

                {/* 2. My Living Space Card */}
                <div 
                  className="mockup-card" 
                  onClick={() => setActiveTab('room')}
                  title="Click to view room details, roommate & outing gate pass"
                >
                  <div className="mockup-card-header">
                    <h2 className="mockup-card-title">My Living Space</h2>
                  </div>
                  <div className="mockup-card-footer">
                    <p className="mockup-card-subtitle">Room 205, Block BH-8</p>
                    <span className="matcha-pill-badge">Everything in order</span>
                  </div>
                </div>
              </div>

              {/* SECONDARY QUICK ACTION CARDS */}
              <div className="secondary-cards-grid">
                <div className="secondary-mini-card" onClick={() => setActiveTab('complaints')}>
                  <div className="mini-card-head">
                    <h4>Maintenance Pipeline</h4>
                    <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '3px 9px', borderRadius: 9999, fontWeight: 600 }}>1 In Progress</span>
                  </div>
                  <p className="mini-card-sub">Tube-light replacement • Caretaker Ramesh assigned</p>
                  <span style={{ fontSize: 13, color: '#728D7A', fontWeight: 600 }}>Track Status →</span>
                </div>

                <div className="secondary-mini-card" onClick={() => navigate('/chat')}>
                  <div className="mini-card-head">
                    <h4>Direct Support Chat</h4>
                    <span style={{ fontSize: 11, background: '#EEF3EE', color: '#587360', padding: '3px 9px', borderRadius: 9999, fontWeight: 600 }}>E2EE Encrypted</span>
                  </div>
                  <p className="mini-card-sub">Super Admin & Caretaker communication thread</p>
                  <span style={{ fontSize: 13, color: '#728D7A', fontWeight: 600 }}>Open Chat Room →</span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 2: WEEKLY MESS TIMETABLE
             ========================================================================= */}
          {activeTab === 'mess' && (
            <div className="detailed-view-container">
              <div className="section-head">
                <button 
                  onClick={() => setActiveTab('home')} 
                  style={{ background: 'none', border: 'none', color: '#728D7A', cursor: 'pointer', padding: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}
                >
                  ← Back to Sanctuary
                </button>
                <h2>Weekly Dining Schedule</h2>
                <p>Official ITER campus meal timetable with verified portion standards and dietary tags.</p>
              </div>

              <div className="dining-schedule-grid">
                <div className="meal-slot-card">
                  <div className="meal-slot-header">
                    <span className="meal-slot-name">🍳 Breakfast</span>
                    <span className="meal-slot-time">07:00 – 09:15 AM</span>
                  </div>
                  <h3 className="meal-main-dish">Idli, Sambar & Vada</h3>
                  <p className="meal-description">Steamed rice idlis with coconut chutney and crispy medu vada.</p>
                  <div className="meal-footer-badges">
                    <span>• 100% Pure Veg</span>
                    <span>Finished</span>
                  </div>
                </div>

                <div className="meal-slot-card">
                  <div className="meal-slot-header">
                    <span className="meal-slot-name">🍱 Lunch</span>
                    <span className="meal-slot-time">12:30 – 02:30 PM</span>
                  </div>
                  <h3 className="meal-main-dish">Thali Buffet Lunch</h3>
                  <p className="meal-description">Usuna & Arua Rice, Dal Tadka, Seasonal Bhaja, Sweet Pickle.</p>
                  <div className="meal-footer-badges">
                    <span>• Veg / Fish (120g)</span>
                    <span>Finished</span>
                  </div>
                </div>

                <div className="meal-slot-card">
                  <div className="meal-slot-header">
                    <span className="meal-slot-name">☕ Evening Snacks</span>
                    <span className="meal-slot-time">05:45 – 07:30 PM</span>
                  </div>
                  <h3 className="meal-main-dish">Tea & Hot Veg Chop</h3>
                  <p className="meal-description">Crispy beetroot spiced chop with choice of ginger tea or milk tea.</p>
                  <div className="meal-footer-badges">
                    <span>• Pure Veg</span>
                    <span>Finished</span>
                  </div>
                </div>

                <div className="meal-slot-card active-meal">
                  <div className="meal-slot-tag">LIVE NOW</div>
                  <div className="meal-slot-header">
                    <span className="meal-slot-name">🌙 Dinner</span>
                    <span className="meal-slot-time">08:30 – 10:00 PM</span>
                  </div>
                  <h3 className="meal-main-dish">Paneer Butter Masala</h3>
                  <p className="meal-description">Fresh tawa roti (unlimited), Steamed Rice, Dal Fry, Sweet Kheer (60g).</p>
                  <div className="meal-footer-badges">
                    <span style={{ color: '#587360', fontWeight: 600 }}>• Serving in Dining Hall</span>
                    <span style={{ background: '#EEF3EE', padding: '2px 8px', borderRadius: 9999, color: '#587360' }}>Sweet Included</span>
                  </div>
                </div>
              </div>

              {/* Portion Standard Callout */}
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 15, color: '#272824' }}>Official Portion Standards (ITER Campus-1)</h4>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Sweet: 60g • Paneer: 80g • Fish: 120g • Egg: 2 pcs (Lunch/Dinner) or 1 pc (Breakfast).</p>
                </div>
                <button 
                  onClick={() => alert('Official ITER Mess Tender Norms: Verified compliant.')}
                  style={{ background: '#EEF3EE', border: '1px solid #D5E2D7', color: '#587360', padding: '8px 18px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  View PDF Norms
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 3: LIVING SPACE & OUTING PASS
             ========================================================================= */}
          {activeTab === 'room' && (
            <div className="detailed-view-container">
              <div className="section-head">
                <button 
                  onClick={() => setActiveTab('home')} 
                  style={{ background: 'none', border: 'none', color: '#728D7A', cursor: 'pointer', padding: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}
                >
                  ← Back to Sanctuary
                </button>
                <h2>My Living Space</h2>
                <p>Room allocation, roommate registry and digital security gate clearance pass.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
                {/* Room Info */}
                <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 32, border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 16px', color: '#272824' }}>Room 205 (Block BH-8)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3EFE7', paddingBottom: 8 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Assigned Bed:</span>
                      <strong style={{ color: '#272824' }}>Bed 205-A (Window side)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3EFE7', paddingBottom: 8 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Roommate:</span>
                      <strong style={{ color: '#272824' }}>Jagat Singh (Bed 205-B)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3EFE7', paddingBottom: 8 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Hostel Warden:</span>
                      <strong style={{ color: '#272824' }}>Prof. P. K. Rout (9437xxxxxx)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Inventory Status:</span>
                      <span style={{ color: '#587360', fontWeight: 600 }}>All 12 items verified</span>
                    </div>
                  </div>
                </div>

                {/* Gate Outing Pass Box */}
                <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 32, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 11, background: '#EEF3EE', color: '#587360', padding: '3px 10px', borderRadius: 9999, fontWeight: 700, letterSpacing: '0.04em' }}>DIGITAL GATE PASS</span>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '12px 0 8px', color: '#272824' }}>Evening Campus Outing</h3>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>Valid for exit through ITER Main Gate 1 between 05:00 PM and 09:30 PM.</p>
                  </div>

                  <button
                    onClick={() => setShowQrModal(true)}
                    style={{ background: '#728D7A', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 20 }}
                  >
                    View Security QR Pass →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 4: MAINTENANCE & COMPLAINTS
             ========================================================================= */}
          {activeTab === 'complaints' && (
            <div className="detailed-view-container">
              <div className="section-head">
                <button 
                  onClick={() => setActiveTab('home')} 
                  style={{ background: 'none', border: 'none', color: '#728D7A', cursor: 'pointer', padding: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}
                >
                  ← Back to Sanctuary
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>Maintenance Pipeline</h2>
                    <p>Transparent tracking for hostel living space repairs and caretaker requests.</p>
                  </div>
                  <button
                    onClick={() => setShowComplaintModal(true)}
                    style={{ background: '#728D7A', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 9999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + File New Request
                  </button>
                </div>
              </div>

              {/* Active Ticket Card */}
              <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 32, border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '3px 10px', borderRadius: 9999, fontWeight: 700 }}>TICKET #HC-2051</span>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '8px 0 4px', color: '#272824' }}>Study Table Tube-light Flickering</h3>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Filed: Today at 11:30 AM • Location: Room 205 (Bed A)</p>
                  </div>
                  <span className="matcha-pill-badge" style={{ background: '#587360' }}>In Progress</span>
                </div>

                {/* 3-Stage Stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', background: '#FAF8F5', padding: '16px 20px', borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#587360', fontWeight: 600, fontSize: 13 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#587360', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
                    1. Registered
                  </div>
                  <div style={{ flex: 1, height: 2, background: '#728D7A' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#587360', fontWeight: 600, fontSize: 13 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#587360', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>2</span>
                    2. Caretaker Assigned (Ramesh)
                  </div>
                  <div style={{ flex: 1, height: 2, background: '#E6E0D5' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E6E0D5', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>3</span>
                    3. Resolved & Verified
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  Caretaker Ramesh is scheduled to visit with a replacement tube-light today at <strong>04:30 PM</strong>.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 5: SUPPORT CHAT (E2EE)
             ========================================================================= */}
          {activeTab === 'chat' && (
            <div className="detailed-view-container">
              <div className="section-head">
                <button 
                  onClick={() => setActiveTab('home')} 
                  style={{ background: 'none', border: 'none', color: '#728D7A', cursor: 'pointer', padding: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}
                >
                  ← Back to Sanctuary
                </button>
                <h2>HostelCare Encrypted Chat</h2>
                <p>Real-time end-to-end encrypted messaging with Hostel Warden, Super Admin & Caretaker.</p>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: 24, border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 480 }}>
                {/* Chat Header */}
                <div style={{ background: '#FAF8F5', borderBottom: '1px solid #EFEAE0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, color: '#272824' }}>Hostel Caretaker & Admin Line</h4>
                    <span style={{ fontSize: 12, color: '#587360' }}>● Online • AES-256-GCM Secured</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ticket #HC-2051</span>
                </div>

                {/* Messages Body */}
                <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: msg.sender === 'student' ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        background: msg.sender === 'student' ? '#EEF3EE' : '#F6F3EC',
                        borderRadius: 18,
                        padding: '12px 18px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#587360', marginBottom: 4 }}>{msg.senderName}</div>
                      <div style={{ fontSize: 14, color: '#272824', lineHeight: 1.4 }}>{msg.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>
                        {msg.time} {msg.sender === 'student' && '✓✓'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Bar */}
                <form onSubmit={handleSendMessage} style={{ padding: 16, background: '#FAF8F5', borderTop: '1px solid #EFEAE0', display: 'flex', gap: 12 }}>
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder="Type message to Caretaker or Warden..."
                    style={{ flex: 1, padding: '12px 18px', borderRadius: 9999, border: '1px solid #D5E2D7', outline: 'none', fontSize: 14 }}
                  />
                  <button
                    type="submit"
                    style={{ background: '#728D7A', color: 'white', border: 'none', padding: '0 24px', borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 6: SUPER ADMIN SUITE (GUARDED)
             ========================================================================= */}
          {activeTab === 'admin' && (
            currentUserRole !== 'admin' ? (
              <div className="detailed-view-container">
                <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 44, border: '1px solid #FEE2E2', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', color: '#DC2626', margin: '0 0 8px', fontSize: 24 }}>Restricted Super Admin Area</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 24px', fontSize: 14, lineHeight: 1.5 }}>
                    Students do not have access to this section. Hardware device registries, audit logs, and push broadcast systems are strictly restricted to Wardens & Super Admins.
                  </p>
                  <button 
                    onClick={() => setActiveTab('home')} 
                    style={{ background: '#728D7A', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 9999, fontWeight: 600, cursor: 'pointer', fontSize: 13.5 }}
                  >
                    ← Return to Student Sanctuary
                  </button>
                </div>
              </div>
            ) : (
              <div className="detailed-view-container">
                <div className="section-head" style={{ marginBottom: 20 }}>
                  <button 
                    onClick={() => setActiveTab('home')} 
                    style={{ background: 'none', border: 'none', color: '#728D7A', cursor: 'pointer', padding: 0, marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>←</span> Back to Sanctuary
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 6px', color: '#242523' }}>Super Admin Command Suite</h2>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Real-time hardware registry, emergency FCM push broadcast, and campus operations.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ background: '#EEF3EE', color: '#587360', padding: '6px 14px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600, border: '1px solid #D5E2D7' }}>
                        ● RBAC SuperAdmin Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-navigation tabs in Warm Linen Pill style */}
                <div style={{ display: 'inline-flex', background: '#EBE6DC', padding: 5, borderRadius: 9999, border: '1px solid #DFD9CE', gap: 4, marginBottom: 28 }}>
                  <button
                    onClick={() => setAdminSubTab('overview')}
                    style={{
                      border: 'none',
                      background: adminSubTab === 'overview' ? '#FFFFFF' : 'transparent',
                      color: adminSubTab === 'overview' ? '#242523' : '#73756F',
                      padding: '7px 18px',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: adminSubTab === 'overview' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Control Overview
                  </button>
                  <button
                    onClick={() => setAdminSubTab('broadcast')}
                    style={{
                      border: 'none',
                      background: adminSubTab === 'broadcast' ? '#FFFFFF' : 'transparent',
                      color: adminSubTab === 'broadcast' ? '#242523' : '#73756F',
                      padding: '7px 18px',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: adminSubTab === 'broadcast' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Instant FCM Broadcast
                  </button>
                  <button
                    onClick={() => setAdminSubTab('sessions')}
                    style={{
                      border: 'none',
                      background: adminSubTab === 'sessions' ? '#FFFFFF' : 'transparent',
                      color: adminSubTab === 'sessions' ? '#242523' : '#73756F',
                      padding: '7px 18px',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: adminSubTab === 'sessions' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Active Sessions ({sessionsData.length})
                  </button>
                </div>

                {/* TAB 1: OVERVIEW METRIC CARDS */}
                {adminSubTab === 'overview' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
                      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '24px 28px', border: '1px solid #E6E0D5', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#7D7F7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrolled Residents</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 600, color: '#242523', margin: '8px 0 4px' }}>1,280</div>
                        <div style={{ fontSize: 12.5, color: '#587360', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>●</span> Active across 4 Hostel Blocks
                        </div>
                      </div>

                      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '24px 28px', border: '1px solid #E6E0D5', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#7D7F7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hardware Devices Paired</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 600, color: '#242523', margin: '8px 0 4px' }}>1,420</div>
                        <div style={{ fontSize: 12.5, color: '#587360', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>●</span> FCM Push Active & Subscribed
                        </div>
                      </div>

                      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '24px 28px', border: '1px solid #E6E0D5', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#7D7F7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maintenance Queue</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 600, color: '#242523', margin: '8px 0 4px' }}>1 In Progress</div>
                        <div style={{ fontSize: 12.5, color: '#7D7F7A' }}>Tube-light replacement • Caretaker Ramesh</div>
                      </div>

                      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '24px 28px', border: '1px solid #E6E0D5', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#7D7F7A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cloud API Status</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 600, color: '#242523', margin: '8px 0 4px' }}>99.98%</div>
                        <div style={{ fontSize: 12.5, color: '#587360', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>●</span> EC2 Production Node Healthy
                        </div>
                      </div>
                    </div>

                    {/* Quick Access Card */}
                    <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '28px 32px', border: '1px solid #E6E0D5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: '0 0 6px', color: '#242523' }}>Full Granular Super Admin Suite</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5 }}>Access pilot testing, user provisioning, closed beta management, and sub-admin delegation.</p>
                      </div>
                      <a 
                        href="/superadmin"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#728D7A', color: '#FFFFFF', textDecoration: 'none', padding: '10px 22px', borderRadius: 9999, fontWeight: 600, fontSize: 13.5 }}
                      >
                        <span>Launch Advanced Console</span>
                        <span>→</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* TAB 2: INSTANT FCM BROADCAST */}
                {adminSubTab === 'broadcast' && (
                  <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 32, border: '1px solid #E6E0D5', maxWidth: 720 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEF3EE', color: '#587360', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, color: '#242523' }}>Emergency Push Dispatcher</h3>
                        <p style={{ margin: 0, fontSize: 13, color: '#7D7F7A' }}>High-priority lockscreen notifications delivered instantly via Firebase Cloud Messaging.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#575854', marginBottom: 6 }}>Target Resident Audience</label>
                        <select 
                          value={broadcastTarget}
                          onChange={(e) => setBroadcastTarget(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #E6E0D5', background: '#FAF8F4', fontSize: 14, color: '#242523', outline: 'none' }}
                        >
                          <option value="all">All Enrolled Residents (1,280 Devices)</option>
                          <option value="bh8">Block BH-8 Boys Hostel (320 Residents)</option>
                          <option value="gh1">Block GH-1 Girls Hostel (280 Residents)</option>
                          <option value="staff">Hostel Caretakers & Wardens Only</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#575854', marginBottom: 6 }}>Notification Title</label>
                        <input 
                          type="text"
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #E6E0D5', background: '#FAF8F4', fontSize: 14, color: '#242523', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#575854', marginBottom: 6 }}>Broadcast Message</label>
                        <textarea 
                          rows={3}
                          value={broadcastBody}
                          onChange={(e) => setBroadcastBody(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #E6E0D5', background: '#FAF8F4', fontSize: 14, color: '#242523', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 12.5, color: '#7D7F7A' }}>Instant push bypasses silent mode on Android.</span>
                        <button
                          onClick={() => {
                            setBroadcastSent(true);
                            if (typeof triggerToast === 'function') {
                              triggerToast('Emergency broadcast delivered to 1,280 devices successfully!', 'success');
                            }
                            setTimeout(() => setBroadcastSent(false), 3000);
                          }}
                          style={{ background: broadcastSent ? '#587360' : '#728D7A', color: 'white', border: 'none', padding: '11px 26px', borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
                        >
                          {broadcastSent ? '✓ Dispatched Successfully' : 'Send Instant Broadcast'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ACTIVE SESSIONS (WARM LINEN CARDS) */}
                {adminSubTab === 'sessions' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <p style={{ margin: 0, fontSize: 13.5, color: '#7D7F7A' }}>
                        Showing {sessionsData.length} live hardware and browser sessions across the campus network.
                      </p>
                      <button 
                        onClick={() => {
                          setSessionsData([
                            { id: 'sess_1', user: 'SA-2026-001', name: 'Master Super Admin', role: 'superadmin', device: 'Edge on Windows', ip: '172.18.0.1', status: 'active', time: 'Just now' },
                            { id: 'sess_2', user: '24E101A63', name: 'Bhavya Arnav', role: 'student', device: 'Android App (FCM)', ip: '172.18.0.1', status: 'active', time: '12m ago' },
                            { id: 'sess_3', user: '24E122A11', name: 'Om Verma', role: 'student', device: 'Android App (FCM)', ip: '172.18.0.1', status: 'active', time: '35m ago' },
                            { id: 'sess_4', user: '24E114B14', name: 'Rakesh Sharma', role: 'student', device: 'Chrome on macOS', ip: '172.18.0.1', status: 'active', time: '1h ago' },
                          ]);
                          if (typeof triggerToast === 'function') triggerToast('Hardware session registry refreshed', 'info');
                        }}
                        style={{ background: '#FAF8F4', border: '1px solid #E6E0D5', borderRadius: 9999, padding: '6px 14px', fontSize: 12.5, color: '#575854', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ↻ Refresh Registry
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {sessionsData.map((sess) => (
                        <div 
                          key={sess.id}
                          style={{
                            background: '#FFFFFF',
                            borderRadius: 20,
                            padding: '20px 28px',
                            border: '1px solid #E6E0D5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 16,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FAF8F4', border: '1px solid #E6E0D5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#575854', fontSize: 18 }}>
                              {sess.device.includes('Android') ? '📱' : '💻'}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#242523' }}>{sess.user}</span>
                                <span style={{ fontSize: 11.5, background: sess.role === 'superadmin' ? '#FAF2EE' : '#EEF3EE', color: sess.role === 'superadmin' ? '#C9826D' : '#587360', padding: '2px 8px', borderRadius: 9999, fontWeight: 600, border: `1px solid ${sess.role === 'superadmin' ? '#F4D3C9' : '#D5E2D7'}` }}>
                                  {sess.role.toUpperCase()}
                                </span>
                              </div>
                              <div style={{ fontSize: 13, color: '#7D7F7A', marginTop: 3 }}>
                                {sess.name} • {sess.device} • IP: {sess.ip}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#587360', fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#728D7A' }}></span>
                                Active
                              </span>
                              <div style={{ fontSize: 11.5, color: '#8E8F8A', marginTop: 2 }}>{sess.time}</div>
                            </div>

                            <button
                              onClick={() => {
                                setSessionsData((prev) => prev.filter((s) => s.id !== sess.id));
                                if (typeof triggerToast === 'function') triggerToast(`Session for ${sess.user} revoked`, 'info');
                              }}
                              style={{
                                background: '#FFF1ED',
                                color: '#C9826D',
                                border: '1px solid #F4D3C9',
                                borderRadius: 9999,
                                padding: '6px 16px',
                                fontSize: 12.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </main>
      </div>

      {/* MODAL: QR GATE PASS */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowQrModal(false)}>×</button>
            <span style={{ fontSize: 11, background: '#EEF3EE', color: '#587360', padding: '4px 10px', borderRadius: 9999, fontWeight: 700 }}>VERIFIED DIGITAL PASS</span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '14px 0 6px', color: '#272824' }}>Campus Security Gate Pass</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--text-secondary)' }}>Show this screen to security officer at ITER Gate 1.</p>

            <div style={{ background: '#FAF8F5', borderRadius: 20, padding: 24, textAlign: 'center', border: '1px dashed #D5E2D7' }}>
              <div style={{ width: 140, height: 140, margin: '0 auto 16px', background: '#272824', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                [QR CODE VERIFIED]
              </div>
              <strong style={{ fontSize: 16, color: '#272824', display: 'block' }}>Om Verma • Room 205 (BH-8)</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Valid till 09:30 PM • 31 Oct 2026</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FILE COMPLAINT */}
      {showComplaintModal && (
        <div className="modal-overlay" onClick={() => setShowComplaintModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowComplaintModal(false)}>×</button>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 16px', color: '#272824' }}>File Living Space Request</h3>
            
            {complaintSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 36, color: '#587360', marginBottom: 12 }}>✓</div>
                <h4 style={{ margin: '0 0 6px' }}>Request Lodged!</h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 20px' }}>Caretaker Ramesh has been automatically notified.</p>
                <button 
                  onClick={() => { setComplaintSubmitted(false); setShowComplaintModal(false); }}
                  style={{ background: '#728D7A', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 9999, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setComplaintSubmitted(true); }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#272824' }}>Category</label>
                  <select style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #D5E2D7' }}>
                    <option>Electrical (Tube-light, Fan, Switchboard)</option>
                    <option>Plumbing (Tap, Flush, Leakage)</option>
                    <option>Carpentry (Bed, Study Table, Door Lock)</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#272824' }}>Description</label>
                  <textarea rows={3} placeholder="Describe the issue..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #D5E2D7' }} defaultValue="Water tap in washroom 2nd floor leaking slowly." />
                </div>
                <button type="submit" style={{ width: '100%', background: '#728D7A', color: 'white', border: 'none', padding: '12px', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Submit Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    
      {/* MODAL: RESIDENT SIGN IN */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowLoginModal(false)}>×</button>
            <span style={{ fontSize: 11, background: '#EEF3EE', color: '#587360', padding: '4px 10px', borderRadius: 9999, fontWeight: 700 }}>RESIDENT AUTHENTICATION</span>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '14px 0 6px', color: '#272824' }}>Sign In to HostelCare</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-secondary)' }}>Access your official room allocation and personal maintenance tickets.</p>

            <form onSubmit={handleAuthSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#242523' }}>Registration Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 2021BCS001" 
                  value={loginRegNum} 
                  onChange={(e) => setLoginRegNum(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E6E0D5', background: '#FAF8F5', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#242523' }}>Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E6E0D5', background: '#FAF8F5', fontSize: 14, outline: 'none' }}
                />
              </div>
              <button 
                type="submit" 
                disabled={loginLoading}
                style={{ width: '100%', background: '#728D7A', color: 'white', border: 'none', padding: '12px', borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: loginLoading ? 'not-allowed' : 'pointer' }}
              >
                {loginLoading ? 'Signing In...' : 'Sign In →'}
              </button>
            </form>
          </div>
        </div>
      )}

</div>
  );
}        

