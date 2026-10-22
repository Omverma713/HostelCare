import React from 'react';

/**
 * ResolutionRingGauge3D
 * Holographic circular progress gauge calculating live resolution rate and dispatch telemetry.
 */
export default function ResolutionRingGauge3D({ total = 0, pending = 0, inProgress = 0, resolved = 0 }) {
  const percentage = total > 0 ? Math.round((resolved / total) * 100) : 100;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="spatial-gauge-card" aria-label="3D Resolution Telemetry Gauge">
      <div className="spatial-gauge-topbar">
        <span className="spatial-live-pill pill-cyan">
          <span className="live-pulse-dot dot-cyan" /> TELEMETRY GAUGE
        </span>
        <span className="spatial-telemetry-ping">LIVE SYNC</span>
      </div>

      <div className="gauge-display-cluster">
        {/* Holographic Circular SVG Gauge */}
        <div className="gauge-svg-wrap">
          <svg className="gauge-circular-svg" viewBox="0 0 150 150">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Track Ring */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              className="gauge-track-ring"
              strokeWidth="11"
              fill="none"
            />

            {/* Glowing Active Progress Arc */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              className="gauge-progress-ring"
              stroke="url(#gaugeGrad)"
              strokeWidth="11"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              filter="url(#gaugeGlow)"
              transform="rotate(-90 75 75)"
            />
          </svg>

          {/* Central Holographic Percentage Readout */}
          <div className="gauge-center-content">
            <span className="gauge-pct-val">{percentage}%</span>
            <span className="gauge-pct-label">Resolved</span>
          </div>
        </div>

        {/* Telemetry Stats Column */}
        <div className="gauge-stats-column">
          <div className="gauge-stat-row">
            <span className="gauge-indicator-dot dot-pending" />
            <span className="gauge-stat-lbl">Pending Dispatch:</span>
            <span className="gauge-stat-num text-amber">{pending}</span>
          </div>

          <div className="gauge-stat-row">
            <span className="gauge-indicator-dot dot-progress" />
            <span className="gauge-stat-lbl">Underway:</span>
            <span className="gauge-stat-num text-blue">{inProgress}</span>
          </div>

          <div className="gauge-stat-row">
            <span className="gauge-indicator-dot dot-resolved" />
            <span className="gauge-stat-lbl">Completed:</span>
            <span className="gauge-stat-num text-emerald">{resolved}</span>
          </div>

          <div className="gauge-time-box">
            <span className="gauge-time-icon">⚡</span>
            <span className="gauge-time-text">&lt; 24h Average Dispatch</span>
          </div>
        </div>
      </div>
    </div>
  );
}
