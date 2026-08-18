import React from 'react';
import { getStatusLabel, getStatusClass } from '../utils/status';

/**
 * Reusable Status Badge Component
 */
export default function Badge({ status }) {
  const label = getStatusLabel(status);
  const cls   = getStatusClass(status);
  return <span className={`badge ${cls}`}>{label}</span>;
}
