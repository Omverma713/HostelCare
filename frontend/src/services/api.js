/**
 * Centralised API Service Layer
 *
 * All HTTP communication goes through this module.
 * Authorization token injection and 401 handling are centralised here.
 */

// Re-export utilities from their canonical locations for backward compatibility.
// New code should import directly from 'utils/status' or 'constants'.
export { normalizeStatus } from '../utils/status';
export { DEPARTMENTS } from '../constants';

const API_BASE = 'https://hostelcare-9od3.onrender.com/api/v1';

/**
 * Generic request helper with automatic JWT injection and 401 handling.
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    let data = {};
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { success: response.ok, message: text };
    }

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent('auth-session-expired'));
      }
      const error = new Error(data.message || `HTTP error ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (!error.status) {
      error.status = 500;
      error.message = error.message || 'Network error. Please try again.';
    }
    throw error;
  }
}

export const api = {
  // --- AUTHENTICATION ---
  login(registrationNumber, password) {
    return request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ registrationNumber, password }),
    });
  },

  activate(registrationNumber, hostel, roomNumber, newPassword, confirmPassword) {
    return request('/users/activate', {
      method: 'POST',
      body: JSON.stringify({ registrationNumber, hostel, roomNumber, newPassword, confirmPassword }),
    });
  },

  // --- STUDENT ---
  getStudentComplaints() {
    return request('/users/hostel-complaints');
  },

  createComplaint(department, description) {
    return request('/users/complaints', {
      method: 'POST',
      body: JSON.stringify({ department, description }),
    });
  },

  // --- CARETAKER / WARDEN ---
  getHostelComplaints() {
    return request('/users/caretaker/complaints');
  },

  updateComplaint(id, status, description) {
    return request(`/users/update-complaint/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, description }),
    });
  },

  // --- WARDEN ---
  getWardenDashboard() {
    return request('/users/warden/dashboard');
  },

  // --- SUPERINTENDENT ---
  getSuperintendentDashboard() {
    return request('/complaints/superintendent/dashboard');
  },

  getStaffPerformance() {
    return request('/users/superintendent/staff-performance');
  },

  // --- SHARED ---
  getComplaintById(complaintId) {
    return request(`/complaints/Allcomplaints/${complaintId}`);
  },

  getComplaintsByStatus(status) {
    return request(`/complaints/status/${status}`);
  },

  getAllComplaints() {
    return request('/complaints/Allcomplaints');
  },
};
