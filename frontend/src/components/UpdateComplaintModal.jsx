import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../services/api';
import { triggerToast } from './Toast';
import { STATUS_OPTIONS } from '../constants';

/**
 * Shared update-complaint modal.
 * Used by CaretakerDashboard and WardenDashboard.
 * Contains its own form state so the parent only manages which complaint is selected.
 *
 * @param {object|null} complaint  - The complaint being updated, or null when closed
 * @param {string}      title      - Modal title (varies by role)
 * @param {Function}    onClose    - Called when the modal is dismissed
 * @param {Function}    onSuccess  - Called after a successful update (parent can refresh data)
 */
export default function UpdateComplaintModal({ complaint, title = 'Update Complaint', onClose, onSuccess }) {
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateDesc, setUpdateDesc]     = useState('');
  const [loading, setLoading]           = useState(false);

  // Sync form fields when a different complaint is opened
  useEffect(() => {
    if (complaint) {
      setUpdateStatus(complaint.status || 'pending');
      setUpdateDesc(complaint.description || '');
    }
  }, [complaint]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!updateStatus) {
      triggerToast('error', 'Please select a status.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.updateComplaint(complaint._id, updateStatus, updateDesc);
      if (res.success) {
        triggerToast('success', 'Complaint updated successfully!');
        onClose();
        onSuccess?.();
      } else {
        triggerToast('error', res.message || 'Failed to update complaint.');
      }
    } catch (err) {
      triggerToast('error', err.data?.message || err.message || 'Failed to update complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={!!complaint} onClose={onClose} title={title}>
      {complaint && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
            <p><strong>Student:</strong> {complaint.studentName} (Room {complaint.roomNo})</p>
            <p><strong>Category:</strong> {complaint.department}</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ucm-status">Select Status</label>
            <select
              id="ucm-status"
              className="form-input"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value)}
              disabled={loading}
              required
            >
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ucm-desc">Edit Complaint Description</label>
            <textarea
              id="ucm-desc"
              className="form-input form-textarea"
              value={updateDesc}
              onChange={(e) => setUpdateDesc(e.target.value)}
              disabled={loading}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Warning: Editing this field modifies the main complaint description in the database.
            </span>
          </div>

          <div className="flex-row-between" style={{ marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
