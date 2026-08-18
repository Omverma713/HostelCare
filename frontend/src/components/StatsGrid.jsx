import React from 'react';

/**
 * Data-driven stats cards grid.
 *
 * Each dashboard passes its own stats array so this component stays generic.
 *
 * @param {Array} stats - Array of { label, value, icon, bgColor, textColor }
 * @param {boolean} loading - Show '...' placeholders while data loads
 */
export default function StatsGrid({ stats, loading = false }) {
  return (
    <div className="stats-grid">
      {stats.map(({ label, value, icon, bgColor, textColor }) => (
        <div className="stat-card" key={label}>
          <div className="stat-icon" style={{ backgroundColor: bgColor, color: textColor }}>
            {icon}
          </div>
          <div className="stat-info">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{loading ? '…' : value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
