/**
 * Centralised status normalization utilities.
 * All status comparisons across dashboards must go through these helpers.
 *
 * Backend stores statuses inconsistently — e.g. "Pending", "inprogress", "resolved".
 * normalizeStatus converts any raw value into one of: 'pending' | 'inprogress' | 'resolved'
 */

export function normalizeStatus(status) {
  if (!status) return 'pending';
  const clean = status.trim().toLowerCase();
  if (clean === 'pending') return 'pending';
  // Fixed: was `clean === 'inprogress' || clean === 'inprogress'` (duplicate condition)
  if (clean === 'inprogress' || clean === 'in progress' || clean === 'in_progress') return 'inprogress';
  if (clean === 'resolved') return 'resolved';
  return clean;
}

/** Human-readable label for a raw status value */
export function getStatusLabel(status) {
  switch (normalizeStatus(status)) {
    case 'pending':    return 'Pending';
    case 'inprogress': return 'In Progress';
    case 'resolved':   return 'Resolved';
    default:           return status || 'Unknown';
  }
}

/** CSS class suffix for a raw status value */
export function getStatusClass(status) {
  switch (normalizeStatus(status)) {
    case 'pending':    return 'badge-pending';
    case 'inprogress': return 'badge-inprogress';
    case 'resolved':   return 'badge-resolved';
    default:           return '';
  }
}

/** Sort a complaints array by createdAt descending (newest first) */
export function sortByDateDesc(complaints) {
  return [...complaints].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

/** Returns true if the API error represents an empty dataset (backend returns 404 for no data) */
export function isEmptyDataError(err) {
  return err?.status === 404;
}
