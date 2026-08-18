import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { normalizeStatus, sortByDateDesc, isEmptyDataError } from '../utils/status';
import StatsGrid from '../components/StatsGrid';
import ComplaintFilters from '../components/ComplaintFilters';
import ComplaintDetailModal from '../components/ComplaintDetailModal';
import UpdateComplaintModal from '../components/UpdateComplaintModal';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';

/** Build stats array from the warden dashboard API response */
const buildWardenStats = (stats, loading) => [
  { label: 'Total Logs',   value: stats.totaComplaints,       icon: '📁', bgColor: 'var(--primary-light)', textColor: 'var(--primary)' },
  { label: 'Pending',      value: stats.pendingComplaints,    icon: '⏳', bgColor: '#fffbeb', textColor: '#b45309' },
  { label: 'In Progress',  value: stats.inProgressComplaints, icon: '⚙️', bgColor: '#eff6ff', textColor: '#1d4ed8' },
  { label: 'Resolved',     value: stats.resolvedComplaints,   icon: '✅', bgColor: '#ecfdf5', textColor: '#047857' },
];

const EMPTY_STATS = { totaComplaints: 0, pendingComplaints: 0, inProgressComplaints: 0, resolvedComplaints: 0 };

export default function WardenDashboard() {
  const [complaints, setComplaints]     = useState([]);
  const [stats, setStats]               = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter]     = useState('');
  const [searchTerm, setSearchTerm]     = useState('');

  const [detailComplaint, setDetailComplaint]       = useState(null);
  const [selectedComplaint, setSelectedComplaint]   = useState(null);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setStatsLoading(true);
    setError(null);

    // Fetch stats and complaints list in parallel
    const [statsResult, listResult] = await Promise.allSettled([
      api.getWardenDashboard(),
      api.getHostelComplaints(),
    ]);

    // Handle stats
    if (statsResult.status === 'fulfilled' && statsResult.value.success) {
      setStats(statsResult.value.stats);
    } else {
      const err = statsResult.reason;
      if (!isEmptyDataError(err)) {
        triggerToast('error', 'Failed to load warden dashboard statistics.');
      }
    }
    setStatsLoading(false);

    // Handle complaints list
    if (listResult.status === 'fulfilled' && listResult.value.success) {
      setComplaints(sortByDateDesc(listResult.value.complaints));
    } else {
      const err = listResult.reason;
      if (isEmptyDataError(err)) {
        setComplaints([]);
      } else {
        setError(err?.message || 'Failed to load complaints list.');
        triggerToast('error', err?.message || 'Failed to load complaints list.');
      }
    }
    setLoading(false);
  };

  const filteredComplaints = complaints.filter((c) => {
    const statusMatch = !statusFilter || normalizeStatus(c.status) === statusFilter;
    const deptMatch   = !deptFilter   || c.department === deptFilter;
    const searchMatch = !searchTerm
      || c.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      || c.roomNo?.toString().includes(searchTerm)
      || c.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && deptMatch && searchMatch;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Warden Dashboard</h1>
        <p className="page-subtitle">Oversee hostel maintenance, view performance statistics, and approve resolutions</p>
      </div>

      <StatsGrid stats={buildWardenStats(stats)} loading={statsLoading} />

      <ComplaintFilters
        statusFilter={statusFilter}
        deptFilter={deptFilter}
        searchTerm={searchTerm}
        onStatusChange={setStatusFilter}
        onDeptChange={setDeptFilter}
        onSearchChange={setSearchTerm}
        title="Filter Hostel Requests"
      />

      <EmptyState
        loading={loading}
        error={error}
        onRetry={fetchDashboardData}
        emptyTitle="No requests matching criteria"
        emptyMessage="Try clearing filters or the search query."
      >
        {filteredComplaints.length === 0 ? null : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Room</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Logged Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((c) => (
                  <tr key={c._id}>
                    <td data-label="Student">
                      <div style={{ fontWeight: 700 }}>{c.studentName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.registrationNo}</div>
                    </td>
                    <td data-label="Room"><span style={{ fontWeight: 700 }}>{c.roomNo}</span></td>
                    <td data-label="Category" style={{ fontWeight: 600 }}>{c.department}</td>
                    <td data-label="Description" style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.description}
                    </td>
                    <td data-label="Logged Date">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td data-label="Status"><Badge status={c.status} /></td>
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetailComplaint(c)}>
                          👁️ View
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => setSelectedComplaint(c)}>
                          ✏️ Edit Status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EmptyState>

      <ComplaintDetailModal
        complaint={detailComplaint}
        onClose={() => setDetailComplaint(null)}
      />

      <UpdateComplaintModal
        complaint={selectedComplaint}
        title="Warden Request Revision"
        onClose={() => setSelectedComplaint(null)}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}
