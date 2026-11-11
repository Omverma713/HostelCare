import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { DEPARTMENTS } from '../constants';
import { normalizeStatus, sortByDateDesc, isEmptyDataError } from '../utils/status';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ActionHistory from '../components/ActionHistory';
import EmptyState from '../components/EmptyState';
import HostelCareLoader from '../components/HostelCareLoader';
import { triggerToast } from '../components/Toast';
import { appUpdateService } from '../services/appUpdateService';
import { getKolkataTime, getMealStatusForDay, DEFAULT_MESS_DATA } from '../constants/messMenuData';
import CbtModal from '../components/CbtModal';

// Department icon helper
const getDeptIcon = (dept) => {
  const d = (dept || '').toLowerCase();
  if (d.includes('elect')) return '⚡';
  if (d.includes('plumb')) return '🔧';
  if (d.includes('carp')) return '🪑';
  if (d.includes('water')) return '🚰';
  if (d.includes('civil')) return '🧱';
  if (d.includes('clean') || d.includes('sanit')) return '🧹';
  if (d.includes('mess') || d.includes('food')) return '🍲';
  return '📦';
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'inprogress' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isCbtOpen, setIsCbtOpen] = useState(false);

  // New complaint form state
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(() => appUpdateService.getState().updateAvailable);
  const [latestVersion, setLatestVersion] = useState(() => appUpdateService.getState().latestVersion);

  useEffect(() => {
    const unsub = appUpdateService.addListener((state) => {
      setUpdateAvailable(Boolean(state.updateAvailable));
      if (state.latestVersion) {
        setLatestVersion(state.latestVersion);
      }
    });
    return unsub;
  }, []);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStudentComplaints();
      if (res.success && res.complaints) {
        setComplaints(sortByDateDesc(res.complaints));
      }
    } catch (err) {
      if (isEmptyDataError(err)) {
        setComplaints([]);
      } else {
        setError(err.message || 'Failed to load complaints.');
        triggerToast('error', err.message || 'Failed to load complaints.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchComplaints(),
        appUpdateService.checkForUpdates({ manual: true }),
      ]);
      triggerToast('info', 'Dashboard refreshed!', 'Refreshed');
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchComplaints();
    const handleGlobalRefresh = () => fetchComplaints();
    window.addEventListener('app-refresh', handleGlobalRefresh);
    return () => window.removeEventListener('app-refresh', handleGlobalRefresh);
  }, [fetchComplaints]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: complaints.length,
      pending: complaints.filter((c) => normalizeStatus(c.status) === 'pending').length,
      inprogress: complaints.filter((c) => normalizeStatus(c.status) === 'inprogress').length,
      resolved: complaints.filter((c) => normalizeStatus(c.status) === 'resolved').length,
    };
  }, [complaints]);

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesStatus =
        statusFilter === 'all' || normalizeStatus(c.status) === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (c.department && c.department.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [complaints, statusFilter, searchQuery]);

  // Real-time Mess Schedule Telemetry for Dashboard
  const kolkataTime = useMemo(() => getKolkataTime(), []);
  const todayDaySchedule = useMemo(() => {
    const sched = DEFAULT_MESS_DATA.schedule || {};
    return sched[kolkataTime.dayOfWeek] || sched.monday;
  }, [kolkataTime]);
  const messStatus = useMemo(() => {
    return getMealStatusForDay(todayDaySchedule?.meals, kolkataTime);
  }, [todayDaySchedule, kolkataTime]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!department) {
      triggerToast('error', 'Please select a department.');
      return;
    }
    if (!description || description.trim().length < 4) {
      triggerToast('error', 'Please describe the issue.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await api.createComplaint(department, description.trim());
      if (res.success) {
        triggerToast('success', 'Complaint registered successfully! Caretaker notified.');
        setIsCreateOpen(false);
        setDepartment('');
        setDescription('');
        fetchComplaints();
      } else {
        triggerToast('error', res.message || 'Failed to file complaint.');
      }
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Failed to file complaint.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="linen-sanctuary-root" style={{ minHeight: '100vh', background: 'var(--bg-primary, #F6F3EC)', padding: '24px 28px 80px', maxWidth: '1180px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* 1. TOP SANCTUARY HEADER ROW */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #8E8F8A)' }}>
              Resident Sanctuary • Living Overview
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '9999px', background: '#F9EBE6', color: '#9C5B49', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C07660' }} />
              Active
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '2.2rem', fontWeight: 600, color: 'var(--text-primary, #242523)', margin: 0 }}>
            Welcome, {user?.name || 'Resident'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.95rem', color: 'var(--text-secondary, #575854)' }}>
            Calm, un-cluttered living space management portal for {user?.roomNumber ? `room ${user.roomNumber}` : 'your hostel residence'}{user?.hostel ? ` (${user.hostel})` : ''}.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {updateAvailable && (
            <button
              type="button"
              onClick={() => appUpdateService.checkForUpdates({ manual: true })}
              style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '8px 16px', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Update v{latestVersion}
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ background: '#FFFFFF', border: '1px solid #E6E0D5', color: '#575854', padding: '8px 16px', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s linear infinite' }}>🔄</span>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => {
              setDepartment('');
              setIsCreateOpen(true);
            }}
            style={{ background: 'var(--primary, #C07660)', color: '#FFFFFF', border: 'none', padding: '9px 20px', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(192, 118, 96, 0.28)' }}
          >
            + File New Request
          </button>
        </div>
      </header>

      {/* 2. THE TWO EXACT WARM LINEN HERO CARDS */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginBottom: '32px' }}>
        {/* Card 1: Today's Meal */}
        <Link 
          to="/mess-menu"
          style={{
            textDecoration: 'none',
            background: '#FFFFFF',
            borderRadius: '26px',
            padding: '30px 40px',
            border: '1px solid #E6E0D5',
            boxShadow: '0 6px 24px rgba(105, 93, 76, 0.04)',
            display: 'block',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'rgba(192, 118, 96, 0.5)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(105, 93, 76, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#E6E0D5';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(105, 93, 76, 0.04)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '2rem', fontWeight: 500, color: '#242523', margin: 0 }}>
              Today's Meal
            </h2>
            <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#C07660', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(192, 118, 96, 0.32)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
              </svg>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, color: '#3C3E3A' }}>
              {messStatus.activeSlot
                ? `${messStatus.activeSlot.name} is being served • ${messStatus.activeSlot.timing}`
                : `Next Meal: ${messStatus.nextSlot?.name || 'Breakfast'} • ${messStatus.nextSlot?.timing || '07:00 AM'}`}
            </p>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#8E8F8A' }}>
              Menu: {todayDaySchedule.meals?.lunch?.items?.slice(0, 3).join(', ') || 'Freshly prepared hot campus meal'}
            </p>
          </div>
        </Link>

        {/* Card 2: My Living Space */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '26px',
            padding: '30px 40px',
            border: '1px solid #E6E0D5',
            boxShadow: '0 6px 24px rgba(105, 93, 76, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '2rem', fontWeight: 500, color: '#242523', margin: '0 0 6px 0' }}>
              My Living Space
            </h2>
            <p style={{ margin: 0, fontSize: '1.05rem', color: '#575854' }}>
              {user?.roomNumber ? `Room ${user.roomNumber}` : 'Hostel Living Space'}{user?.hostel ? `, ${user.hostel}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              style={{ background: '#FAF8F5', border: '1px solid #E6E0D5', color: '#575854', padding: '9px 18px', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Gate Pass QR 🎫
            </button>
            <span 
              style={{ 
                background: counts.inprogress > 0 ? '#FEF3C7' : '#C07660',
                color: counts.inprogress > 0 ? '#B45309' : '#FFFFFF',
                padding: '10px 24px', 
                borderRadius: '9999px', 
                fontSize: '0.9rem', 
                fontWeight: 600,
                boxShadow: counts.inprogress > 0 ? 'none' : '0 3px 12px rgba(192, 118, 96, 0.25)'
              }}
            >
              {counts.inprogress > 0 ? `${counts.inprogress} in progress` : 'Everything in order'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. SECONDARY ACTION CARDS (Chat & Maintenance) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        <div 
          onClick={() => navigate('/chat')}
          style={{ background: '#FFFFFF', borderRadius: '22px', padding: '24px 28px', border: '1px solid #E6E0D5', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(192, 118, 96, 0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E6E0D5'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.25rem', margin: 0, color: '#242523' }}>Support Chat (E2EE)</h3>
            <span style={{ fontSize: '0.72rem', background: '#F9EBE6', color: '#9C5B49', padding: '3px 9px', borderRadius: '9999px', fontWeight: 600 }}>Secured</span>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#8E8F8A' }}>
            Direct encrypted messaging line with Caretakers, Wardens & Administration.
          </p>
          <span style={{ fontSize: '0.875rem', color: '#C07660', fontWeight: 600 }}>Open Messages →</span>
        </div>

        <div 
          onClick={() => {
            setDepartment('');
            setIsCreateOpen(true);
          }}
          style={{ background: '#FFFFFF', borderRadius: '22px', padding: '24px 28px', border: '1px solid #E6E0D5', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', transition: 'all 0.2s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(192, 118, 96, 0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E6E0D5'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.25rem', margin: 0, color: '#242523' }}>Quick Caretaker Dispatch</h3>
            <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#B45309', padding: '3px 9px', borderRadius: '9999px', fontWeight: 600 }}>1-Tap Filing</span>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#8E8F8A' }}>
            Report electrical, plumbing, carpentry, or clean repairs with automatic technician assignment.
          </p>
          <span style={{ fontSize: '0.875rem', color: '#C07660', fontWeight: 600 }}>+ Lodge Request →</span>
        </div>
      </div>

      {/* 4. COMPLAINTS PIPELINE SECTION */}
      <section style={{ background: '#FFFFFF', borderRadius: '28px', padding: '32px 36px', border: '1px solid #E6E0D5', boxShadow: '0 6px 24px rgba(105, 93, 76, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.65rem', fontWeight: 600, color: '#242523', margin: '0 0 4px 0' }}>
              Maintenance Pipeline
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#8E8F8A' }}>
              Track real-time progress for your hostel living space requests.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {['all', 'pending', 'inprogress', 'resolved'].map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setStatusFilter(filterKey)}
                style={{
                  background: statusFilter === filterKey ? '#C07660' : '#FAF8F5',
                  color: statusFilter === filterKey ? '#FFFFFF' : '#575854',
                  border: statusFilter === filterKey ? 'none' : '1px solid #E6E0D5',
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  boxShadow: statusFilter === filterKey ? '0 2px 8px rgba(192, 118, 96, 0.28)' : 'none',
                }}
              >
                {filterKey === 'inprogress' ? 'In Progress' : filterKey} ({counts[filterKey]})
              </button>
            ))}
          </div>
        </div>

        {/* Complaints List */}
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <HostelCareLoader size="medium" />
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🌱</div>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.25rem', color: '#242523', margin: '0 0 6px 0' }}>No requests in this view</h3>
            <p style={{ fontSize: '0.9rem', color: '#8E8F8A', margin: 0 }}>Everything in your room is in peaceful order.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {filteredComplaints.map((item) => {
              const normStatus = normalizeStatus(item.status);
              return (
                <div
                  key={item._id}
                  style={{
                    background: '#FAF8F5',
                    borderRadius: '20px',
                    padding: '24px 28px',
                    border: '1px solid #EAE5DB',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid #E6E0D5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem' }}>
                        {getDeptIcon(item.department)}
                      </span>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8E8F8A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          TICKET #{String(item._id).slice(-4).toUpperCase()} • {item.department}
                        </span>
                        <h4 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 600, color: '#242523' }}>
                          {item.description}
                        </h4>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: normStatus === 'resolved' ? '#F9EBE6' : normStatus === 'inprogress' ? '#E0F2FE' : '#FEF3C7',
                        color: normStatus === 'resolved' ? '#9C5B49' : normStatus === 'inprogress' ? '#0369A1' : '#B45309',
                      }}
                    >
                      {normStatus}
                    </span>
                  </div>

                  {/* 3-Stage Visual Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', padding: '12px 18px', borderRadius: '14px', border: '1px solid #EAE5DB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#9C5B49' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#9C5B49', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>✓</span>
                      1. Registered
                    </div>
                    <div style={{ flex: 1, height: 2, background: normStatus !== 'pending' ? '#C07660' : '#E6E0D5' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: normStatus !== 'pending' ? '#9C5B49' : '#8E8F8A' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: normStatus !== 'pending' ? '#9C5B49' : '#E6E0D5', color: normStatus !== 'pending' ? 'white' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                        {normStatus === 'resolved' ? '✓' : '2'}
                      </span>
                      2. Caretaker Assigned
                    </div>
                    <div style={{ flex: 1, height: 2, background: normStatus === 'resolved' ? '#C07660' : '#E6E0D5' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: normStatus === 'resolved' ? '#9C5B49' : '#8E8F8A' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: normStatus === 'resolved' ? '#9C5B49' : '#E6E0D5', color: normStatus === 'resolved' ? 'white' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                        {normStatus === 'resolved' ? '✓' : '3'}
                      </span>
                      3. Resolved
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. MODAL: DIGITAL GATE OUTING PASS */}
      {showQrModal && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(36, 37, 35, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setShowQrModal(false)}
        >
          <div 
            style={{ background: '#FFFFFF', borderRadius: '28px', padding: '36px 40px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.16)', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowQrModal(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#8E8F8A' }}
            >
              ×
            </button>
            <span style={{ fontSize: '0.72rem', background: '#F9EBE6', color: '#9C5B49', padding: '3px 10px', borderRadius: '9999px', fontWeight: 700, letterSpacing: '0.04em' }}>
              CAMPUS SECURITY GATE PASS
            </span>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.65rem', margin: '12px 0 6px', color: '#242523' }}>
              Digital Gate Clearance
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#575854' }}>
              Present this pass at Main Security Gate 1 for evening exit & re-entry.
            </p>

            <div style={{ background: '#FAF8F5', borderRadius: '20px', padding: '24px', textAlign: 'center', border: '1px dashed #F4D3C9' }}>
              <div style={{ width: 140, height: 140, margin: '0 auto 16px', background: '#242523', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '0.85rem' }}>
                [QR VERIFIED]
              </div>
              <strong style={{ fontSize: '1.1rem', color: '#242523', display: 'block' }}>
                {user?.name || 'Resident'}{user?.roomNumber ? ` • Room ${user.roomNumber}` : ''}{user?.hostel ? ` (${user.hostel})` : ''}
              </strong>
              <span style={{ fontSize: '0.82rem', color: '#8E8F8A', marginTop: '4px', display: 'block' }}>
                Reg: {user?.registrationNumber || '2021BCS001'} • Valid till 09:30 PM
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: CREATE COMPLAINT */}
      {isCreateOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(36, 37, 35, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setIsCreateOpen(false)}
        >
          <div 
            style={{ background: '#FFFFFF', borderRadius: '28px', padding: '36px 40px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.16)', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsCreateOpen(false)}
              style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#8E8F8A' }}
            >
              ×
            </button>
            <h3 style={{ fontFamily: "var(--font-serif, 'Playfair Display', serif)", fontSize: '1.75rem', margin: '0 0 8px', color: '#242523' }}>
              File Living Space Request
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#575854' }}>
              {user?.roomNumber ? `Room ${user.roomNumber}` : 'Living Space'}{user?.hostel ? ` (${user.hostel})` : ''}
            </p>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#242523', marginBottom: '6px' }}>
                  Category / Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid #E6E0D5', background: '#FAF8F5', color: '#242523', fontSize: '0.92rem', outline: 'none' }}
                >
                  <option value="">Select Category...</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#242523', marginBottom: '6px' }}>
                  Issue Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what needs repair..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E6E0D5', background: '#FAF8F5', color: '#242523', fontSize: '0.92rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                style={{ width: '100%', background: '#C07660', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, cursor: submitLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(192, 118, 96, 0.3)' }}
              >
                {submitLoading ? 'Registering Request...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CBT Modal */}
      {isCbtOpen && <CbtModal isOpen={isCbtOpen} onClose={() => setIsCbtOpen(false)} />}
    </div>
  );
}
