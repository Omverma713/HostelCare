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

const CARETAKER_STATS = (complaints) => [
  { label: 'Hostel Logs',  value: complaints.length,
    icon: '📋', bgColor: 'var(--primary-light)', textColor: 'var(--primary)' },
  { label: 'Pending',      value: complaints.filter(c => normalizeStatus(c.status) === 'pending').length,
    icon: '⏳', bgColor: '#fffbeb', textColor: '#b45309' },
  { label: 'In Progress',  value: complaints.filter(c => normalizeStatus(c.status) === 'inprogress').length,
    icon: '⚙️', bgColor: '#eff6ff', textColor: '#1d4ed8' },
  { label: 'Resolved',     value: complaints.filter(c => normalizeStatus(c.status) === 'resolved').length,
    icon: '✅', bgColor: '#ecfdf5', textColor: '#047857' },
];

export default function CaretakerDashboard() {
  const [complaints, setComplaints]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  const [statusFilter, setStatusFilter]     = useState('');
  const [deptFilter, setDeptFilter]         = useState('');
  const [searchTerm, setSearchTerm]         = useState('');

  const [detailComplaint, setDetailComplaint]   = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getHostelComplaints();
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
  };

  const filteredComplaints = complaints.filter((c) => {
    const statusMatch  = !statusFilter || normalizeStatus(c.status) === statusFilter;
    const deptMatch    = !deptFilter   || c.department === deptFilter;
    const searchMatch  = !searchTerm
      || c.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
      || c.roomNo?.toString().includes(searchTerm)
      || c.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && deptMatch && searchMatch;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Caretaker Dashboard</h1>
        <p className="page-subtitle">Manage maintenance requests and log resolutions</p>
      </div>

      <StatsGrid stats={CARETAKER_STATS(complaints)} loading={loading} />

      <ComplaintFilters
        statusFilter={statusFilter}
        deptFilter={deptFilter}
        searchTerm={searchTerm}
        onStatusChange={setStatusFilter}
        onDeptChange={setDeptFilter}
        onSearchChange={setSearchTerm}
        title="Filter Maintenance Requests"
      />

      <EmptyState
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
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
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDetailComplaint(c)}
                        >
                          👁️ View
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelectedComplaint(c)}
                        >
                          ✏️ Update
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
        title="Update Request Status"
        onClose={() => setSelectedComplaint(null)}
        onSuccess={fetchComplaints}
      />
    </div>
  );
}
