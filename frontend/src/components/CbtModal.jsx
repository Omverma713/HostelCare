import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { triggerToast } from './Toast';

/**
 * Closed Beta Testing (CBT) Modal
 * Handles channel status checking, application submission,
 * real-time approval status checking, and direct APK downloading.
 */
export default function CbtModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cbtData, setCbtData] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [deviceModel, setDeviceModel] = useState('');
  const [androidVersion, setAndroidVersion] = useState('Android 14');
  const [reason, setReason] = useState('');
  const [feedbackComfort, setFeedbackComfort] = useState('Very Comfortable — Can test daily & report bugs');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCbtStatus();
      if (res.success) {
        setCbtData(res);
      } else {
        setError(res.message || 'Failed to check Closed Beta status');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to Closed Beta channel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  if (!isOpen) return null;

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    if (!deviceModel.trim()) {
      triggerToast('warning', 'Please enter your smartphone model', 'Required');
      return;
    }
    if (!androidVersion.trim()) {
      triggerToast('warning', 'Please specify your Android version', 'Required');
      return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      triggerToast('warning', 'Please provide a reason of at least 10 characters', 'Required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.applyForCbt({
        deviceModel: deviceModel.trim(),
        androidVersion: androidVersion.trim(),
        reason: reason.trim(),
        feedbackComfort: feedbackComfort.trim(),
      });
      if (res.success) {
        triggerToast('success', res.message || 'Application submitted successfully!', 'CBT Application');
        await fetchStatus();
      } else {
        triggerToast('error', res.message || 'Submission failed', 'CBT Error');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to submit CBT application', 'CBT Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 15, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="cbt-modal-dialog"
        style={{
          background: 'var(--bg-card, #121626)',
          borderRadius: '20px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15)',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              🔬
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                  Closed Beta Testing (CBT)
                </h3>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    letterSpacing: '0.05em',
                  }}
                >
                  PREVIEW SQUADRON
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Early access channel for experimental HostelCare features
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: '1 1 auto',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  border: '3px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: '#6366f1',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 1rem',
                }}
              />
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', margin: 0 }}>
                Querying Closed Beta channel telemetry...
              </p>
            </div>
          ) : error ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '14px',
              }}
            >
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>⚠️</span>
              <p style={{ color: '#ef4444', fontWeight: 600, margin: '0 0 12px' }}>{error}</p>
              <button
                type="button"
                onClick={fetchStatus}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'var(--primary, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🔄 Try Again
              </button>
            </div>
          ) : cbtData?.hasApplied ? (
            /* Student has ALREADY submitted an application */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {cbtData.application?.status === 'approved' && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                    Congratulations! You are an Approved Beta Tester
                  </h4>
                  <p
                    style={{
                      margin: '0 0 16px',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary, #94a3b8)',
                      lineHeight: 1.5,
                    }}
                  >
                    Your application for <strong>Beta {cbtData.application?.betaVersion}</strong> was approved by Super Admin.
                    You have unlocked early access to download the exclusive beta build APK.
                  </p>

                  {cbtData.application?.downloadUrl ? (
                    <a
                      href={cbtData.application.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <span>📲 Download Beta APK (v{cbtData.application?.betaVersion})</span>
                    </a>
                  ) : (
                    <p style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                      APK URL is being provisioned by Super Admin. Please check back shortly.
                    </p>
                  )}

                  {cbtData.application?.reviewNote && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary, #cbd5e1)',
                      }}
                    >
                      <strong style={{ color: '#10b981' }}>Admin Note: </strong>
                      {cbtData.application.reviewNote}
                    </div>
                  )}
                </div>
              )}

              {cbtData.application?.status === 'pending' && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⏳</div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800, color: '#f59e0b' }}>
                    Application Under Review
                  </h4>
                  <p
                    style={{
                      margin: '0 0 16px',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary, #94a3b8)',
                      lineHeight: 1.5,
                    }}
                  >
                    Your application for <strong>Beta {cbtData.application?.betaVersion}</strong> has been received and is currently in queue.
                    Super Admin is reviewing hardware compatibility and quota allocations.
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                        boxShadow: '0 0 8px #f59e0b',
                      }}
                    />
                    Status: PENDING REVIEW
                  </div>
                </div>
              )}

              {cbtData.application?.status === 'rejected' && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(185, 28, 28, 0.05) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>❌</div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800, color: '#ef4444' }}>
                    Application Not Selected
                  </h4>
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary, #94a3b8)',
                      lineHeight: 1.5,
                    }}
                  >
                    Thank you for showing interest in <strong>Beta {cbtData.application?.betaVersion}</strong>.
                    Due to test slot limits or hardware quota distribution, this application was not selected.
                  </p>
                  {cbtData.application?.reviewNote && (
                    <div
                      style={{
                        margin: '12px auto 0',
                        maxWidth: '420px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary, #cbd5e1)',
                        textAlign: 'left',
                      }}
                    >
                      <strong style={{ color: '#ef4444' }}>Reason: </strong>
                      {cbtData.application.reviewNote}
                    </div>
                  )}
                  <p style={{ margin: '14px 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                    You will be able to apply again in the next beta cycle.
                  </p>
                </div>
              )}

              {/* Submitted Specs Summary */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  borderRadius: '14px',
                  padding: '1rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #64748b)',
                    marginBottom: '8px',
                    letterSpacing: '0.05em',
                  }}
                >
                  Submitted Specs
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>Device:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                      {cbtData.application?.deviceModel}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>Android OS:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                      {cbtData.application?.androidVersion}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>Submitted:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                      {cbtData.application?.submittedAt
                        ? new Date(cbtData.application.submittedAt).toLocaleDateString()
                        : 'Recently'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>Target Build:</span>
                    <div style={{ fontWeight: 600, color: '#818cf8' }}>
                      v{cbtData.application?.betaVersion}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : !cbtData?.formReleased ? (
            /* CBT Form is NOT released (Superadmin closed it) */
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(99, 102, 241, 0.04) 100%)',
                border: '1px dashed var(--border-color, rgba(255, 255, 255, 0.15))',
                borderRadius: '16px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  margin: '0 auto 1.25rem',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                }}
              >
                🔒
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                No CBT Form Released Yet
              </h4>
              <p
                style={{
                  margin: '0 auto 20px',
                  maxWidth: '420px',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  lineHeight: 1.6,
                }}
              >
                The Closed Beta recruitment channel is currently closed. Super Admin has not opened an active test round for registration right now.
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  fontSize: '0.8rem',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#10b981' }}>●</span>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Current Stable Public Version:</span>
                  <strong style={{ color: 'var(--text-primary, #ffffff)' }}>v1.2.2.12</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#f59e0b' }}>●</span>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Closed Beta Channel Status:</span>
                  <strong style={{ color: '#f59e0b' }}>OFFLINE / INACTIVE</strong>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={fetchStatus}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    background: 'var(--bg-card-hover, rgba(255, 255, 255, 0.08))',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Check Channel Again
                </button>
              </div>
            </div>
          ) : (
            /* CBT Form IS LIVE and student can apply */
            <form onSubmit={handleSubmitApplication} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Form Intro Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.08) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '14px',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    🟢 APPLICATIONS LIVE
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8' }}>
                    Target Build: v{cbtData.formDetails?.version || '1.2.2.12'}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)' }}>
                  {cbtData.formDetails?.title || 'HostelCare Closed Beta Recruitment'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.4 }}>
                  {cbtData.formDetails?.description ||
                    'Join our Closed Beta Testing program to receive early APK builds and help shape the next version of HostelCare.'}
                </p>
                {cbtData.formDetails?.deadline && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                    ⏳ Deadline: {new Date(cbtData.formDetails.deadline).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Applicant Identity Card */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>{user?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                    {user?.registrationNumber} • {user?.hostel || 'Hostel'} (Room {user?.roomNumber || '—'})
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#60a5fa',
                    background: 'rgba(59, 130, 246, 0.15)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}
                >
                  Verified Student
                </span>
              </div>

              {/* Input: Device Model */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #cbd5e1)',
                    marginBottom: '6px',
                  }}
                >
                  Smartphone Model <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="e.g. OnePlus 11R, Samsung Galaxy S23, Redmi Note 12"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-input, rgba(255, 255, 255, 0.05))',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Input: Android Version */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #cbd5e1)',
                    marginBottom: '6px',
                  }}
                >
                  Android Version <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={androidVersion}
                  onChange={(e) => setAndroidVersion(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-card, #121626)',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="Android 15">Android 15 (Vanilla Ice Cream)</option>
                  <option value="Android 14">Android 14 (Upside Down Cake)</option>
                  <option value="Android 13">Android 13 (Tiramisu)</option>
                  <option value="Android 12">Android 12 (Snow Cone)</option>
                  <option value="Android 11">Android 11 (Red Velvet Cake)</option>
                  <option value="Android 10">Android 10</option>
                  <option value="Other">Other Android Release</option>
                </select>
              </div>

              {/* Input: Feedback Comfort */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #cbd5e1)',
                    marginBottom: '6px',
                  }}
                >
                  Testing Availability & Bug Reporting
                </label>
                <select
                  value={feedbackComfort}
                  onChange={(e) => setFeedbackComfort(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-card, #121626)',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="Very Comfortable — Can test daily & report bugs">
                    Very Comfortable — Can test daily & report bugs
                  </option>
                  <option value="Comfortable — 2-3 tests per week">
                    Comfortable — 2-3 tests per week
                  </option>
                  <option value="Casual — Will report critical issues only">
                    Casual — Will report critical issues only
                  </option>
                </select>
              </div>

              {/* Input: Motivation / Reason */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #cbd5e1)',
                    marginBottom: '6px',
                  }}
                >
                  Why do you want to join the Closed Beta? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Share what features you are excited to test, or your previous testing experience..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                    background: 'var(--bg-input, rgba(255, 255, 255, 0.05))',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                  Minimum 10 characters ({reason.trim().length}/10)
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: '6px',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                  transition: 'transform 0.15s ease',
                }}
              >
                {submitting ? (
                  <>
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTopColor: '#ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                      }}
                    />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Submit Closed Beta Application</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card, #121626)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
            🔒 Confidential Beta Channel • HostelCare
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
              background: 'transparent',
              color: 'var(--text-secondary, #cbd5e1)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
