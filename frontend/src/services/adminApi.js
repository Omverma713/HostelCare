const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://hostelcare-api.duckdns.org/api/v1' : '/api/v1');

async function adminRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

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
}

export const adminApi = {
  // System Overview
  getOverview() {
    return adminRequest('/superadmin/overview');
  },

  // User Directory & Profile
  getUsers({ page = 1, limit = 20, search = '', role = '', status = '', hostel = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    if (role && role !== 'all') params.append('role', role);
    if (status && status !== 'all') params.append('status', status);
    if (hostel && hostel !== 'all') params.append('hostel', hostel);
    return adminRequest(`/superadmin/users?${params.toString()}`);
  },

  getUserDetails(userId) {
    return adminRequest(`/superadmin/users/${userId}`);
  },

  updateUserProfile(userId, updateData) {
    return adminRequest(`/superadmin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  },

  updateUserDeviceLimit(userId, maxDevices) {
    return adminRequest(`/superadmin/users/${userId}/device-limit`, {
      method: 'PATCH',
      body: JSON.stringify({ maxDevices }),
    });
  },

  updateUserStatus(userId, { accountStatus, isActivated }) {
    return adminRequest(`/superadmin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ accountStatus, isActivated }),
    });
  },

  resetUserPassword(userId, newPassword, adminPassword) {
    return adminRequest(`/superadmin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword, adminPassword }),
    });
  },

  forceLogoutUser(userId) {
    return adminRequest(`/superadmin/users/${userId}/force-logout`, {
      method: 'POST',
    });
  },

  impersonateUser(userId) {
    return adminRequest(`/superadmin/users/${userId}/impersonate`, {
      method: 'POST',
    });
  },

  unlockUser(userId) {
    return adminRequest(`/superadmin/users/${userId}/unlock`, {
      method: 'POST',
    });
  },

  // Sessions & Devices
  getSessions({ page = 1, limit = 20, status = '', deviceType = '', search = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (status && status !== 'all') params.append('status', status);
    if (deviceType && deviceType !== 'all') params.append('deviceType', deviceType);
    if (search) params.append('search', search);
    return adminRequest(`/superadmin/sessions?${params.toString()}`);
  },

  revokeSession(sessionId) {
    return adminRequest(`/superadmin/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  // System Configuration & Login Limits
  getConfig() {
    return adminRequest('/superadmin/config');
  },

  updateConfig(configData) {
    return adminRequest('/superadmin/config', {
      method: 'PUT',
      body: JSON.stringify(configData),
    });
  },

  // Notification Center
  sendNotification(payload) {
    return adminRequest('/superadmin/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getNotificationHistory({ page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({ page, limit });
    return adminRequest(`/superadmin/notifications?${params.toString()}`);
  },

  // Audit Logs
  getAuditLogs({ page = 1, limit = 25, action = '', outcome = '', search = '', from = '', to = '' } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (action && action !== 'all') params.append('action', action);
    if (outcome && outcome !== 'all') params.append('outcome', outcome);
    if (search) params.append('search', search);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return adminRequest(`/superadmin/audit-logs?${params.toString()}`);
  },

  // Maintenance Management
  getMaintenanceConfig() {
    return adminRequest('/superadmin/maintenance');
  },

  updateMaintenanceConfig(maintenanceData) {
    return adminRequest('/superadmin/maintenance', {
      method: 'PUT',
      body: JSON.stringify(maintenanceData),
    });
  },

  // App Version & Update Management
  getAppVersionConfig() {
    return adminRequest('/superadmin/app-version');
  },

  updateAppVersionConfig(versionData) {
    return adminRequest('/superadmin/app-version', {
      method: 'PUT',
      body: JSON.stringify(versionData),
    });
  },

  deleteAppRelease() {
    return adminRequest('/superadmin/app-version/release', {
      method: 'DELETE',
    });
  },

  deletePilotRelease() {
    return adminRequest('/superadmin/pilot-testing/release', {
      method: 'DELETE',
    });
  },

  testPilotUserEligibility(registrationNumber) {
    return adminRequest('/superadmin/pilot-testing/test-user', {
      method: 'POST',
      body: JSON.stringify({ registrationNumber }),
    });
  },

  // Mess Auto-Notification Schedule & Test Engine
  getMessNotificationSchedule() {
    return adminRequest('/superadmin/mess-notifications');
  },

  updateMessNotificationSchedule(payload) {
    return adminRequest('/superadmin/mess-notifications', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  testMessNotificationBroadcast(payload) {
    return adminRequest('/superadmin/mess-notifications/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
