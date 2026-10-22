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
  Eye,
  Edit3,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
  { 
    id: 'Suggestion', 
    label: 'Suggestion', 
    icon: Lightbulb, 
    desc: 'Ideas to improve portal',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.25)',
    hint: '💡 Pro-tip: Share the context behind your idea and how it benefits your hostel mates.'
  },
  { 
    id: 'Bug Report', 
    label: 'Bug Report', 
    icon: Bug, 
    desc: 'Glitches or broken items',
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.25)',
    hint: '🐞 Pro-tip: Mention the page, steps to reproduce, and your device or browser.'
  },
  { 
    id: 'Feature Request', 
    label: 'Feature Request', 
    icon: Sparkles, 
    desc: 'New tools or workflow',
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.25)',
    hint: '✨ Pro-tip: Describe the specific workflow or button you would love to see added.'
  },
  { 
    id: 'Hostel Experience', 
    label: 'Hostel Life', 
    icon: Building2, 
    desc: 'Amenities, mess, cleaning',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.25)',
    hint: '🏢 Pro-tip: Mention specific facilities, floor/block numbers, or meal times for fast resolution.'
  },
  { 
    id: 'App UI/UX', 
    label: 'App UI/UX', 
    icon: Palette, 
    desc: 'Design & usability',
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.25)',
    hint: '🎨 Pro-tip: Tell us which views feel cluttered or what would make navigation smoother.'
  },
  { 
    id: 'Other', 
    label: 'Other', 
    icon: MessageCircle, 
    desc: 'General thoughts',
    color: '#ec4899',
    glow: 'rgba(236, 72, 153, 0.25)',
    hint: '💬 Pro-tip: We appreciate any feedback that helps us improve the HostelCare community.'
  },
];

const RATING_CONFIG = {
  1: { 
    emoji: '😡', 
    label: 'Needs Major Attention', 
    badgeBg: 'rgba(239, 68, 68, 0.16)', 
    badgeColor: '#ef4444', 
    border: 'rgba(239, 68, 68, 0.4)',
    prompt: 'We apologize for the poor experience. Tell us what went wrong so we can fix it ASAP.'
  },
  2: { 
    emoji: '🙁', 
    label: 'Below Expectations', 
    badgeBg: 'rgba(249, 115, 22, 0.16)', 
    badgeColor: '#f97316', 
    border: 'rgba(249, 115, 22, 0.4)',
    prompt: 'What fell short of your expectations today? We are here to listen.'
  },
  3: { 
    emoji: '😐', 
    label: 'Average / Fair', 
    badgeBg: 'rgba(234, 179, 8, 0.16)', 
    badgeColor: '#eab308', 
    border: 'rgba(234, 179, 8, 0.4)',
    prompt: 'What can we fine-tune to turn this into a 5-star experience for you?'
  },
  4: { 
    emoji: '😊', 
    label: 'Very Good & Smooth', 
    badgeBg: 'rgba(16, 185, 129, 0.16)', 
    badgeColor: '#10b981', 
    border: 'rgba(16, 185, 129, 0.4)',
    prompt: 'Glad to hear! What went well, and are there any small polish items you would like?'
  },
  5: { 
    emoji: '🤩', 
    label: 'Outstanding Experience!', 
    badgeBg: 'rgba(99, 102, 241, 0.18)', 
    badgeColor: '#818cf8', 
    border: 'rgba(99, 102, 241, 0.45)',
    prompt: 'Awesome! We are thrilled! Tell us what you enjoyed most about HostelCare.'
  },
};

const QUICK_TOPICS = [
  { label: '📶 Wi-Fi & Internet', tag: 'Wi-Fi Stability' },
  { label: '🍲 Mess Quality', tag: 'Mess Food Quality' },
  { label: '🧹 Room Cleaning', tag: 'Cleaning & Hygiene' },
  { label: '🚰 Water Supply', tag: 'Water Supply' },
  { label: '⚡ Electricity', tag: 'Power & Electricity' },
  { label: '📱 Mobile Experience', tag: 'Mobile Usability' },
  { label: '🔔 Notification Alerts', tag: 'Realtime Alerts' },
  { label: '✨ New Feature Idea', tag: 'Feature Request' },
];

