import React from 'react';
import Modal from './Modal';
import Badge from './Badge';
import ActionHistory from './ActionHistory';

/**
 * Shared complaint detail view modal.
 * Used by CaretakerDashboard and WardenDashboard.
 * The detail view content was identical in both — extracted here.
 *
 * @param {object|null} complaint - The complaint to show, or null when closed
 * @param {Function}    onClose   - Callback to close the modal
 */
export default function ComplaintDetailModal({ complaint, onClose }) {
  return (
    <Modal
      isOpen={!!complaint}
      onClose={onClose}
      title="Complaint Details"
    >
      {complaint && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                STUDENT DETAILS
              </span>
              <h4 style={{ fontSize: '1.1rem', marginTop: '2px' }}>{complaint.studentName}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Reg No: {complaint.registrationNo} | Room {complaint.roomNo}
              </p>
            </div>
            <Badge status={complaint.status} />
          </div>

          {/* Department */}
          <div className="form-group">
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              DEPARTMENT CATEGORY
            </span>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{complaint.department}</p>
          </div>

          {/* Description */}
          <div className="form-group">
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              DESCRIPTION
            </span>
            <p style={{
              marginTop: '4px',
              padding: '12px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
            }}>
              {complaint.description}
            </p>
          </div>

          {/* Date */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              SUBMISSION DATE
            </span>
            <p style={{ fontSize: '0.875rem' }}>
              {complaint.createdAt ? new Date(complaint.createdAt).toLocaleString() : 'N/A'}
            </p>
          </div>

          {/* Action History */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ACTIVITY HISTORY
            </span>
            <ActionHistory actions={complaint.actions} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
