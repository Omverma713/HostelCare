import React from 'react';
import { DEPARTMENTS, STATUS_OPTIONS } from '../constants';

/**
 * Shared complaint filter bar.
 * Used by CaretakerDashboard and WardenDashboard (and any future staff dashboard).
 *
 * @param {string}   statusFilter    - Current status filter value
 * @param {string}   deptFilter      - Current department filter value
 * @param {string}   searchTerm      - Current search input value
 * @param {Function} onStatusChange  - Called with new status value
 * @param {Function} onDeptChange    - Called with new department value
 * @param {Function} onSearchChange  - Called with new search term
 * @param {string}   title           - Optional heading above filters
 */
export default function ComplaintFilters({
  statusFilter,
  deptFilter,
  searchTerm,
  onStatusChange,
  onDeptChange,
  onSearchChange,
  title = 'Filter Complaints',
}) {
  return (
    <div className="table-container" style={{ padding: '20px', marginBottom: '20px' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="cf-status">Status</label>
          <select
            id="cf-status"
            className="form-input"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="cf-dept">Category</label>
          <select
            id="cf-dept"
            className="form-input"
            value={deptFilter}
            onChange={(e) => onDeptChange(e.target.value)}
          >
            <option value="">All Categories</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="cf-search">Search</label>
          <input
            id="cf-search"
            type="text"
            className="form-input"
            placeholder="Search by student, room, issue…"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
