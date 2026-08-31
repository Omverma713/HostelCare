import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Star,
  Send,
  CheckCircle2,
  Mail,
  User,
  Tag,
  MessageSquare,
  ShieldCheck,
  Clock,
  Zap,
  RotateCcw,
  HeartHandshake,
  Lightbulb,
  Bug,
  Building2,
  Palette,
  MessageCircle,
  HelpCircle,
  Check,
  ArrowRight,
  AlertCircle,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
  { id: 'Suggestion', label: 'Suggestion', icon: Lightbulb, desc: 'Ideas to improve portal' },
  { id: 'Bug Report', label: 'Bug Report', icon: Bug, desc: 'Glitches or broken items' },
  { id: 'Feature Request', label: 'Feature Request', icon: Sparkles, desc: 'New tools or workflow' },
  { id: 'Hostel Experience', label: 'Hostel Life', icon: Building2, desc: 'Amenities, mess, cleaning' },
  { id: 'App UI/UX', label: 'App UI/UX', icon: Palette, desc: 'Design & usability' },
  { id: 'Other', label: 'Other', icon: MessageCircle, desc: 'General thoughts' },
];

const RATING_CONFIG = {
  1: { emoji: '😡', label: 'Needs Major Improvement', badgeBg: 'rgba(239, 68, 68, 0.12)', badgeColor: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  2: { emoji: '🙁', label: 'Below Expectations', badgeBg: 'rgba(249, 115, 22, 0.12)', badgeColor: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
  3: { emoji: '😐', label: 'Average / Fair Experience', badgeBg: 'rgba(234, 179, 8, 0.12)', badgeColor: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
  4: { emoji: '😊', label: 'Very Good & Smooth', badgeBg: 'rgba(16, 185, 129, 0.12)', badgeColor: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  5: { emoji: '🤩', label: 'Outstanding Experience!', badgeBg: 'rgba(99, 102, 241, 0.12)', badgeColor: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
};

const QUICK_TOPICS = [
  '📶 Wi-Fi & Internet',
  '🍲 Mess Quality',
  '🧹 Room Cleaning',
  '🚰 Water Supply',
  '⚡ Electricity',
  '📱 Mobile Experience',
  '🔔 Notification Alerts',
  '✨ New Feature Idea',
];

export default function FeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
      setSubject(`Feedback from ${user.hostel || 'Hostel'} (${user.role || 'User'})`);
    }
  }, [user]);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Please provide your full name.';
    }
    if (!email.trim()) {
      errors.email = 'Please provide your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!message.trim()) {
      errors.message = 'Please provide your feedback details.';
    } else if (message.trim().length < 10) {
      errors.message = `Please enter at least 10 characters (${10 - message.trim().length} more needed).`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, email, message]);

  const handleQuickTopic = useCallback((topic) => {
    const cleanTopic = topic.replace(/^[^\s]+\s/, '');
    setSubject((prev) => prev || `${cleanTopic} Feedback`);
    setMessage((prev) => (prev ? `${prev}\n\n[Topic: ${topic}] ` : `[Topic: ${topic}] `));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      triggerToast('error', 'Please fill in all required fields accurately.');
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
      triggerToast('success', '✨ Feedback dispatched! Confirmation email sent.');
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to submit feedback. Please try again.';
      setFieldErrors({ form: msg });
      triggerToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [name, email, user, rating, category, subject, message, validateForm]);

  const handleReset = useCallback(() => {
    setMessage('');
    setSubject('');
    setSubmitted(false);
    setFieldErrors({});
    setReferenceId('');
  }, []);

  const activeRating = hoverRating || rating;
  const ratingDetails = useMemo(() => RATING_CONFIG[activeRating] || RATING_CONFIG[5], [activeRating]);
  const selectedCategoryObj = useMemo(() => CATEGORIES.find((c) => c.id === category), [category]);

  return (
    <div className="feedback-page-wrapper">
      {/* Header Banner */}
      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.12) 0%, rgba(124, 58, 237, 0.16) 100%)',
              border: '1px solid rgba(67, 97, 238, 0.25)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--primary)',
            }}
          >
            <Sparkles size={14} className="text-primary animate-pulse" />
            <span>Community Voice & Feedback Hub</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              padding: '5px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>Dual Email Delivery Guarantee</span>
          </div>
        </div>

        <h1
          style={{
            fontSize: 'clamp(24px, 3.5vw, 32px)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '0 0 8px 0',
            letterSpacing: '-0.6px',
            lineHeight: 1.25,
          }}
        >
          Share Your Feedback & Suggestions
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '15px',
            lineHeight: 1.6,
            maxWidth: '720px',
            margin: 0,
          }}
        >
          Help us build a cleaner, smarter, and more reliable hostel experience. Every response is directly reviewed by the hostel administration and warden committee.
        </p>
      </div>

      <div className="feedback-page-grid">
        {/* Left Column: Form Card */}
        <div className="feedback-main-card">
          {submitted ? (
            /* Success View */
            <div style={{ textAlign: 'center', padding: '24px 8px', animation: 'scaleIn 0.3s ease-out' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  boxShadow: '0 12px 32px rgba(16, 185, 129, 0.35)',
                }}
              >
                <CheckCircle2 size={44} />
              </div>

              <div
                style={{
                  display: 'inline-block',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  letterSpacing: '0.5px',
                }}
              >
                REF #{referenceId}
              </div>

              <h2
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  margin: '0 0 10px 0',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.4px',
                }}
              >
                Thank You, {name}!
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  maxWidth: '480px',
                  margin: '0 auto 24px auto',
                }}
              >
                Your feedback has been successfully captured and routed to the HostelCare administration.
              </p>

              {/* Confirmation Email Receipt Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.06) 0%, rgba(124, 58, 237, 0.08) 100%)',
                  border: '1px solid rgba(67, 97, 238, 0.2)',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  textAlign: 'left',
                  fontSize: '14px',
                  marginBottom: '28px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                  <Mail size={18} />
                  <span>Confirmation Dispatched</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  A full receipt copy with your submission details has been emailed to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn"
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <RotateCcw size={16} />
                  <span>Submit Another Response</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="btn btn-primary"
                  style={{
                    padding: '12px 28px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {fieldErrors.form && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{fieldErrors.form}</span>
                </div>
              )}

              {/* 1. Rating Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    How would you rate your overall experience? <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                            size={28}
                            fill={isActive ? '#f59e0b' : 'transparent'}
                            color={isActive ? '#f59e0b' : 'var(--text-muted)'}
                            strokeWidth={isActive ? 0 : 2}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Reactive sentiment pill */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      background: ratingDetails.badgeBg,
                      border: `1px solid ${ratingDetails.border}`,
                      color: ratingDetails.badgeColor,
                      fontSize: '13px',
                      fontWeight: 700,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span>{ratingDetails.emoji}</span>
                    <span>{ratingDetails.label}</span>
                  </div>
                </div>
              </div>

              {/* 2. Category Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Select Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {selectedCategoryObj && (
                    <span className="feedback-cat-desc-badge">
                      <Sparkles size={12} style={{ marginRight: '5px' }} />
                      {selectedCategoryObj.desc}
                    </span>
                  )}
                </div>
                <div className="feedback-category-group" role="radiogroup" aria-label="Feedback Categories">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${cat.label} - ${cat.desc}`}
                        onClick={() => setCategory(cat.id)}
                        className={`feedback-category-btn ${isSelected ? 'active' : ''}`}
                      >
                        <span className="feedback-category-icon-wrap">
                          <IconComponent size={15} />
                        </span>
                        <span>{cat.label}</span>
                        {isSelected && (
                          <span className="feedback-category-check">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Name & Email Form Grid */}
              <div className="feedback-form-grid">
                <div>
                  <label htmlFor="user-name" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Your Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="feedback-input-container">
                    <span className="feedback-input-icon">
                      <User size={17} />
                    </span>
                    <input
                      id="user-name"
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
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} />
                      <span>{fieldErrors.name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="user-email" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Your Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="feedback-input-container">
                    <span className="feedback-input-icon">
                      <Mail size={17} />
                    </span>
                    <input
                      id="user-email"
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
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} />
                      <span>{fieldErrors.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Subject */}
              <div>
                <label htmlFor="user-subject" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Subject (Optional Summary)
                </label>
                <div className="feedback-input-container">
                  <span className="feedback-input-icon">
                    <Tag size={17} />
                  </span>
                  <input
                    id="user-subject"
                    type="text"
                    placeholder="e.g. Wi-Fi stability in Block B, Mess breakfast variety"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="feedback-input-field"
                  />
                </div>
              </div>

              {/* 5. Detailed Feedback & Quick Tags */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="user-feedback" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Your Detailed Feedback <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span
                    className={`feedback-char-badge ${message.trim().length >= 10 ? 'valid' : 'invalid'}`}
                  >
                    {message.trim().length >= 10 ? (
                      <>
                        <Check size={12} strokeWidth={3} />
                        <span>{message.trim().length} chars (Ready)</span>
                      </>
                    ) : (
                      <>
                        <span>{message.trim().length} / 10 min chars ({10 - message.trim().length} more)</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Quick Topic Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '2px' }}>
                    Quick Insert:
                  </span>
                  {QUICK_TOPICS.map((topic, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleQuickTopic(topic)}
                      className="quick-tag-chip"
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="feedback-textarea-container">
                  <textarea
                    id="user-feedback"
                    rows={5}
                    placeholder="Share specific observations, suggestions, or issues you encountered. What went well? What can we improve?"
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
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.message}</span>
                  </div>
                )}
              </div>

              {/* 6. Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="feedback-submit-btn"
              >
                {submitting ? (
                  <>
                    <span
                      className="spinner-border"
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>Dispatching Feedback & Alerting Wardens...</span>
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    <span>Submit Feedback & Receive Copy</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Highlights & Information Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Dual Dispatch Pipeline */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.07) 0%, rgba(124, 58, 237, 0.1) 100%)',
              border: '1px solid rgba(67, 97, 238, 0.25)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Mail size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Dual Email Notification
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Automated Real-Time Dispatch</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div className="feedback-step-node">
                <div className="feedback-step-icon">
                  <Send size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>1. Encrypted Submission</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Your feedback is timestamped and recorded in the central database.
                  </div>
                </div>
              </div>

              <div className="feedback-step-node">
                <div className="feedback-step-icon">
                  <Zap size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>2. Admin & Warden Alert</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    HostelCare management receives immediate priority email notifications.
                  </div>
                </div>
              </div>

              <div className="feedback-step-node">
                <div className="feedback-step-icon">
                  <Check size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>3. Your Inbox Receipt</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    You automatically receive a submission receipt copy for your personal records.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Channels & SLAs */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Target Review Timeline
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '12px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bug size={15} style={{ color: '#ef4444' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Bug & System Errors</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                  ⚡ &lt; 12h
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '12px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={15} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Facility & Amenities</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                  🛠️ ~24h
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '12px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={15} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Suggestions & Features</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '6px' }}>
                  💡 Weekly Sprint
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Student Voice Pledge */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '24px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <HeartHandshake size={22} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                Your Voice Shapes HostelCare
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Over 85% of recent interface updates and Wi-Fi optimisations were inspired directly by student feedback!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
