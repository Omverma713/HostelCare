import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { triggerToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
  { id: 'Suggestion', label: '💡 Suggestion', desc: 'Ideas to improve the portal' },
  { id: 'Bug Report', label: '🐛 Bug Report', desc: 'Issue or bug encounter' },
  { id: 'Feature Request', label: '✨ Feature Request', desc: 'New feature idea' },
  { id: 'Hostel Experience', label: '🏢 Hostel Experience', desc: 'Hostel amenities/food/rooms' },
  { id: 'App UI/UX', label: '🎨 App UI/UX', desc: 'Interface design and usability' },
  { id: 'Other', label: '💬 Other', desc: 'General queries and opinions' },
];

const RATING_LABELS = {
  1: '⭐ Needs Major Improvement',
  2: '⭐⭐ Below Average',
  3: '⭐⭐⭐ Good / Average',
  4: '⭐⭐⭐⭐ Very Good',
  5: '⭐⭐⭐⭐⭐ Outstanding Experience',
};

export default function FeedbackPage() {
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

  useEffect(() => {
    if (user) {
      setName(user.name || user.registrationNumber || '');
      setSubject(`Feedback from ${user.hostel || 'Hostel'} (${user.role || 'User'})`);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!message.trim() || message.trim().length < 10) {
      setErrorMsg('Please write at least 10 characters in your message.');
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

      await api.submitFeedback(payload);
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

  const handleReset = () => {
    setMessage('');
    setSubject('');
    setSubmitted(false);
    setErrorMsg('');
  };

  return (
    <div className="feedback-page-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header section */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--primary-light)', padding: '6px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>
          <span>💬</span>
          <span>We are listening to your voice</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
          Share Your Feedback & Suggestions
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>
          Help us build a cleaner, smarter, and more reliable hostel experience. We read and review every response.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '28px', alignItems: 'start' }}>
        {/* Left column: Feedback Form Card */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '32px 12px' }}>
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  boxShadow: '0 12px 28px rgba(16, 185, 129, 0.35)',
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                Thank You, {name}!
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 24px auto' }}>
                Your feedback has been successfully submitted and forwarded to our hostel administration.
              </p>

              <div
                style={{
                  background: 'var(--primary-light)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '18px',
                  textAlign: 'left',
                  fontSize: '14px',
                  marginBottom: '28px',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                  📬 Confirmation Sent as a Visitor/User
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  A confirmation receipt containing the full copy of your submission has been delivered to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="btn btn-primary"
                style={{ padding: '12px 28px', borderRadius: '12px', fontWeight: 700 }}
              >
                Submit Another Response
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {errorMsg && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Satisfaction rating */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  How would you rate your experience? *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: '32px',
                          cursor: 'pointer',
                          color: active ? '#f59e0b' : 'var(--text-muted)',
                          transform: active ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.15s ease, color 0.15s ease',
                          padding: '2px',
                        }}
                        aria-label={`${star} star`}
                      >
                        ★
                      </button>
                    );
                  })}
                  <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {RATING_LABELS[hoverRating || rating]}
                  </span>
                </div>
              </div>

              {/* Category tags */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Select Category *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '9999px',
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
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

              {/* Name & Email grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label htmlFor="p-name" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Your Name *
                  </label>
                  <input
                    id="p-name"
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="p-email" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Your Email Address *
                  </label>
                  <input
                    id="p-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="p-subject" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Subject
                </label>
                <input
                  id="p-subject"
                  type="text"
                  placeholder="Summary of what you'd like to share"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="p-msg" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Your Detailed Feedback *
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {message.length} chars
                  </span>
                </div>
                <textarea
                  id="p-msg"
                  rows={5}
                  required
                  placeholder="Share details, suggestions, or specific observations..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  padding: '14px 24px',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: '0 6px 20px rgba(99, 102, 241, 0.35)',
                }}
              >
                {submitting ? '✉️ Submitting & Dispatching Email...' : '🚀 Submit Feedback & Receive Copy'}
              </button>
            </form>
          )}
        </div>

        {/* Right column: Highlights and info cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Email guarantee */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.12) 100%)',
              border: '1px solid var(--primary-glow)',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
            <div style={{ fontSize: '26px', marginBottom: '10px' }}>✉️</div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Dual Email Notification
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Whenever feedback is sent, the HostelCare administration receives immediate email alerts, and you automatically get a visitor/user confirmation copy in your inbox!
            </p>
          </div>

          {/* Card 2: Transparency & Impact */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 14px 0', color: 'var(--text-primary)' }}>
              💡 Feedback Channels
            </h3>
            <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.8 }}>
              <li><strong>Suggestions:</strong> Ideas for new hostel features & app workflow.</li>
              <li><strong>UI/UX feedback:</strong> Design and usability improvement recommendations.</li>
              <li><strong>Facility queries:</strong> Hostels, Wi-Fi, electricity, plumbing feedback.</li>
              <li><strong>Bug reports:</strong> Platform crashes, form errors, or edge cases.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