const FAQS = [
  {
    q: 'Will hostel wardens see my feedback?',
    a: 'Yes. Every verified submission triggers an automated priority email dispatch to the Chief Warden and administrative committee.'
  },
  {
    q: 'Do I get a confirmation copy?',
    a: 'Absolutely! You automatically receive an email receipt with a unique Tracking Reference ID for your records.'
  },
  {
    q: 'How quickly are bug reports reviewed?',
    a: 'Critical software bugs & system glitches are triaged by our engineering team within 12 hours.'
  },
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
  const [viewMode, setViewMode] = useState('compose'); // 'compose' | 'preview'
  const [showSparkles, setShowSparkles] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || user.registrationNumber || '');
      setEmail(user.email || '');
      setSubject(`Feedback from ${user.hostel || 'Hostel'} (${user.role || 'User'})`);
    }
  }, [user]);

  const handleRatingSelect = (star) => {
    setRating(star);
    if (star === 5) {
      setShowSparkles(true);
      setTimeout(() => setShowSparkles(false), 2000);
    }
  };

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
    setSubject((prev) => prev || `${topic.tag} Feedback`);
    setMessage((prev) => {
      const insertion = `[Topic: ${topic.tag}] `;
      if (prev.includes(insertion)) return prev;
      return prev ? `${prev}\n${insertion}` : insertion;
    });
    triggerToast('info', `Added topic "${topic.tag}"`);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      triggerToast('error', 'Please fill in all required fields accurately.');
      setViewMode('compose');
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
      const generatedRef = `HC-FB-${new Date().getFullYear()}-${randomCode}`;
      setReferenceId(generatedRef);
      setSubmitted(true);
      setShowSparkles(true);
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
    setViewMode('compose');
  }, []);

  const copyRefToClipboard = useCallback(() => {
    if (referenceId) {
      navigator.clipboard.writeText(referenceId);
      setCopiedRef(true);
      triggerToast('success', 'Reference ID copied to clipboard!');
      setTimeout(() => setCopiedRef(false), 2500);
    }
  }, [referenceId]);

  const activeRating = hoverRating || rating;
  const ratingDetails = useMemo(() => RATING_CONFIG[activeRating] || RATING_CONFIG[5], [activeRating]);
  const selectedCategoryObj = useMemo(() => CATEGORIES.find((c) => c.id === category) || CATEGORIES[0], [category]);

  // Quality / Depth score calculation
  const charLength = message.trim().length;
  const qualityScore = useMemo(() => {
    if (charLength === 0) return { percent: 0, label: 'Empty (Write feedback below)', color: '#94a3b8' };
    if (charLength < 10) return { percent: Math.min(25, (charLength / 10) * 25), label: `${10 - charLength} more chars needed`, color: '#ef4444' };
    if (charLength < 40) return { percent: 50, label: 'Good start · Add more details', color: '#f59e0b' };
    if (charLength < 100) return { percent: 80, label: 'Solid & Informative context', color: '#38bdf8' };
    return { percent: 100, label: '⭐ High Actionability & Rich Detail', color: '#10b981' };
  }, [charLength]);

  return (
    <div className="feedback-page-wrapper">
      {/* Background Ambient Glow Lights */}
      <div className="feedback-ambient-glow glow-1" />
      <div className="feedback-ambient-glow glow-2" />

      {/* Header Banner */}
      <div style={{ marginBottom: '28px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div className="feedback-badge-pill primary-pill">
            <Sparkles size={14} className="animate-pulse" />
            <span>Community Voice & Feedback Hub</span>
          </div>

          <div className="feedback-badge-pill status-pill">
            <span className="live-status-dot" />
            <span>Realtime Warden Dispatch Active</span>
          </div>

          <div className="feedback-badge-pill shield-pill">
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>Dual Email Delivery Guarantee</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="feedback-hero-title">
              Share Your Feedback & Suggestions
            </h1>
            <p className="feedback-hero-subtitle">
              Help us build a cleaner, smarter, and more reliable hostel experience. Every response directly alerts the hostel administration and warden committee.
            </p>
          </div>

          {/* Dynamic Community Stats Card */}
          <div className="feedback-quick-stats-bar">
            <div className="feedback-stat-item">
              <span className="feedback-stat-value">98.4%</span>
              <span className="feedback-stat-label">Resolution Rate</span>
            </div>
            <div className="feedback-stat-divider" />
            <div className="feedback-stat-item">
              <span className="feedback-stat-value" style={{ color: '#38bdf8' }}>⚡ &lt; 2h</span>
              <span className="feedback-stat-label">Avg Triage Time</span>
            </div>
            <div className="feedback-stat-divider" />
            <div className="feedback-stat-item">
              <span className="feedback-stat-value" style={{ color: '#a78bfa' }}>520+</span>
              <span className="feedback-stat-label">Ideas Implemented</span>
            </div>
          </div>
        </div>
      </div>

      <div className="feedback-page-grid">
        {/* Left Column: Form / Live Preview Card */}
        <div className="feedback-main-card">
          {submitted ? (
            /* Celebration Success View */
            <div style={{ textAlign: 'center', padding: '32px 12px', animation: 'scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              {showSparkles && <div className="celebration-sparkles-burst">✨ 🌟 🎉 💫 🌟 ✨</div>}
              <div className="feedback-success-icon-wrap">
                <CheckCircle2 size={48} />
              </div>

              <div className="feedback-ref-badge" onClick={copyRefToClipboard} title="Click to copy Reference ID">
                <span>REF #{referenceId}</span>
                {copiedRef ? <Check size={14} /> : <Copy size={14} />}
              </div>

              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                Thank You, {name}! 🎉
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 24px auto' }}>
                Your feedback has been successfully recorded in the central database and immediately dispatched to the Hostel Administration.
              </p>

              {/* Confirmation Email Receipt Card */}
              <div className="feedback-receipt-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                  <Mail size={18} />
                  <span>Dual Email Confirmation Dispatched</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5 }}>
                  A full copy of your submission details with Tracking ID has been delivered to{' '}
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
                    borderRadius: '14px',
                    fontWeight: 700,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
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
                    borderRadius: '14px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Card Header with View Switcher */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {viewMode === 'compose' ? 'Compose Your Feedback' : 'Live Warden Ticket Preview'}
                  </h2>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {viewMode === 'compose' ? 'Fill in your experience details below' : 'See how your ticket will appear to the warden committee'}
                  </span>
                </div>

                {/* Segmented View Mode Switcher */}
                <div className="feedback-segmented-switcher">
                  <button
                    type="button"
                    className={`segment-btn ${viewMode === 'compose' ? 'active' : ''}`}
                    onClick={() => setViewMode('compose')}
                  >
                    <Edit3 size={14} />
                    <span>Compose</span>
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${viewMode === 'preview' ? 'active' : ''}`}
                    onClick={() => setViewMode('preview')}
                  >
                    <Eye size={14} />
                    <span>Live Preview</span>
                  </button>
                </div>
              </div>

              {viewMode === 'preview' ? (
                /* Interactive Live Warden Preview View */
                <div className="feedback-preview-container">
                  <div className="preview-header-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="preview-ref-tag">PREVIEW-HC-{new Date().getFullYear()}-DEMO</span>
                      <span className="preview-priority-tag" style={{ background: (category === 'Bug Report' || rating <= 2) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: (category === 'Bug Report' || rating <= 2) ? '#ef4444' : '#818cf8' }}>
                        {(category === 'Bug Report' || rating <= 2) ? '⚡ Urgent Priority' : 'Normal Priority'}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status: Pending Triage</span>
                  </div>

                  <div className="preview-body">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="preview-avatar">
                          <User size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>{name || 'Student Name'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{email || 'student@example.com'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px' }}>{ratingDetails.emoji}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: ratingDetails.badgeColor }}>
                          {rating} / 5 Rating
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <span className="preview-cat-badge" style={{ borderColor: selectedCategoryObj.color, color: selectedCategoryObj.color }}>
                        {category}
                      </span>
                    </div>

                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {subject || 'No subject specified'}
                    </div>

                    <div className="preview-message-content">
                      {message.trim() ? message : <em style={{ color: 'var(--text-muted)' }}>No feedback description entered yet. Switch back to "Compose" to write your message.</em>}
                    </div>

                    <div className="preview-footer-note">
                      <Zap size={14} style={{ color: '#10b981' }} />
                      <span>Direct automated email dispatch will be sent to HostelCare Warden & Admin on submit.</span>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setViewMode('compose')}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSubmit}
                      className="btn btn-primary"
                      style={{
                        padding: '10px 24px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Send size={15} />
                      <span>Submit Now</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Form View */
                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {fieldErrors.form && (
                    <div className="feedback-error-banner">
                      <AlertCircle size={16} />
                      <span>{fieldErrors.form}</span>
                    </div>
                  )}

                  {/* 1. Interactive Rating Selector */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        How would you rate your overall experience? <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                    </div>

                    <div className="feedback-rating-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isActive = (hoverRating || rating) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRatingSelect(star)}
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

                      {/* Reactive Sentiment Badge */}
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
                          transition: 'all 0.25s ease',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{ratingDetails.emoji}</span>
                        <span>{ratingDetails.label}</span>
                      </div>
                    </div>

                    {/* Contextual guidance prompt based on rating */}
                    <div className="feedback-rating-prompt">
                      <span>{ratingDetails.prompt}</span>
                    </div>
                  </div>

                  {/* 2. Category Selector */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Select Category <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      {selectedCategoryObj && (
                        <span className="feedback-cat-desc-badge" style={{ color: selectedCategoryObj.color, borderColor: selectedCategoryObj.glow }}>
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
                            style={isSelected ? { borderColor: cat.color, boxShadow: `0 0 16px ${cat.glow}` } : {}}
                          >
                            <span className="feedback-category-icon-wrap" style={isSelected ? { color: '#ffffff' } : { color: cat.color }}>
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

                    {/* Dynamic Pro-tip helper box */}
                    {selectedCategoryObj.hint && (
                      <div className="feedback-hint-banner">
                        <Info size={14} style={{ color: selectedCategoryObj.color, flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: 1.4 }}>
                          {selectedCategoryObj.hint}
                        </span>
                      </div>
                    )}
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
                        <div className="feedback-field-error">
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
                        <div className="feedback-field-error">
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

                  {/* 5. Detailed Feedback & Quality Meter */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label htmlFor="user-feedback" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Your Detailed Feedback <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <span className={`feedback-char-badge ${charLength >= 10 ? 'valid' : 'invalid'}`}>
                        {charLength >= 10 ? (
                          <>
                            <Check size={12} strokeWidth={3} />
                            <span>{charLength} chars (Ready)</span>
                          </>
                        ) : (
                          <span>{charLength} / 10 min chars ({10 - charLength} more)</span>
                        )}
                      </span>
                    </div>

                    {/* Quick Topic Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '2px' }}>
                        Quick Tags:
                      </span>
                      {QUICK_TOPICS.map((topic, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleQuickTopic(topic)}
                          className="quick-tag-chip"
                        >
                          {topic.label}
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

                    {/* Live Detail / Quality Meter */}
                    <div className="feedback-quality-meter-wrap">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>Feedback Richness Score</span>
                        <span style={{ fontWeight: 800, color: qualityScore.color, letterSpacing: '-0.1px' }}>{qualityScore.label}</span>
                      </div>
                      <div className="feedback-quality-track">
                        <div
                          className="feedback-quality-fill"
                          style={{
                            width: `${qualityScore.percent}%`,
                            background: qualityScore.percent >= 80 ? 'linear-gradient(90deg, #38bdf8, #818cf8, #10b981)' : qualityScore.color,
                          }}
                        />
                      </div>
                    </div>

                    {fieldErrors.message && (
                      <div className="feedback-field-error">
                        <AlertCircle size={12} />
                        <span>{fieldErrors.message}</span>
                      </div>
                    )}
                  </div>

                  {/* 6. Submit Button & Live Preview Shortcut */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
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
                          <Send size={18} />
                          <span>Submit Feedback & Receive Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode('preview')}
                      className="feedback-preview-cta-btn"
                      title="Preview how this appears to the warden"
                    >
                      <Eye size={17} />
                      <span>Preview Ticket</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Highlights, SLAs & Interactive FAQs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Dual Dispatch Pipeline */}
          <div className="feedback-pipeline-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div className="pipeline-header-icon">
                <Mail size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Dual Email Notification
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Automated Real-Time Dispatch</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <div className="feedback-step-icon pulse-glow">
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
          <div className="feedback-sla-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Target Review Timeline
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="feedback-sla-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bug size={15} style={{ color: '#ef4444' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Bug & System Errors</span>
                </div>
                <span className="sla-tag-red">⚡ &lt; 12h</span>
              </div>

              <div className="feedback-sla-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={15} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Facility & Amenities</span>
                </div>
                <span className="sla-tag-amber">🛠️ ~24h</span>
              </div>

              <div className="feedback-sla-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={15} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Suggestions & Features</span>
                </div>
                <span className="sla-tag-blue">💡 Weekly Sprint</span>
              </div>
            </div>
          </div>

          {/* Card 3: Interactive FAQ Accordion */}
          <div className="feedback-faq-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <HelpCircle size={17} style={{ color: '#8b5cf6' }} />
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Frequently Asked Questions
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FAQS.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div key={idx} className="faq-accordion-item">
                    <button
                      type="button"
                      className="faq-accordion-header"
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                    >
                      <span>{faq.q}</span>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen && (
                      <div className="faq-accordion-content">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 4: Student Voice Pledge */}
          <div className="feedback-pledge-card">
            <div className="pledge-icon-wrap">
              <HeartHandshake size={22} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3px' }}>
                Your Voice Shapes HostelCare
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Over 85% of recent interface updates and Wi-Fi optimizations were inspired directly by student feedback!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
