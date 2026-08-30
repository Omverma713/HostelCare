import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { triggerToast } from './Toast';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
  { id: 'Suggestion', label: '💡 Suggestion', desc: 'Ideas to improve the hostel portal' },
  { id: 'Bug Report', label: '🐛 Bug Report', desc: 'Something not working as expected' },
  { id: 'Feature Request', label: '✨ Feature Request', desc: 'New functionality you would love' },
  { id: 'Hostel Experience', label: '🏢 Hostel Experience', desc: 'Feedback on hostel facilities/life' },
  { id: 'App UI/UX', label: '🎨 Design & UI', desc: 'Visuals, layout, and usability feedback' },
  { id: 'Other', label: '💬 Other', desc: 'General thoughts or questions' },
];

const RATING_LABELS = {
  1: '⭐ Needs Major Improvement',
  2: '⭐⭐ Below Average',
  3: '⭐⭐⭐ Good / Average',
  4: '⭐⭐⭐⭐ Very Good',
  5: '⭐⭐⭐⭐⭐ Outstanding Experience',
};

export default function FeedbackModal({ isOpen, onClose }) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Suggestion');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prefill for authenticated users
  useEffect(() => {
    if (user) {
      setName(user.name || user.registrationNumber || '');
      // If user has registrationNumber, default subject
      if (!subject) {
        setSubject(`Feedback from ${user.hostel || 'Hostel'} (${user.role || 'User'})`);
      }
    }
  }, [user, isOpen]);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSubmitted(false);
      setErrorMsg('');
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please provide your name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address so we can confirm your submission.');
      return;
    }

    if (!message.trim() || message.trim().length < 10) {
      setErrorMsg('Please write at least 10 characters in your feedback message.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        role: user ? user.role : 'visitor',
        rating,
        category,
        subject: subject.trim() || `${category} Feedback`,
        message: message.trim(),
      };

      const res = await api.submitFeedback(payload);
      setSubmitted(true);
      triggerToast('success', '✨ Feedback sent! Check your inbox for confirmation.');
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to submit feedback. Please try again.';
      setErrorMsg(msg);
      triggerToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setMessage('');
    setSubject('');
    setSubmitted(false);
    setErrorMsg('');
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !submitting) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 1100 }}>
      <div
        className="modal-content feedback-modal-wrapper"
        role="dialog"
        aria-modal="true"
        style={{ padding: 0 }}
      >
        {/* Header with gradient */}
        <div className="feedback-modal-header">
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '18px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            &times;
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <span style={{ fontSize: '26px' }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              HostelCare Feedback
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#e0e7ff', opacity: 0.9 }}>
            {user
              ? `Logged in as ${user.name || user.registrationNumber} (${user.role})`
              : 'Visitor & Community Feedback Channel — We value your voice!'}
          </p>
        </div>

        <div className="feedback-modal-body">
          {submitted ? (
            /* Success confirmation card */
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px auto',
                  boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)',
                }}
              >
                ✓
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800 }}>
                Thank You, {name}!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Your feedback has been forwarded directly to the HostelCare administration team.
              </p>

              <div
                style={{
                  background: 'var(--primary-light)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                  📬 Confirmation Dispatched
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  A verification receipt with your submission details has been emailed to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                </div>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontWeight: 700, borderRadius: '12px' }}
              >
                Close & Return
              </button>
            </div>
          ) : (
            /* Feedback Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {errorMsg && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Star Rating Section */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Overall Experience Rating
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="feedback-star-btn"
                        style={{
                          color: active ? '#f59e0b' : 'var(--text-muted)',
                          transform: active ? 'scale(1.15)' : 'scale(1)',
                        }}
                        aria-label={`${star} star`}
                      >
                        ★
                      </button>
                    );
                  })}
                  <span
                    style={{
                      marginLeft: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {RATING_LABELS[hoverRating || rating]}
                  </span>
                </div>
              </div>

              {/* Category Pill Tags */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Feedback Category
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className="feedback-category-btn"
                        style={{
                          border: isSelected
                            ? '1px solid var(--primary)'
                            : '1px solid var(--border-color)',
                          background: isSelected ? 'var(--primary)' : 'var(--bg-tertiary)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name and Email */}
              <div className="feedback-form-grid">
                <div>
                  <label
                    htmlFor="feedback-name"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Your Name *
                  </label>
                  <input
                    id="feedback-name"
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="feedback-email"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      marginBottom: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Your Email (For Confirmation) *
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label
                  htmlFor="feedback-subject"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    marginBottom: '6px',
                    color: 'var(--text-primary)',
                  }}
                >
                  Subject
                </label>
                <input
                  id="feedback-subject"
                  type="text"
                  placeholder="Short summary of your feedback"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label
                    htmlFor="feedback-msg"
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Feedback Message *
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {message.length} characters
                  </span>
                </div>
                <textarea
                  id="feedback-msg"
                  rows={4}
                  required
                  placeholder="Tell us what you liked, what can be improved, or any issue you encountered..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* Notice pill */}
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-tertiary)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                }}
              >
                <span>📬</span>
                <span>
                  You will automatically receive a confirmation copy in your email inbox as a visitor/user.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="btn"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border" style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }}></span>
                      <span>Dispatching Feedback...</span>
                    </>
                  ) : (
                    <>
                      <span>✉️ Send Feedback</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
