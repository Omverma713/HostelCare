import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Star,
  Send,
  CheckCircle2,
  Mail,
  User,
  Tag,
  MessageSquare,
  ShieldCheck,
  RotateCcw,
  Lightbulb,
  Bug,
  Building2,
  Palette,
  MessageCircle,
  AlertCircle,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { triggerToast } from './Toast';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
  { id: 'Suggestion', label: 'Suggestion', icon: Lightbulb },
  { id: 'Bug Report', label: 'Bug Report', icon: Bug },
  { id: 'Feature Request', label: 'Feature Request', icon: Sparkles },
  { id: 'Hostel Experience', label: 'Hostel Life', icon: Building2 },
  { id: 'App UI/UX', label: 'Design & UI', icon: Palette },
  { id: 'Other', label: 'Other', icon: MessageCircle },
];

const RATING_CONFIG = {
  1: { emoji: '😡', label: 'Major Issues', badgeBg: 'rgba(239, 68, 68, 0.12)', badgeColor: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  2: { emoji: '🙁', label: 'Needs Work', badgeBg: 'rgba(249, 115, 22, 0.12)', badgeColor: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
  3: { emoji: '😐', label: 'Satisfactory', badgeBg: 'rgba(234, 179, 8, 0.12)', badgeColor: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
  4: { emoji: '😊', label: 'Very Good', badgeBg: 'rgba(16, 185, 129, 0.12)', badgeColor: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  5: { emoji: '🤩', label: 'Outstanding!', badgeBg: 'rgba(99, 102, 241, 0.12)', badgeColor: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
};

const QUICK_TOPICS = [
  '📶 Wi-Fi',
  '🍲 Mess',
  '🧹 Cleaning',
  '🚰 Water',
  '⚡ Power',
  '📱 App UI',
];

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
  const [referenceId, setReferenceId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (user) {
      setName(user.name || user.registrationNumber || '');
      setEmail(user.email || '');
      if (!subject) {
        setSubject(`Feedback from ${user.hostel || 'Hostel'} (${user.role || 'User'})`);
      }
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSubmitted(false);
      setFieldErrors({});
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Please provide your name.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }
    if (!message.trim() || message.trim().length < 10) {
      errors.message = `Please enter at least 10 characters (${10 - (message.trim().length || 0)} more needed).`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, email, message]);

  const handleQuickTopic = useCallback((topic) => {
    const clean = topic.replace(/^[^\s]+\s/, '');
    setSubject((prev) => prev || `${clean} Feedback`);
    setMessage((prev) => (prev ? `${prev} [Topic: ${topic}] ` : `[Topic: ${topic}] `));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      triggerToast('error', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: user ? user.role : 'visitor',
        rating,
        category,
        subject: subject.trim() || `${category} Feedback`,
        message: message.trim(),
      };

      await api.submitFeedback(payload);
      const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      setReferenceId(`HC-FB-${new Date().getFullYear()}-${randomCode}`);
      setSubmitted(true);
      triggerToast('success', '✨ Feedback sent! Check your inbox for confirmation.');
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to submit feedback. Please try again.';
      setFieldErrors({ form: msg });
      triggerToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [name, email, user, rating, category, subject, message, validateForm]);

  const resetForm = useCallback(() => {
    setMessage('');
    setSubject('');
    setSubmitted(false);
    setFieldErrors({});
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget && !submitting) {
      onClose();
    }
  }, [submitting, onClose]);

  const activeRating = hoverRating || rating;
  const ratingDetails = useMemo(() => RATING_CONFIG[activeRating] || RATING_CONFIG[5], [activeRating]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 1100, backdropFilter: 'blur(6px)' }}>
      <div className="modal-content feedback-modal-wrapper" role="dialog" aria-modal="true" style={{ padding: 0 }}>
        {/* Header with modern gradient */}
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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>
              HostelCare Feedback Hub
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#e0e7ff', opacity: 0.9 }}>
            {user
              ? `Logged in as ${user.name || user.registrationNumber} (${user.role})`
              : 'Community Voice Channel — We read and act on every response.'}
          </p>
        </div>

        <div className="feedback-modal-body">
          {submitted ? (
            /* Success confirmation card */
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 10px 28px rgba(16, 185, 129, 0.35)',
                }}
              >
                <CheckCircle2 size={40} />
              </div>

              <div
                style={{
                  display: 'inline-block',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '10px',
                }}
              >
                REF #{referenceId}
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Thank You, {name}!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '20px' }}>
                Your feedback has been forwarded directly to the HostelCare administration team.
              </p>

              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.06) 0%, rgba(124, 58, 237, 0.08) 100%)',
                  border: '1px solid rgba(67, 97, 238, 0.2)',
                  borderRadius: '14px',
                  padding: '16px',
                  textAlign: 'left',
                  fontSize: '13px',
                  marginBottom: '22px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                  <Mail size={16} />
                  <span>Confirmation Dispatched</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  A verification receipt with your submission details has been emailed to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                </div>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="feedback-submit-btn"
                style={{ width: '100%', padding: '12px' }}
              >
                Close & Return
              </button>
            </div>
          ) : (
            /* Feedback Form */
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {fieldErrors.form && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{fieldErrors.form}</span>
                </div>
              )}

              {/* Star Rating Section */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Overall Experience Rating <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className={`feedback-star-btn ${isActive ? 'active' : ''}`}
                          aria-label={`${star} star`}
                        >
                          <Star
                            size={24}
                            fill={isActive ? '#f59e0b' : 'transparent'}
                            color={isActive ? '#f59e0b' : 'var(--text-muted)'}
                            strokeWidth={isActive ? 0 : 2}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: ratingDetails.badgeBg,
                      border: `1px solid ${ratingDetails.border}`,
                      color: ratingDetails.badgeColor,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <span>{ratingDetails.emoji}</span>
                    <span>{ratingDetails.label}</span>
                  </div>
                </div>
              </div>

              {/* Category Pill Tags */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Feedback Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="feedback-category-group" role="radiogroup" aria-label="Feedback Categories" style={{ gap: '8px' }}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={cat.label}
                        onClick={() => setCategory(cat.id)}
                        className={`feedback-category-btn ${isSelected ? 'active' : ''}`}
                        style={{ padding: '7px 14px', fontSize: '12.5px' }}
                      >
                        <span className="feedback-category-icon-wrap">
                          <IconComponent size={14} />
                        </span>
                        <span>{cat.label}</span>
                        {isSelected && (
                          <span className="feedback-category-check">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name and Email */}
              <div className="feedback-form-grid">
                <div>
                  <label htmlFor="m-name" style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px', color: 'var(--text-primary)' }}>
                    Your Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="feedback-input-container">
                    <span className="feedback-input-icon">
                      <User size={15} />
                    </span>
                    <input
                      id="m-name"
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: null }));
                      }}
                      className="feedback-input-field"
                      style={fieldErrors.name ? { borderColor: '#ef4444' } : {}}
                    />
                  </div>
                  {fieldErrors.name && (
                    <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{fieldErrors.name}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="m-email" style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px', color: 'var(--text-primary)' }}>
                    Your Email (Confirmation) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="feedback-input-container">
                    <span className="feedback-input-icon">
                      <Mail size={15} />
                    </span>
                    <input
                      id="m-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
                      }}
                      className="feedback-input-field"
                      style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}
                    />
                  </div>
                  {fieldErrors.email && (
                    <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{fieldErrors.email}</div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="m-subject" style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px', color: 'var(--text-primary)' }}>
                  Subject
                </label>
                <div className="feedback-input-container">
                  <span className="feedback-input-icon">
                    <Tag size={15} />
                  </span>
                  <input
                    id="m-subject"
                    type="text"
                    placeholder="Short summary of your feedback"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="feedback-input-field"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <label htmlFor="m-msg" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Detailed Feedback <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '11px', color: message.length >= 10 ? 'var(--text-muted)' : '#ef4444' }}>
                    {message.length} / 10 min chars
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick tags:</span>
                  {QUICK_TOPICS.map((topic, idx) => (
                    <button key={idx} type="button" onClick={() => handleQuickTopic(topic)} className="quick-tag-chip" style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="feedback-textarea-container">
                  <textarea
                    id="m-msg"
                    rows={4}
                    placeholder="Tell us what you liked, what can be improved, or any issue you encountered..."
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (fieldErrors.message) setFieldErrors((prev) => ({ ...prev, message: null }));
                    }}
                    className="feedback-textarea-field"
                    style={fieldErrors.message ? { borderColor: '#ef4444' } : {}}
                  />
                </div>
                {fieldErrors.message && (
                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{fieldErrors.message}</div>
                )}
              </div>

              {/* Notice Pill */}
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
                  border: '1px solid var(--border-color)',
                }}
              >
                <ShieldCheck size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                <span>You will automatically receive an email confirmation copy of this feedback.</span>
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
                  className="feedback-submit-btn"
                  style={{ flex: 2, padding: '12px' }}
                >
                  {submitting ? (
                    <>
                      <span
                        className="spinner-border"
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid #fff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Send Feedback</span>
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
