import React, { useRef, useState, useCallback } from 'react';
import Badge from './Badge';
import { normalizeStatus } from '../utils/status';

/**
 * SpatialTicketCard
 * An interactive 3D Floating Ticket Card featuring mouse tilt, lifecycle stepper, and glowing category styling.
 */
export default function SpatialTicketCard({ complaint, onSelect, getDeptIcon }) {
  const cardRef = useRef(null);
  const rafRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const clientX = e.clientX;
    const clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const rotateX = (((y - rect.height / 2) / (rect.height / 2)) * -5).toFixed(2);
      const rotateY = (((x - rect.width / 2) / (rect.width / 2)) * 5).toFixed(2);
      el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(12px)`;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const el = cardRef.current;
    if (el) {
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
    }
  }, []);

  const statusNorm = normalizeStatus(complaint.status);

  // Stepper active index calculation:
  // pending: step 0 (Logged) | assigned/actioned: step 1 | inprogress: step 2 | resolved: step 3
  const getActiveStep = () => {
    if (statusNorm === 'resolved') return 3;
    if (statusNorm === 'inprogress') return 2;
    if (complaint.actions && complaint.actions.length > 0) return 1;
    return 0;
  };

  const currentStep = getActiveStep();
  const steps = ['Logged', 'Assigned', 'In Progress', 'Resolved'];

  const roomDisplay = complaint.roomNo || complaint.roomNumber || complaint.studentId?.roomNumber || '302';

  return (
    <div
      ref={cardRef}
      className={`spatial-ticket-card-3d ticket-${statusNorm}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top Bar */}
      <div className="ticket-card-top">
        <div className="ticket-dept-pill">
          <span className="ticket-emoji-disc">{getDeptIcon(complaint.department)}</span>
          <div className="ticket-dept-text">
            <span className="ticket-dept-title">{complaint.department}</span>
            <span className="ticket-room-sub">Room {roomDisplay}</span>
          </div>
        </div>
        <Badge status={complaint.status} />
      </div>

      {/* Description Body */}
      <div className="ticket-card-body">
        <p className="ticket-desc-text" title={complaint.description}>
          {complaint.description}
        </p>
      </div>

      {/* 3D Lifecycle Progress Stepper */}
      <div className="ticket-stepper-wrap">
        <div className="ticket-stepper-line">
          <div
            className="ticket-stepper-fill"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
        <div className="ticket-stepper-nodes">
          {steps.map((step, idx) => (
            <div
              key={step}
              className={`stepper-node-item ${idx <= currentStep ? 'completed' : ''} ${
                idx === currentStep ? 'active' : ''
              }`}
            >
              <div className="stepper-dot">
                {idx === currentStep && <span className="stepper-ping-wave" />}
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <span className="stepper-label">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card Footer */}
      <div className="ticket-card-footer">
        <span className="ticket-date-chip">
          🕒 {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : 'Recent'}
        </span>
        <button
          type="button"
          className="btn-ticket-action-3d"
          onClick={() => onSelect(complaint)}
        >
          <span>View Details</span>
          <span className="btn-arrow">→</span>
        </button>
      </div>
    </div>
  );
}
