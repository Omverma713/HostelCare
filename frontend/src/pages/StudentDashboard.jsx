import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

import ResolutionRingGauge3D from '../components/ResolutionRingGauge3D';
import SpatialTicketCard from '../components/SpatialTicketCard';
import { appUpdateService } from '../services/appUpdateService';

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
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View switch: 'cards' | 'table'
  const [viewMode, setViewMode] = useState('cards');

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'inprogress' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('');

  // New complaint form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Detail modal state
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const [refreshing, setRefreshing] = useState(false);

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
      triggerToast('info', 'Dashboard data & app status refreshed!', 'Refreshed');
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


  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!department) {
      triggerToast('error', 'Please select a department.');
      return;
    }
    if (!description || description.trim().length < 4) {
      triggerToast('error', 'Please provide a brief description of the issue.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await api.createComplaint(department, description.trim());
      if (res.success) {
        triggerToast('success', 'Complaint registered successfully!');
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
    <div className="spatial-dashboard-root">
      {/* Dynamic Cosmic Background Glow Accents */}
      <div className="cosmic-glow-orb orb-indigo" />
      <div className="cosmic-glow-orb orb-emerald" />
      <div className="cosmic-glow-orb orb-cyan" />

      {/* Spatial Top Hero Bar */}
      <header className="spatial-command-header">
        <div className="command-header-left">
          <div className="spatial-badge-cluster">
            <span className="spatial-live-chip">
              <span className="live-ping-beacon" /> SPATIAL COMMAND v3.0
            </span>
            <span className="spatial-hostel-tag-chip">
              🏢 {user?.hostel || 'Hostel BH-1'} • Room {user?.roomNumber || '302-B'}
            </span>
          </div>

          <h1 className="spatial-deck-title">
            Welcome, <span className="text-gradient-cosmic">{user?.name || 'Rahul Sharma'}</span>
          </h1>
          <p className="spatial-deck-subtitle">
            Real-time digital twin maintenance telemetry & instant student dispatch console.
          </p>
        </div>

        <div className="command-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-spatial-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            id="btn-refresh-dashboard"
            title="Refresh dashboard & check for updates"
            style={{
              padding: '0.65rem 1.1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: refreshing ? 'rotate(360deg)' : 'none',
                transition: refreshing ? 'transform 0.7s linear infinite' : 'none',
                animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
                fontSize: '1rem',
              }}
            >
              🔄
            </span>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            className="btn-spatial-primary-trigger"
            onClick={() => {
              setDepartment('');
              setIsCreateOpen(true);
            }}
            id="btn-file-complaint-spatial"
          >
            <span className="btn-trigger-glow" />
            <span className="btn-trigger-icon">➕</span>
            <span className="btn-trigger-label">File New Complaint</span>
          </button>
        </div>
      </header>

      {/* Stats & Gauge Section */}
      <section className="bento-analytics-col">
        {/* Holographic Circular Resolution Ring Gauge */}
        <ResolutionRingGauge3D
          total={counts.all}
          pending={counts.pending}
          inProgress={counts.inprogress}
          resolved={counts.resolved}
        />

        {/* Quick Metrics Quad Pod */}
        <div className="spatial-quick-quad">
          <div className="quick-quad-card card-total">
            <div className="quad-icon-wrap">📁</div>
            <div className="quad-info">
              <span className="quad-num">{counts.all}</span>
              <span className="quad-lbl">Total Logs</span>
            </div>
          </div>

          <div className="quick-quad-card card-pending">
            <div className="quad-icon-wrap">⏳</div>
            <div className="quad-info">
              <span className="quad-num">{counts.pending}</span>
              <span className="quad-lbl">Pending</span>
            </div>
          </div>

          <div className="quick-quad-card card-progress">
            <div className="quad-icon-wrap">⚙️</div>
            <div className="quad-info">
              <span className="quad-num">{counts.inprogress}</span>
              <span className="quad-lbl">In Progress</span>
            </div>
          </div>

          <div className="quick-quad-card card-resolved">
            <div className="quad-icon-wrap">✅</div>
            <div className="quad-info">
              <span className="quad-num">{counts.resolved}</span>
              <span className="quad-lbl">Resolved</span>
            </div>
          </div>
        </div>
      </section>

      {/* Spatial Complaint Feed & Dispatch Console */}
      <section className="spatial-tickets-deck">
        <div className="tickets-deck-topbar">
          <div className="tickets-deck-heading">
            <h2 className="tickets-deck-title">
              <span className="title-icon-spatial">📋</span> Maintenance Tickets
            </h2>
            <div className="deck-heading-actions">
              <span className="tickets-count-pill">{filteredComplaints.length} tickets</span>
              {/* Sleek View Mode Switcher */}
              <div className="spatial-view-switcher">
                <button
                  type="button"
                  className={`view-switch-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Cards View"
                >
                  <span className="view-switch-icon">🗂️</span>
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <span className="view-switch-icon">📊</span>
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Controls: Modern Segmented Filter (NO horizontal scroller) + Search Bar */}
          <div className="tickets-controls-bar">
            {/* 4-Column Modern Segmented Status Tabs */}
            <div className="spatial-segmented-control">
              <button
                type="button"
                className={`segmented-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <span className="tab-text">All</span>
                <span className="tab-badge">{counts.all}</span>
              </button>
              <button
                type="button"
                className={`segmented-tab-btn tab-amber ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                <span className="tab-text">Pending</span>
                <span className="tab-badge">{counts.pending}</span>
              </button>
              <button
                type="button"
                className={`segmented-tab-btn tab-blue ${statusFilter === 'inprogress' ? 'active' : ''}`}
                onClick={() => setStatusFilter('inprogress')}
              >
                <span className="tab-text">In Progress</span>
                <span className="tab-badge">{counts.inprogress}</span>
              </button>
              <button
                type="button"
                className={`segmented-tab-btn tab-green ${statusFilter === 'resolved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('resolved')}
              >
                <span className="tab-text">Resolved</span>
                <span className="tab-badge">{counts.resolved}</span>
              </button>
            </div>

            {/* Live Search Input */}
            <div className="spatial-search-box">
              <span className="search-icon-spatial">🔍</span>
              <input
                type="text"
                className="search-field-spatial"
                placeholder="Search ticket description…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-reset-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Render: Cards View OR Table View */}
        <EmptyState
          loading={loading}
          error={error}
          onRetry={fetchComplaints}
          emptyIcon="📦"
          emptyTitle="No tickets found"
          emptyMessage="No maintenance complaints match your selected filters."
        >
          {filteredComplaints.length === 0 ? (
            <div className="spatial-empty-box">
              <div className="empty-floating-icon">📦</div>
              <h3 className="empty-title">
                {complaints.length === 0
                  ? 'No issues reported in your room yet'
                  : 'No tickets match the active filter'}
              </h3>
              <p className="empty-sub">
                {complaints.length === 0
                  ? 'Facing any electrical, water, or carpentry problems? Click a 3D pin above or use File New Complaint.'
                  : 'Try adjusting your search keywords or switching status filters.'}
              </p>
              <div className="empty-actions-row">
                {complaints.length === 0 ? (
                  <button
                    className="btn-spatial-primary-trigger mt-4"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    ➕ File Your First Ticket
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-spatial-secondary-action"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    📋 View All Complaints ({complaints.length})
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'cards' ? (
            /* --- 1. SPATIAL 3D CARDS GRID VIEW --- */
            <div className="spatial-cards-wrapper">
              <div className="spatial-cards-grid">
                {filteredComplaints.map((c) => (
                  <SpatialTicketCard
                    key={c._id}
                    complaint={c}
                    onSelect={setSelectedComplaint}
                    getDeptIcon={getDeptIcon}
                  />
                ))}
              </div>

              {/* View All Complaints Action */}
              {statusFilter !== 'all' && (
                <div className="view-all-deck-footer">
                  <button
                    type="button"
                    className="btn-view-all-subtle"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    📋 View All Complaints ({complaints.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* --- 2. HIGH-DENSITY COMPACT TABLE VIEW (No Horizontal Scroll on Mobile) --- */
            <div className="table-wrapper-spatial">
              <div className="table-container-spatial">
                <table className="custom-table-spatial" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="col-cat">Category</th>
                      <th className="col-desc">Description</th>
                      <th className="col-date">Date</th>
                      <th className="col-status" style={{ textAlign: 'center' }}>Status</th>
                      <th className="col-actions" style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComplaints.map((c) => (
                      <tr key={c._id} className="table-row-spatial">
                        <td className="col-cat">
                          <div className="cat-cell-spatial">
                            <span className="cat-emoji-bubble">{getDeptIcon(c.department)}</span>
                            <div className="cat-info-block">
                              <span className="cat-name-bold">{c.department}</span>
                              <span className="cat-desc-mobile-snippet">{c.description}</span>
                            </div>
                          </div>
                        </td>
                        <td className="col-desc" title={c.description}>
                          <div className="desc-truncate-spatial">{c.description}</div>
                        </td>
                        <td className="col-date">
                          <span className="date-pill-spatial">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}
                          </span>
                        </td>
                        <td className="col-status" style={{ textAlign: 'center' }}>
                          <Badge status={c.status} />
                        </td>
                        <td className="col-actions" style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-view-spatial"
                            onClick={() => setSelectedComplaint(c)}
                          >
                            <span>View</span>
                            <span className="btn-view-arrow">→</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </EmptyState>
      </section>

      {/* Modal: File New Complaint */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="File Maintenance Complaint"
      >
        <form onSubmit={handleCreateSubmit} className="modal-form-3d">
          {/* Target Location Banner */}
          <div className="form-location-banner">
            <span className="location-pin-icon">📍</span>
            <div className="location-info">
              <span className="location-label">DISPATCH LOCATION</span>
              <span className="location-value">
                {user?.hostel || 'Hostel BH-1'} • Room {user?.roomNumber || '302'}
              </span>
            </div>
            <span className="location-verified-pill">Auto-Linked</span>
          </div>

          {/* Modern Interactive Category Grid */}
          <div className="form-group-category">
            <div className="category-section-header">
              <label className="form-label mb-0">Select Issue Category</label>
              <span className="category-selected-tag">
                {department ? `${getDeptIcon(department)} ${department}` : 'Tap category below'}
              </span>
            </div>

            <div className="spatial-category-grid" role="radiogroup" aria-label="Issue category">
              {DEPARTMENTS.map((d) => {
                const isSelected = department === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`category-tile-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => setDepartment(d)}
                    disabled={submitLoading}
                  >
                    <span className="cat-tile-icon-bubble">{getDeptIcon(d)}</span>
                    <span className="cat-tile-label">{d}</span>
                    {isSelected && <span className="cat-tile-glow-indicator">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Description */}
          <div className="form-group">
            <div className="description-section-header">
              <label className="form-label mb-0" htmlFor="compDesc">
                Issue Description
              </label>
              <span className="desc-char-hint">
                {description.length > 0 ? `${description.length} chars` : 'Min 4 chars'}
              </span>
            </div>
            <textarea
              id="compDesc"
              className="form-input form-textarea-3d"
              placeholder="Describe the issue in detail (e.g. Ceiling fan regulator not functioning, water tap leaking, etc.)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitLoading}
              rows={3}
              required
            />
          </div>

          <div className="modal-footer-cluster">
            <button
              type="button"
              className="btn btn-secondary btn-glass"
              onClick={() => setIsCreateOpen(false)}
              disabled={submitLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-submit-3d"
              disabled={submitLoading || !department || description.trim().length < 4}
            >
              {submitLoading ? (
                <HostelCareLoader size="sm" inline message="Filing…" />
              ) : (
                '🚀 Submit Complaint'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Complaint Details Timeline (Ultra-Modern Bento View) */}
      <Modal
        isOpen={!!selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        title="Ticket Inspection Console"
      >
        {selectedComplaint && (
          <div className="complaint-detail-bento-view">
            {/* Top Category Header Banner */}
            <div className="bento-modal-hero">
              <div className="bento-hero-left">
                <div className="bento-icon-disc">
                  {getDeptIcon(selectedComplaint.department)}
                </div>
                <div className="bento-hero-text">
                  <span className="bento-category-tag">CATEGORY</span>
                  <h3 className="bento-hero-title">{selectedComplaint.department}</h3>
                  <span className="bento-room-tag">
                    🏢 {selectedComplaint.hostelNo || user?.hostel || 'Hostel BH-1'} • 🚪 Room {selectedComplaint.roomNo || user?.roomNumber || '302'}
                  </span>
                </div>
              </div>
              <div className="bento-hero-right">
                <Badge status={selectedComplaint.status} />
              </div>
            </div>

            {/* Description Glass Box */}
            <div className="bento-desc-card">
              <div className="bento-desc-header">
                <span className="bento-card-label">ISSUE DESCRIPTION</span>
                <span className="bento-desc-icon">💬</span>
              </div>
              <p className="bento-desc-content">
                {selectedComplaint.description}
              </p>
            </div>

            {/* Metadata 2x2 Bento Quad */}
            <div className="bento-meta-quad">
              <div className="bento-meta-item">
                <span className="bento-meta-icon">🏢</span>
                <div className="bento-meta-text">
                  <span className="bento-meta-lbl">HOSTEL</span>
                  <span className="bento-meta-val">{selectedComplaint.hostelNo || user?.hostel || 'Hostel BH-1'}</span>
                </div>
              </div>

              <div className="bento-meta-item">
                <span className="bento-meta-icon">🚪</span>
                <div className="bento-meta-text">
                  <span className="bento-meta-lbl">ROOM NO</span>
                  <span className="bento-meta-val">Room {selectedComplaint.roomNo || user?.roomNumber || '302'}</span>
                </div>
              </div>

              <div className="bento-meta-item">
                <span className="bento-meta-icon">🕒</span>
                <div className="bento-meta-text">
                  <span className="bento-meta-lbl">LOGGED DATE</span>
                  <span className="bento-meta-val">
                    {selectedComplaint.createdAt ? new Date(selectedComplaint.createdAt).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
              </div>

              <div className="bento-meta-item">
                <span className="bento-meta-icon">⏰</span>
                <div className="bento-meta-text">
                  <span className="bento-meta-lbl">LOGGED TIME</span>
                  <span className="bento-meta-val">
                    {selectedComplaint.createdAt ? new Date(selectedComplaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Timeline History Box */}
            <div className="bento-timeline-card">
              <div className="bento-timeline-header">
                <span className="bento-card-label">ACTION TIMELINE & UPDATES</span>
                <span className="bento-timeline-icon">⚡</span>
              </div>
              <ActionHistory actions={selectedComplaint.actions} />
            </div>

            {/* Modal Footer Actions */}
            <div className="bento-modal-footer">
              <button
                type="button"
                className="btn-bento-close"
                onClick={() => setSelectedComplaint(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
