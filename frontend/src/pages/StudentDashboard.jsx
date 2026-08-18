import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DEPARTMENTS } from '../constants';
import { normalizeStatus, sortByDateDesc, isEmptyDataError } from '../utils/status';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ActionHistory from '../components/ActionHistory';
import StatsGrid from '../components/StatsGrid';
import EmptyState from '../components/EmptyState';
import { triggerToast } from '../components/Toast';

const buildStudentStats = (complaints) => [
  { label: 'Total Logs',  value: complaints.length,
    icon: '📁', bgColor: 'var(--primary-light)', textColor: 'var(--primary)' },
  { label: 'Pending',     value: complaints.filter(c => normalizeStatus(c.status) === 'pending').length,
    icon: '⏳', bgColor: '#fffbeb', textColor: '#b45309' },
  { label: 'In Progress', value: complaints.filter(c => normalizeStatus(c.status) === 'inprogress').length,
    icon: '⚙️', bgColor: '#eff6ff', textColor: '#1d4ed8' },
  { label: 'Resolved',    value: complaints.filter(c => normalizeStatus(c.status) === 'resolved').length,
    icon: '✅', bgColor: '#ecfdf5', textColor: '#047857' },
];

export default function StudentDashboard() {
  const [complaints, setComplaints]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  // New complaint form state
  const [isCreateOpen, setIsCreateOpen]     = useState(false);
  const [department, setDepartment]         = useState('');
  const [description, setDescription]       = useState('');
  const [submitLoading, setSubmitLoading]   = useState(false);

  // Detail modal state
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
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
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!department) {
      triggerToast('error', 'Please select a department.');
      return;
    }
    if (!description || description.trim().length < 10) {
      triggerToast('error', 'Please provide a description of at least 10 characters.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await api.createComplaint(department, description);
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
    <div>
      <div className="flex-row-between page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">File and track your hostel maintenance issues</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
          ➕ File New Complaint
        </button>
      </div>

      <StatsGrid stats={buildStudentStats(complaints)} loading={loading} />

      <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Your Complaint History</h2>

      <EmptyState
        loading={loading}
        error={error}
        onRetry={fetchComplaints}
        emptyIcon="📦"
        emptyTitle="No complaints registered yet"
        emptyMessage="If you are facing any electrical, plumbing, mess, or other issues, log them here."
      >
        {complaints.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p style={{ fontWeight: 600 }}>No complaints registered yet</p>
            <p style={{ fontSize: '0.875rem' }}>If you are facing any electrical, plumbing, mess, or other issues, log them here.</p>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => setIsCreateOpen(true)}>
              File Your First Complaint
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Logged Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c._id}>
                    <td data-label="Category" style={{ fontWeight: 700 }}>{c.department}</td>
                    <td data-label="Description">{c.description}</td>
                    <td data-label="Logged Date">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td data-label="Status"><Badge status={c.status} /></td>
                    <td data-label="Actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedComplaint(c)}
                      >
                        👁️ View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EmptyState>

      {/* Modal: File New Complaint */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="File Maintenance Complaint">
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="compDept">Department / Category</label>
            <select
              id="compDept"
              className="form-input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={submitLoading}
              required
            >
              <option value="" disabled>-- Choose a department --</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="compDesc">Detailed Description</label>
            <textarea
              id="compDesc"
              className="form-input form-textarea"
              placeholder="Please describe the issue in detail (e.g. tube light blinking continuously in Room 302, water leaking from pipe under tap, etc.)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitLoading}
              required
            />
          </div>

          <div className="flex-row-between" style={{ marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} disabled={submitLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitLoading}>
              {submitLoading ? 'Filing…' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Complaint Details Timeline */}
      <Modal
        isOpen={!!selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        title="Complaint Information"
      >
        {selectedComplaint && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CATEGORY</span>
                <h4 style={{ fontSize: '1.25rem', marginTop: '2px' }}>{selectedComplaint.department}</h4>
              </div>
              <Badge status={selectedComplaint.status} />
            </div>

            <div className="form-group">
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DESCRIPTION</span>
              <p style={{
                marginTop: '4px', padding: '12px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: '0.9rem', whiteSpace: 'pre-wrap',
              }}>
                {selectedComplaint.description}
              </p>
            </div>

            <div className="grid-cols-2" style={{ marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>HOSTEL</span>
                <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selectedComplaint.hostelNo}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ROOM</span>
                <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>Room {selectedComplaint.roomNo}</p>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>LOGGED TIMESTAMP</span>
              <p style={{ fontSize: '0.875rem' }}>
                {selectedComplaint.createdAt ? new Date(selectedComplaint.createdAt).toLocaleString() : 'N/A'}
              </p>
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ACTION TIMELINE HISTORY</span>
              <ActionHistory actions={selectedComplaint.actions} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedComplaint(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
