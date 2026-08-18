/** All departments supported by the complaint system (must match backend enum) */
export const DEPARTMENTS = [
  'Electrical',
  'Plumbing',
  'Carpentry',
  'Civil',
  'Cleaning',
  'Mess',
  'Internet',
  'Water',
  'Furniture',
  'Security',
  'Medical',
  'Others',
];

/** Complaint status options for filter dropdowns and update forms */
export const STATUS_OPTIONS = [
  { value: 'pending',    label: 'Pending' },
  { value: 'inprogress', label: 'In Progress' },
  { value: 'resolved',   label: 'Resolved' },
];

/** Roles that have administrative access (non-student) */
export const ADMIN_ROLES = ['caretaker', 'warden', 'superintendent', 'chiefHostelWarden'];

/** All supported application roles */
export const ALL_ROLES = ['student', 'caretaker', 'warden', 'superintendent'];

/** Role display names for UI labels */
export const ROLE_LABELS = {
  student:        'Student',
  caretaker:      'Caretaker',
  warden:         'Warden',
  superintendent: 'Superintendent',
};
