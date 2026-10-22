import React from 'react';
import { getStatusLabel, getStatusClass, normalizeStatus } from '../utils/status';

/**
 * Reusable Modern 3D Status Badge Component
 */
export default function Badge({ status }) {
  const label = getStatusLabel(status);
  const cls   = getStatusClass(status);
  const norm  = normalizeStatus(status);

  return (
    <span className={`badge ${cls} badge-3d`}>
      <span className={`badge-dot badge-dot-${norm}`} />
      <span className="badge-text">{label}</span>
    </span>
  );
}
