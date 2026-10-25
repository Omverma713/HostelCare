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

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://hostelcare-api.duckdns.org/api/v1' : '/api/v1');

/**
 * Generic request helper with automatic JWT injection and 401 handling.
 */
function getInstallationId() {
  try {
    let id = localStorage.getItem('hostelcare_device_install_id');
    if (!id) {
      id = 'inst_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      localStorage.setItem('hostelcare_device_install_id', id);
    }
    return id;
  } catch {
    return null;
  }
}

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
        // Only trigger session expired logout for authenticated calls, NOT for wrong password on /users/login
        if (!endpoint.includes('/users/login') && !endpoint.includes('/users/activate')) {
          localStorage.removeItem('token');
          window.dispatchEvent(new CustomEvent('auth-session-expired'));
        }
      }
      if (response.status === 503 && data.code === 'MAINTENANCE_MODE_ACTIVE') {
        window.dispatchEvent(new CustomEvent('maintenance-mode-active', { detail: data.maintenance }));
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
  login(registrationNumber, password, extra = {}) {
    const installationId = getInstallationId();
    return request('/users/login', {
      method: 'POST',
      body: JSON.stringify({
        registrationNumber,
        password,
        installationId,
        ...extra,
      }),
    });
  },

  activate(registrationNumber, hostel, roomNumber, newPassword, confirmPassword, activationToken) {
    return request('/users/activate', {
      method: 'POST',
      body: JSON.stringify({ registrationNumber, hostel, roomNumber, newPassword, confirmPassword, activationToken }),
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

  // --- FEEDBACK ---
  submitFeedback(feedbackData) {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    });
  },

  getAllFeedback() {
    return request('/feedback');
  },

  // --- SYSTEM MAINTENANCE ---
  getMaintenanceStatus() {
    return request('/maintenance/status');
  },

  // --- PUSH NOTIFICATIONS ---
  registerPushToken(pushToken, provider = 'fcm') {
    return request('/users/register-push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken, provider }),
    });
  },

  // --- MESS MENU (OFFLINE-FIRST & STAFF MANAGED) ---
  async getMessMenu() {
    try {
      const res = await request('/public/mess-menu');
      if (res?.success && res.menu) {
        try {
          localStorage.setItem('hostelcare_cached_mess_menu', JSON.stringify({
            menu: res.menu,
            cachedAt: new Date().toISOString(),
          }));
        } catch (_) {}
        return { ...res, source: 'live' };
      }
      throw new Error('Invalid mess menu response');
    } catch (err) {
      // Fallback: check localStorage cached menu
      try {
        const cachedRaw = localStorage.getItem('hostelcare_cached_mess_menu');
        if (cachedRaw) {
          const cachedParsed = JSON.parse(cachedRaw);
          const menu = cachedParsed.menu || (cachedParsed.schedule ? cachedParsed : null);
          const cachedAt = cachedParsed.cachedAt || null;
          if (menu) {
            return { success: true, menu, fromCache: true, cachedAt, source: 'cache' };
          }
        }
      } catch (_) {}
      // Fallback: return bundled default official menu
      const { DEFAULT_MESS_DATA } = await import('../constants/messMenuData');
      return { success: true, menu: DEFAULT_MESS_DATA, isOfflineFallback: true, source: 'default' };
    }
  },

  updateMessMenu(menuPayload) {
    return request('/mess-menu', {
      method: 'PUT',
      body: JSON.stringify(menuPayload),
    });
  },

  resetMessMenu() {
    return request('/mess-menu/reset', {
      method: 'POST',
    });
  },

  // Public & Client Mess Auto-Notification Schedule
  async getPublicMessNotificationSchedule() {
    try {
      const res = await request('/public/mess-notifications');
      if (res?.success) {
        try {
          localStorage.setItem('hostelcare_cached_mess_schedule', JSON.stringify({
            config: res.config,
            cachedAt: new Date().toISOString(),
          }));
        } catch (_) {}
        return res;
      }
      throw new Error('Invalid mess notification schedule response');
    } catch (err) {
      try {
        const raw = localStorage.getItem('hostelcare_cached_mess_schedule');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.config) return { success: true, config: parsed.config, fromCache: true };
        }
      } catch (_) {}
      return { success: false, error: err.message };
    }
  },

  // Super Admin Mess Auto-Notification Schedule & Test Engine
  getMessNotificationSchedule() {
    return request('/superadmin/mess-notifications');
  },

  updateMessNotificationSchedule(payload) {
    return request('/superadmin/mess-notifications', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  testMessNotificationBroadcast(payload) {
    return request('/superadmin/mess-notifications/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ─── Real-Time Student <-> Developer Chat Tickets (E2EE) ────────────────
  createChatTicket(payload) {
    return request('/chat/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getChatTickets(params = {}) {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request(`/chat/tickets${queryStr}`);
  },

  getChatTicketById(ticketId) {
    return request(`/chat/tickets/${ticketId}`);
  },

  getChatTicketMessages(ticketId) {
    return request(`/chat/tickets/${ticketId}/messages`);
  },

  sendChatTicketMessage(ticketId, payload) {
    return request(`/chat/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateChatTicketStatus(ticketId, status) {
    return request(`/chat/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  rateChatTicket(ticketId, ratingData) {
    return request(`/chat/tickets/${ticketId}/rating`, {
      method: 'POST',
      body: JSON.stringify(ratingData),
    });
  },
};

