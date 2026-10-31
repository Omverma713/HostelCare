import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './WarmLinenApp.css';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { DEFAULT_MESS_SCHEDULE, DAYS_ORDER } from '../constants/messMenuData';
import { triggerToast } from '../components/Toast';
import { normalizeStatus, sortByDateDesc, isEmptyDataError } from '../utils/status';

const DEPT_ICONS = {
  Electrical: '⚡',
  Plumbing: '🚰',
  Carpentry: '🔨',
  Civil: '🧱',
  Mess: '🍲',
  Other: '🔧',
};
export default function WarmLinenApp({ embedded = false, initialTab }) {
  const { user, login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRegNum, setLoginRegNum] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const displayName = user?.name || (isAuthenticated ? 'Resident' : 'Student Resident');
  const displayRoom = user?.roomNumber ? `Room ${user.roomNumber}${user.hostelBlock ? ` (Block ${user.hostelBlock})` : (user.hostel ? ` (${user.hostel})` : '')}` : 'Room 205 (BH-8)';
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
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    const item = DAYS_ORDER[d === 0 ? 6 : d - 1];
    return (item && typeof item === 'object' ? item.key : item) || 'monday';
  });

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
      if (searchParams.get('action') === 'qr') setShowQrModal(true);
      if (searchParams.get('action') === 'new-complaint') setShowComplaintModal(true);
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

  // Live Maintenance & Complaints State
  const [realComplaints, setRealComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [newComplaintDept, setNewComplaintDept] = useState('Electrical');
  const [newComplaintDesc, setNewComplaintDesc] = useState('');
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);

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
      senderName: displayName,
      text: 'Sure sir, my roommate Jagat is in the room. He will assist the caretaker. Thank you for the quick resolution!',
      time: '02:18 PM',
      read: true,
    },
  ]);
  const [inputMsg, setInputMsg] = useState('');

  
  const fetchComplaints = async () => {
    if (!isAuthenticated) return;
    setComplaintsLoading(true);
    try {
      const res = await api.getStudentComplaints();
      if (res && res.success && Array.isArray(res.complaints)) {
        setRealComplaints(sortByDateDesc(res.complaints));
      } else if (Array.isArray(res)) {
        setRealComplaints(sortByDateDesc(res));
      } else {
        setRealComplaints([]);
      }
    } catch (err) {
      if (isEmptyDataError(err)) {
        setRealComplaints([]);
      } else {
        console.warn('Error loading student complaints:', err);
      }
    } finally {
      setComplaintsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchComplaints();
    }
  }, [isAuthenticated, activeTab]);

  const handleCreateComplaint = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowLoginModal(true);
      triggerToast('info', 'Please sign in to lodge a maintenance request.');
      return;
    }
    if (!newComplaintDesc.trim() || newComplaintDesc.trim().length < 4) {
      triggerToast('error', 'Please provide a clear description (at least 4 characters).');
      return;
    }

    setIsSubmittingComplaint(true);
    try {
      const res = await api.createComplaint(newComplaintDept, newComplaintDesc.trim());
      if (res && res.success) {
        triggerToast('success', 'Maintenance request lodged successfully! Caretaker notified.');
        setComplaintSubmitted(true);
        setNewComplaintDesc('');
        await fetchComplaints();
      } else {
        triggerToast('error', res?.message || 'Failed to lodge complaint.');
      }
    } catch (err) {
      triggerToast('error', err?.data?.message || err?.message || 'Failed to lodge complaint.');
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const activeComplaints = realComplaints.filter(c => normalizeStatus(c.status) !== 'resolved');
  const activeComplaintsCount = activeComplaints.length;
  const latestActiveComplaint = activeComplaints[0] || realComplaints[0];

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
      senderName: displayName,
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
              title={isAuthenticated ? `Log Out (${displayName})` : "Sign In to HostelCare"}
              aria-label={isAuthenticated ? "Log Out" : "Sign In"}
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
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: '#C9826D',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 3px 12px rgba(201, 130, 109, 0.28)',
                transition: 'all 0.18s ease'
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
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
        <main className="main-viewport" style={embedded ? { padding: '8px 16px 60px', flex: 1, maxWidth: 1060, margin: '0 auto', width: '100%' } : {}}>
          {/* =========================================================================
              VIEW 1: EXACT MOCKUP HOME (Today's Meal & My Living Space)
             ========================================================================= */}
          {activeTab === 'home' && (
            <div className="detailed-view-container">
              <div className="view-mode-bar">
                <span className="view-mode-title">Resident Sanctuary • Overview</span>
                <div className="resident-quick-tag"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#728D7A' }}></span><span>{displayName} • {displayRoom}</span></div>
              </div>

              {/* THE TWO EXACT HERO CARDS FROM THE MOCKUP */}
              <div className="mockup-hero-cards">
                {/* 1. Today's Meal Card (Real Dynamic ITER Mess Timetable) */}
                {(() => {
                  const now = new Date();
                  const currentMins = now.getHours() * 60 + now.getMinutes();
                  const d = now.getDay();
                  const todayItem = DAYS_ORDER[d === 0 ? 6 : d - 1];
                  const todayKey = (todayItem && typeof todayItem === 'object' ? todayItem.key : todayItem) || 'monday';
                  const todayMeals = (DEFAULT_MESS_SCHEDULE[todayKey] || DEFAULT_MESS_SCHEDULE.monday)?.meals || {};

                  // Determine active or upcoming meal
                  let statusText = "Dinner is being served • 08:30 PM";
                  let menuText = todayMeals.dinner?.items?.join(', ') || "Roti, Rice, Dal, Special Curry";

                  if (currentMins < 9 * 60 + 15) {
                    statusText = currentMins >= 7 * 60 ? "Breakfast is being served • 07:00 – 09:15 AM" : "Next: Breakfast at 07:00 AM";
                    menuText = "Menu: " + (todayMeals.breakfast?.items?.join(', ') || "Idli, Upma, Chutney");
                  } else if (currentMins < 14 * 60 + 30) {
                    statusText = currentMins >= 12 * 60 + 30 ? "Lunch is being served • 12:30 – 02:30 PM" : "Next: Lunch at 12:30 PM";
                    menuText = "Menu: " + (todayMeals.lunch?.items?.join(', ') || "Rice, Dal, Seasonal Curry, Papad");
                  } else if (currentMins < 19 * 60 + 30) {
                    statusText = currentMins >= 17 * 60 + 45 ? "Evening Snacks is being served • 05:45 – 07:30 PM" : "Next: Evening Snacks at 05:45 PM";
                    menuText = "Menu: " + (todayMeals.snacks?.items?.join(', ') || "Chai & Hot Snacks");
                  } else if (currentMins <= 22 * 60) {
                    statusText = "Dinner is being served • 08:30 – 10:00 PM";
                    menuText = "Menu: " + (todayMeals.dinner?.items?.join(', ') || "Paneer / Chicken, Roti, Dal, Rice");
                  } else {
                    const tomorrowD = (d + 1) % 7;
                    const tomorrowItem = DAYS_ORDER[tomorrowD === 0 ? 6 : tomorrowD - 1];
                    const tomorrowKey = (tomorrowItem && typeof tomorrowItem === 'object' ? tomorrowItem.key : tomorrowItem) || 'sunday';
                    const tomorrowBreakfast = (DEFAULT_MESS_SCHEDULE[tomorrowKey] || DEFAULT_MESS_SCHEDULE.sunday)?.meals?.breakfast;
                    statusText = "Dinner has finished • Next Meal: Tomorrow Breakfast at 07:00 AM";
                    menuText = "Menu: " + (tomorrowBreakfast?.items?.join(', ') || "Upma / Idli & Coffee");
                  }

                  return (
                    <div 
                      className="mockup-card" 
                      onClick={() => setActiveTab('mess')}
                      title="Click to view full weekly dining schedule"
                    >
                      <div className="mockup-card-header">
                        <h2 className="mockup-card-title">Today's Meal</h2>
                        <div className="matcha-circle-badge">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
                            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
                          </svg>
                        </div>
                      </div>
                      <div className="mockup-card-footer">
                        <p className="mockup-card-subtitle">{statusText}</p>
                        <p className="mockup-card-menu-hint">{menuText}</p>
                      </div>
                    </div>
                  );
                })()}

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
                    <p className="mockup-card-subtitle">{displayRoom}</p>
                    <span className="matcha-pill-badge">Everything in order</span>
                  </div>
                </div>
              </div>

              {/* SECONDARY QUICK ACTION CARDS */}
              <div className="secondary-cards-grid">
                <div className="secondary-mini-card" onClick={() => setActiveTab('complaints')}>
                  <div className="mini-card-head">
                    <h4>Maintenance Pipeline</h4>
                    <span style={{ 
                      fontSize: 11, 
                      background: activeComplaintsCount > 0 ? '#FEF3C7' : '#EEF3EE', 
                      color: activeComplaintsCount > 0 ? '#B45309' : '#587360', 
                      padding: '3px 9px', 
                      borderRadius: 9999, 
                      fontWeight: 600 
                    }}>
                      {complaintsLoading ? 'Syncing...' : activeComplaintsCount > 0 ? `${activeComplaintsCount} Active` : 'All Resolved'}
                    </span>
                  </div>
                  <p className="mini-card-sub">
                    {latestActiveComplaint 
                      ? `${latestActiveComplaint.department || 'Issue'}: ${latestActiveComplaint.description.slice(0, 48)}${latestActiveComplaint.description.length > 48 ? '...' : ''}` 
                      : 'Living space repairs & caretaker requests'}
                  </p>
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
          {activeTab === 'mess' && (() => {
            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const d = now.getDay();
            const todayItem = DAYS_ORDER[d === 0 ? 6 : d - 1];
            const todayKey = (todayItem && typeof todayItem === 'object' ? todayItem.key : todayItem) || 'monday';
            const isViewingToday = selectedDay === todayKey;

            const dayData = DEFAULT_MESS_SCHEDULE[selectedDay] || DEFAULT_MESS_SCHEDULE.monday || { meals: {} };
            const meals = dayData.meals || {};
            const mealsList = [
              { key: 'breakfast', slot: meals.breakfast, icon: '🍳', name: 'Breakfast', defaultTime: '07:00 – 09:15 AM' },
              { key: 'lunch', slot: meals.lunch, icon: '🍛', name: 'Lunch', defaultTime: '12:30 – 02:30 PM' },
              { key: 'snacks', slot: meals.snacks, icon: '☕', name: 'Evening Snacks', defaultTime: '05:45 – 07:30 PM' },
              { key: 'dinner', slot: meals.dinner, icon: '🍲', name: 'Dinner', defaultTime: '08:30 – 10:00 PM' },
            ];

            return (
              <div className="detailed-view-container">
                <div className="section-head" style={{ marginBottom: 16 }}>
                  <button 
                    onClick={() => setActiveTab('home')} 
                    style={{ background: 'none', border: 'none', color: '#728D7A', cursor: 'pointer', padding: 0, marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>←</span> Back to Sanctuary
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 6px', color: '#242523' }}>Weekly Dining Schedule</h2>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Official ITER campus meal timetable with verified portion standards and dietary tags.</p>
                    </div>
                    <button
                      onClick={() => navigate('/mess-menu')}
                      style={{ background: '#FAF8F4', border: '1px solid #E6E0D5', borderRadius: 9999, padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#575854', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <span>Full Matrix Table</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Day Selector Pills (Mon - Sun) */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 24, scrollbarWidth: 'none' }}>
                  {DAYS_ORDER.map((item) => {
                    const dayKey = typeof item === 'object' ? item.key : item;
                    const isSelected = selectedDay === dayKey;
                    const isToday = dayKey === todayKey;
                    const dayLabel = (typeof item === 'object' && item.label) || DEFAULT_MESS_SCHEDULE[dayKey]?.label || dayKey.toUpperCase();

                    return (
                      <button
                        key={dayKey}
                        onClick={() => setSelectedDay(dayKey)}
                        style={{
                          border: isSelected ? '1px solid #728D7A' : '1px solid #E6E0D5',
                          background: isSelected ? '#FFFFFF' : '#FAF8F4',
                          color: isSelected ? '#242523' : '#7D7F7A',
                          padding: '8px 18px',
                          borderRadius: 9999,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isToday && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#728D7A' }} />}
                        <span>{dayLabel}</span>
                        {isToday && <span style={{ fontSize: 10.5, color: '#587360', fontWeight: 700 }}>(Today)</span>}
                      </button>
                    );
                  })}
                </div>

                {/* 4 Real Meal Cards for the Selected Day */}
                <div className="dining-schedule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                  {mealsList.map(({ key, slot, icon, name, defaultTime }) => {
                    const startMins = (slot?.startHour ?? 0) * 60 + (slot?.startMinute ?? 0);
                    const endMins = (slot?.endHour ?? 24) * 60 + (slot?.endMinute ?? 0);

                    let statusBadge = null;
                    if (isViewingToday) {
                      if (currentMins >= startMins && currentMins <= endMins) {
                        statusBadge = <span style={{ background: '#728D7A', color: 'white', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>● LIVE NOW</span>;
                      } else if (currentMins > endMins) {
                        statusBadge = <span style={{ background: '#EAE5DB', color: '#7D7F7A', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>Finished</span>;
                      } else {
                        statusBadge = <span style={{ background: '#EEF3EE', color: '#587360', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>Upcoming</span>;
                      }
                    } else {
                      statusBadge = <span style={{ background: '#FAF8F4', color: '#7D7F7A', padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>{slot?.timing || defaultTime}</span>;
                    }

                    const items = slot?.items || [];
                    const mainDish = items[0] || name;
                    const otherItems = items.slice(1).join(', ');

                    return (
                      <div 
                        key={key} 
                        className="meal-slot-card"
                        style={{
                          background: '#FFFFFF',
                          borderRadius: 20,
                          padding: 24,
                          border: isViewingToday && currentMins >= startMins && currentMins <= endMins ? '2px solid #728D7A' : '1px solid #E6E0D5',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#242523', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{icon}</span> {name}
                            </span>
                            {statusBadge}
                          </div>
                          <div style={{ fontSize: 12, color: '#7D7F7A', marginBottom: 10 }}>{slot?.timing || defaultTime}</div>

                          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#242523', margin: '0 0 8px', lineHeight: 1.3 }}>
                            {mainDish}
                          </h3>

                          {otherItems && (
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                              {otherItems}
                            </p>
                          )}

                          {/* Non-Veg & Veg Dietary Options / Choices */}
                          {slot?.options && slot.options.length > 0 && (
                            <div style={{ marginTop: 10, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7D7F7A', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span>⚡</span>
                                <span>Choice / Special Option:</span>
                              </div>
                              {slot.options.map((opt, idx) => {
                                const isNonVeg = opt.type === 'nonveg' || opt.type === 'egg';
                                const icon = opt.type === 'nonveg' ? '🍗' : (opt.type === 'egg' ? '🥚' : '🥦');
                                return (
                                  <div 
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      borderRadius: 10,
                                      background: isNonVeg ? '#FFF5F2' : '#F4F7F4',
                                      border: isNonVeg ? '1px solid #FCDAD1' : '1px solid #E1EBE2',
                                      fontSize: 12.5,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 13 }}>{icon}</span>
                                      <span style={{ fontWeight: 600, color: isNonVeg ? '#B85D43' : '#3E6649' }}>
                                        {opt.name}
                                      </span>
                                    </div>
                                    {opt.portion && (
                                      <span style={{ fontSize: 11, color: isNonVeg ? '#A3533D' : '#587360', background: '#FFFFFF', padding: '2px 7px', borderRadius: 9999, border: '1px solid rgba(0,0,0,0.06)', fontWeight: 600 }}>
                                        {opt.portion}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F0ECE4', paddingTop: 12, marginTop: 12, fontSize: 12 }}>
                          <span style={{ color: slot?.dietary === 'veg' ? '#587360' : '#C9826D', fontWeight: 600 }}>
                            {slot?.dietary === 'veg' ? '🌱 100% Pure Veg' : '🐟 Veg / Non-Veg'}
                          </span>
                          <span style={{ color: '#8E8F8A' }}>Standard ITER Mess</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 16px', color: '#272824' }}>{displayRoom}</h3>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2>Maintenance Pipeline</h2>
                    <p>Transparent tracking for hostel living space repairs and caretaker requests.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={fetchComplaints}
                      disabled={complaintsLoading}
                      title="Refresh complaints"
                      style={{ background: '#FAF8F5', color: '#587360', border: '1px solid #E6E0D5', padding: '10px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: complaintsLoading ? 'not-allowed' : 'pointer' }}
                    >
                      {complaintsLoading ? '↻ Refreshing...' : '↻ Refresh'}
                    </button>
                    <button
                      onClick={() => { setComplaintSubmitted(false); setShowComplaintModal(true); }}
                      style={{ background: '#728D7A', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 9999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(114, 141, 122, 0.25)' }}
                    >
                      + File New Request
                    </button>
                  </div>
                </div>
              </div>

              {/* Complaints List or Empty State */}
              {complaintsLoading && realComplaints.length === 0 ? (
                <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '48px 32px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #E6E0D5', borderTopColor: '#728D7A', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Syncing live living space tickets from server...</p>
                </div>
              ) : realComplaints.length === 0 ? (
                <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '48px 32px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#EEF3EE', color: '#587360', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>
                    ✓
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#272824', margin: '0 0 8px' }}>
                    All Clear in Living Space
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 460, margin: '0 auto 24px', lineHeight: 1.5 }}>
                    You have no active maintenance complaints on record. Everything in {displayRoom} is in running order! If you need any electrical, plumbing, or room repair, lodge a request below.
                  </p>
                  <button
                    onClick={() => { setComplaintSubmitted(false); setShowComplaintModal(true); }}
                    style={{ background: '#728D7A', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(114, 141, 122, 0.2)' }}
                  >
                    + Lodge First Request
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {realComplaints.map((item) => {
                    const normStatus = normalizeStatus(item.status);
                    const ticketNum = item.ticketNumber || (item._id ? `#HC-${String(item._id).slice(-4).toUpperCase()}` : '#HC-TICKET');
                    const filedDate = item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    }) : 'Recently logged';
                    const deptIcon = DEPT_ICONS[item.department] || '🔧';
                    const caretakerAssigned = item.assignedCaretaker || item.caretaker || (normStatus !== 'pending' ? 'Hostel Caretaker' : null);

                    return (
                      <div key={item._id || ticketNum} style={{ background: '#FFFFFF', borderRadius: 24, padding: 32, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 11, background: '#FAF8F5', border: '1px solid #E6E0D5', color: '#555', padding: '3px 10px', borderRadius: 9999, fontWeight: 700 }}>
                                {ticketNum}
                              </span>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#728D7A' }}>
                                {deptIcon} {item.department || 'Maintenance'}
                              </span>
                            </div>
                            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 21, margin: '4px 0 6px', color: '#272824' }}>
                              {item.description}
                            </h3>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                              Filed: {filedDate} • Location: {item.hostelNo || displayRoom}{item.roomNo ? ` (Rm ${item.roomNo})` : ''}
                            </p>
                          </div>
                          
                          <span 
                            style={{ 
                              padding: '6px 14px', 
                              borderRadius: 9999, 
                              fontSize: 12, 
                              fontWeight: 700, 
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              background: normStatus === 'resolved' ? '#EEF3EE' : normStatus === 'inprogress' ? '#E0F2FE' : '#FEF3C7',
                              color: normStatus === 'resolved' ? '#587360' : normStatus === 'inprogress' ? '#0369A1' : '#B45309',
                            }}
                          >
                            {normStatus === 'resolved' ? '✓ Resolved & Closed' : normStatus === 'inprogress' ? '● In Progress' : '⏳ Pending Review'}
                          </span>
                        </div>

                        {/* 3-Stage Stepper */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 16px', background: '#FAF8F5', padding: '16px 20px', borderRadius: 16, overflowX: 'auto' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#587360', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#587360', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
                            1. Registered
                          </div>
                          
                          <div style={{ flex: 1, minWidth: 24, height: 2, background: normStatus !== 'pending' ? '#728D7A' : '#E6E0D5' }} />
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: normStatus !== 'pending' ? '#587360' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: normStatus !== 'pending' ? '#587360' : '#E6E0D5', color: normStatus !== 'pending' ? 'white' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                              {normStatus === 'resolved' ? '✓' : '2'}
                            </span>
                            2. {caretakerAssigned ? `Caretaker Assigned (${caretakerAssigned})` : 'Caretaker Assignment'}
                          </div>

                          <div style={{ flex: 1, minWidth: 24, height: 2, background: normStatus === 'resolved' ? '#728D7A' : '#E6E0D5' }} />

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: normStatus === 'resolved' ? '#587360' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: normStatus === 'resolved' ? '#587360' : '#E6E0D5', color: normStatus === 'resolved' ? 'white' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                              {normStatus === 'resolved' ? '✓' : '3'}
                            </span>
                            3. Resolved & Verified
                          </div>
                        </div>

                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                          {normStatus === 'resolved'
                            ? '✓ This living space maintenance request has been resolved and verified by hostel staff.'
                            : normStatus === 'inprogress'
                            ? 'Caretaker is attending to this request. Estimated resolution window: Within 24 hours.'
                            : 'Your ticket has been logged into the queue. A caretaker will be assigned shortly.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <strong style={{ fontSize: 16, color: '#272824', display: 'block' }}>{displayName} • {displayRoom}</strong>
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
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEF3EE', color: '#587360', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>✓</div>
                <h4 style={{ margin: '0 0 6px', fontSize: 20, fontFamily: 'var(--font-serif)', color: '#272824' }}>Request Lodged!</h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 24px' }}>Caretaker has been notified and ticket is registered in the live pipeline.</p>
                <button 
                  onClick={() => { setComplaintSubmitted(false); setShowComplaintModal(false); }}
                  style={{ background: '#728D7A', color: 'white', border: 'none', padding: '12px 32px', borderRadius: 9999, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(114, 141, 122, 0.2)' }}
                >
                  View in Pipeline →
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateComplaint}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#272824' }}>Category / Department</label>
                  <select 
                    value={newComplaintDept} 
                    onChange={(e) => setNewComplaintDept(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #D5E2D7', background: '#FAF8F5', fontSize: 14, outline: 'none' }}
                  >
                    <option value="Electrical">⚡ Electrical (Tube-light, Fan, Switchboard, AC)</option>
                    <option value="Plumbing">🚰 Plumbing (Tap, Flush, Leakage, Geyser)</option>
                    <option value="Carpentry">🔨 Carpentry (Bed, Study Table, Door Lock, Almirah)</option>
                    <option value="Civil">🧱 Civil (Wall Seepage, Tile, Window Glass)</option>
                    <option value="Mess">🍲 Mess (Food Quality, Hygiene, Dining Hall)</option>
                    <option value="Other">🔧 Other Maintenance</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#272824' }}>Description</label>
                  <textarea 
                    rows={4} 
                    value={newComplaintDesc}
                    onChange={(e) => setNewComplaintDesc(e.target.value)}
                    placeholder="Describe the issue in detail (e.g. Study table tube-light is flickering and needs replacement)..." 
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #D5E2D7', background: '#FAF8F5', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} 
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                    Logged for: <strong>{displayName}</strong> • <strong>{displayRoom}</strong>
                  </span>
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmittingComplaint}
                  style={{ width: '100%', background: isSubmittingComplaint ? '#9AB1A1' : '#728D7A', color: 'white', border: 'none', padding: '13px', borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: isSubmittingComplaint ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(114, 141, 122, 0.2)' }}
                >
                  {isSubmittingComplaint ? 'Submitting to Caretaker...' : 'Submit Request →'}
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

