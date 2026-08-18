import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { normalizeStatus, isEmptyDataError } from '../utils/status';
import Badge from '../components/Badge';
import StatsGrid from '../components/StatsGrid';
import EmptyState from '../components/EmptyState';
import { triggerToast } from '../components/Toast';

export default function SuperintendentDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inprogress: 0,
    resolved: 0
  });
  const [performance, setPerformance] = useState([]);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setPerformanceLoading(true);
    setError(null);

    // 1. Fetch Superintendent Overview Stats
    try {
      const statsRes = await api.getSuperintendentDashboard();
      if (statsRes.success && statsRes.totalComplaints) {
        const rawData = statsRes.totalComplaints[0] || {};
        const totalCount = rawData.totalComplaints?.[0]?.total || 0;
        let pending = 0, inprogress = 0, resolved = 0;

        const breakdown = rawData.complaintsByStatus || [];
        breakdown.forEach((statusObj) => {
          const norm = normalizeStatus(statusObj._id);
          if (norm === 'pending')    pending    += statusObj.count;
          else if (norm === 'inprogress') inprogress += statusObj.count;
          else if (norm === 'resolved')   resolved   += statusObj.count;
        });

        setStats({ total: totalCount, pending, inprogress, resolved });
      }
    } catch (err) {
      if (isEmptyDataError(err)) {
        setStats({ total: 0, pending: 0, inprogress: 0, resolved: 0 });
      } else {
        triggerToast('error', 'Failed to load superintendent stats.');
      }
    } finally {
      setLoading(false);
    }

    // 2. Fetch Staff Performance
    try {
      const perfRes = await api.getStaffPerformance();
      if (perfRes.success && perfRes.performance) {
        setPerformance(perfRes.performance);
      }
    } catch (err) {
      if (isEmptyDataError(err)) {
        setPerformance([]);
      } else {
        triggerToast('error', 'Failed to load staff performance metrics.');
      }
    } finally {
      setPerformanceLoading(false);
    }
  };

  // SVG Donut Chart Constants
  const donutRadius = 50;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~314.16
  
  const getDonutSegments = () => {
    const { pending, inprogress, resolved, total } = stats;
    if (total === 0) return [];

    const segments = [
      { key: 'resolved', count: resolved, color: 'var(--status-resolved-text)', label: 'Resolved' },
      { key: 'inprogress', count: inprogress, color: 'var(--status-inprogress-text)', label: 'In Progress' },
      { key: 'pending', count: pending, color: 'var(--status-pending-text)', label: 'Pending' }
    ];

    let currentOffset = 0;
    return segments
      .filter((s) => s.count > 0)
      .map((s) => {
        const percentage = s.count / total;
        const strokeLength = percentage * donutCircumference;
        const strokeOffset = donutCircumference - strokeLength + currentOffset;
        currentOffset -= strokeLength;
        return {
          ...s,
          strokeLength,
          strokeOffset,
          percentage: (percentage * 100).toFixed(1)
        };
      });
  };

  const donutSegments = getDonutSegments();

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Superintendent Overview</h1>
        <p className="page-subtitle">Monitor staff performance, hostel logs, and operational efficiency analytics</p>
      </div>

      <StatsGrid
        loading={loading}
        stats={[
          { label: 'Hostel Total Logs', value: stats.total,      icon: '📁', bgColor: 'var(--primary-light)', textColor: 'var(--primary)' },
          { label: 'Pending Logs',      value: stats.pending,    icon: '⏳', bgColor: '#fffbeb',             textColor: '#b45309' },
          { label: 'In Progress',       value: stats.inprogress, icon: '⚙️', bgColor: '#eff6ff',             textColor: '#1d4ed8' },
          { label: 'Resolved Logs',     value: stats.resolved,   icon: '✅', bgColor: '#ecfdf5',             textColor: '#047857' },
        ]}
      />

      {/* Analytics Visualization Grid */}
      <div className="grid-cols-2" style={{ marginBottom: '28px' }}>
        {/* Status Distribution Donut Chart */}
        <div className="table-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', alignSelf: 'flex-start', marginBottom: '20px' }}>Complaint Status Breakdown</h3>
          
          {loading ? (
            <div className="loading-spinner-container" style={{ padding: '40px' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : stats.total === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              No complaints recorded in this hostel yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '32px', width: '100%' }}>
              {/* Donut Circle */}
              <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                <svg viewBox="0 0 120 120" className="chart-svg" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="transparent"
                    stroke="var(--border-color)"
                    strokeWidth="12"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.key}
                      cx="60"
                      cy="60"
                      r={donutRadius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={donutCircumference}
                      strokeDashoffset={seg.strokeOffset}
                      className="chart-segment"
                    />
                  ))}
                </svg>
                {/* Central Labels */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.total}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total</div>
                </div>
              </div>

              {/* Legends */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {donutSegments.map((seg) => (
                  <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8125rem' }}>
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: seg.color,
                      display: 'inline-block'
                    }} />
                    <span style={{ fontWeight: 600 }}>{seg.label}:</span>
                    <span>{seg.count} ({seg.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Operational Performance Summary Box */}
        <div className="table-container" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '20px' }}>Staff Resolution Rate</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center' }}>
            {loading ? (
              <div className="loading-spinner-container" style={{ padding: '40px' }}>
                <div className="loading-spinner"></div>
              </div>
            ) : stats.total === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                No active complaints metrics.
              </div>
            ) : (
              <>
                <div>
                  <div className="flex-row-between" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span>Resolution Index</span>
                    <span>{((stats.resolved / stats.total) * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      backgroundColor: 'var(--status-resolved-text)',
                      width: `${(stats.resolved / stats.total) * 100}%`,
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out'
                    }} />
                  </div>
                </div>

                <div>
                  <div className="flex-row-between" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span>In-Progress Index</span>
                    <span>{((stats.inprogress / stats.total) * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      backgroundColor: 'var(--status-inprogress-text)',
                      width: `${(stats.inprogress / stats.total) * 100}%`,
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out'
                    }} />
                  </div>
                </div>

                <div>
                  <div className="flex-row-between" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span>Unaddressed Index (Pending)</span>
                    <span>{((stats.pending / stats.total) * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      backgroundColor: 'var(--status-pending-text)',
                      width: `${(stats.pending / stats.total) * 100}%`,
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out'
                    }} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Staff Performance Table */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Staff Activity & Performance Analytics</h2>
      
      {performanceLoading ? (
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
        </div>
      ) : performance.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p style={{ fontWeight: 600 }}>No staff performance records available</p>
          <p style={{ fontSize: '0.875rem' }}>This table displays resolution metrics based on caretaker and warden ticket activity history logs.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Staff Registration Number</th>
                <th>Role</th>
                <th style={{ textAlign: 'center' }}>Total Actions</th>
                <th style={{ textAlign: 'center' }}>Resolved</th>
                <th style={{ textAlign: 'center' }}>In Progress</th>
                <th style={{ textAlign: 'center' }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((staffObj, i) => (
                <tr key={i}>
                  <td data-label="Staff Reg No" style={{ fontWeight: 700 }}>{staffObj.staff}</td>
                  <td data-label="Role">
                    <span
                      className="badge"
                      style={{
                        backgroundColor: staffObj.role === 'warden' ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                        color: staffObj.role === 'warden' ? 'var(--primary)' : 'var(--text-primary)',
                        borderColor: staffObj.role === 'warden' ? 'var(--border-color)' : 'transparent',
                        fontSize: '0.7rem'
                      }}
                    >
                      {staffObj.role}
                    </span>
                  </td>
                  <td data-label="Total Actions" style={{ textAlign: 'center', fontWeight: 600 }}>{staffObj.totalActions}</td>
                  <td data-label="Resolved" style={{ textAlign: 'center', color: 'var(--status-resolved-text)', fontWeight: 700 }}>
                    {staffObj.resolved}
                  </td>
                  <td data-label="In Progress" style={{ textAlign: 'center', color: 'var(--status-inprogress-text)', fontWeight: 700 }}>
                    {staffObj.inProgress}
                  </td>
                  <td data-label="Pending" style={{ textAlign: 'center', color: 'var(--status-pending-text)', fontWeight: 700 }}>
                    {staffObj.pending}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
