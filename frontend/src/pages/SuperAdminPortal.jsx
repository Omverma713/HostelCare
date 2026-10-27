import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminApi } from '../services/adminApi';
import { appUpdateService } from '../services/appUpdateService';
import { triggerToast } from '../components/Toast';
import { scheduleWeeklyMealReminders } from '../services/messNotificationService';
import { DEFAULT_MESS_DATA, DAYS_ORDER, MEAL_SLOTS } from '../constants/messMenuData';
import './SuperAdminPortal.css';

export const DELEGATION_FEATURE_MODULES = [
  { id: 'messalerts', label: '🍱 Mess Auto-Alerts & Timetable', desc: 'Meal timings, lead-times, vacation freeze & auto-cron dispatcher' },
  { id: 'notifications', label: '🔔 Push Broadcasts & Flash Alerts', desc: 'Custom push broadcasts, flash messages & emergency banners' },
  { id: 'users', label: '👥 User Directory & Accounts', desc: 'User management, profile edits, password resets, locks & account flush' },
  { id: 'sessions', label: '📱 Sessions & Device Registry', desc: 'Hardware radar, active devices, 1-click ping, mute & unregister' },
  { id: 'notices', label: '🚨 Global Notices', desc: 'Campus-wide emergency and announcement notice board' },
  { id: 'maintenance', label: '🛠️ Maintenance Mode', desc: 'Campus system maintenance toggle and countdown controls' },
  { id: 'limits', label: '⚙️ Login Limits & Policies', desc: 'Session concurrency, failed login lockouts & token lifespans' },
  { id: 'appversion', label: '📲 App Updates & APK Release', desc: 'Mandatory app update enforcement and direct APK downloads' },
  { id: 'pilottesting', label: '🧪 Pilot Testing & Testers', desc: 'Pilot user enrollment and staged feature rollout checks' },
  { id: 'audit', label: '📜 Security Audit Logs', desc: 'Comprehensive administrative action history and audit trails' },
  { id: 'overview', label: '📊 System Analytics & KPIs', desc: 'Live statistics, active device counters and system health' },
];

export const ALL_PORTAL_TABS = [
  { id: 'overview', label: '📊 Overview', scope: 'overview' },
  { id: 'users', label: '👥 User Directory', scope: 'users' },
  { id: 'delegations', label: '👑 Sub-Admin Delegation', masterOnly: true },
  { id: 'notices', label: '🚨 Global Notices', scope: 'notices' },
  { id: 'sessions', label: '📱 Sessions & Devices', scope: 'sessions' },
  { id: 'limits', label: '⚙️ Login Limits', scope: 'limits' },
  { id: 'maintenance', label: '🛠️ Maintenance', scope: 'maintenance' },
  { id: 'appversion', label: '📲 App Updates', scope: 'appversion' },
  { id: 'pilottesting', label: '🧪 Pilot Testing', scope: 'pilottesting' },
  { id: 'notifications', label: '🔔 Push Broadcast', scope: 'notifications' },
  { id: 'messalerts', label: '🍱 Mess Auto-Alerts', scope: 'messalerts' },
  { id: 'audit', label: '📜 Audit Logs', scope: 'audit' },
];

export const DEFAULT_DELEGATION_FORM = {
  userId: '',
  targetUserName: '',
  targetUserRegNo: '',
  title: 'Acting Sub-Admin',
  durationMode: 'indefinite',
  customExpiresAt: '',
  scopeMode: 'all',
  selectedScopes: ['all'],
  notes: '',
};

export default function SuperAdminPortal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user: currentUser, setDirectToken } = useAuth();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
  const [loading, setLoading] = useState(false);

  // Overview State
  const [overview, setOverview] = useState(null);

  // Users Directory State
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [userFilters, setUserFilters] = useState({ search: '', role: 'all', status: 'all', hostel: 'all' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [editUserData, setEditUserData] = useState({ name: '', email: '', registrationNumber: '', role: '', hostel: '', roomNumber: '', newPassword: '' });
  const [resetPasswordModal, setResetPasswordModal] = useState({ open: false, userId: null, newPassword: '', adminPassword: '' });
  const [lockedUsersCount, setLockedUsersCount] = useState(0);
  const [flushingUser, setFlushingUser] = useState(false);

  // Super Admin Self-Profile State
  const [isMyProfileModalOpen, setIsMyProfileModalOpen] = useState(false);
  const [myProfileData, setMyProfileData] = useState({
    name: '',
    email: '',
    registrationNumber: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loadingMyProfile, setLoadingMyProfile] = useState(false);
  const [savingMyProfile, setSavingMyProfile] = useState(false);

  // Temporary Sub-Admin Delegation State
  const [delegationsList, setDelegationsList] = useState([]);
  const [delegationsStats, setDelegationsStats] = useState({ total: 0, active: 0, indefinite: 0 });
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  const [isCreateDelegationModalOpen, setIsCreateDelegationModalOpen] = useState(false);
  const [delegationFormData, setDelegationFormData] = useState(DEFAULT_DELEGATION_FORM);
  const [submittingDelegation, setSubmittingDelegation] = useState(false);
  const [delegationUserSearch, setDelegationUserSearch] = useState('');
  const [delegationSearchResults, setDelegationSearchResults] = useState([]);
  const [searchingDelegationUsers, setSearchingDelegationUsers] = useState(false);
  const [editingDelegationScopes, setEditingDelegationScopes] = useState(null);
  const [savingDelegationScopes, setSavingDelegationScopes] = useState(false);

  // User Provisioning State (Immediate vs Pending Activation)
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    name: '',
    registrationNumber: '',
    role: 'student',
    hostel: 'BH-1',
    roomNumber: '',
    email: '',
    activateImmediately: true,
    password: '',
    adminPassword: '',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Computed Role & Scopes
  const isMasterSuperAdmin = currentUser?.role === 'superadmin' && !currentUser?.isDelegatedSubAdmin;
  const isDelegatedSubAdmin = Boolean(currentUser?.isDelegatedSubAdmin);
  const userScopes = Array.isArray(currentUser?.delegationScopes) && currentUser.delegationScopes.length > 0
    ? currentUser.delegationScopes
    : (isMasterSuperAdmin ? ['all'] : []);

  const hasScope = useCallback((scopeId) => {
    if (isMasterSuperAdmin) return true;
    if (!isDelegatedSubAdmin) return false;
    if (userScopes.includes('all')) return true;
    return userScopes.includes(scopeId);
  }, [isMasterSuperAdmin, isDelegatedSubAdmin, userScopes]);

  const visibleTabs = useMemo(() => {
    return ALL_PORTAL_TABS.filter((tab) => {
      if (tab.masterOnly) return isMasterSuperAdmin;
      return hasScope(tab.scope);
    });
  }, [isMasterSuperAdmin, hasScope]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    if (searchParams.get('action') === 'create') {
      setCreateUserModalOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('action');
        return next;
      }, { replace: true });
    }
  }, [searchParams, activeTab, setSearchParams]);

  // Clamp active tab to allowed scopes
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      handleTabChange(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab, handleTabChange]);

  // Escape key handler to close user details modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedUser) {
        setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser]);

  // Global Notices State
  const [notices, setNotices] = useState([]);
  const [newNotice, setNewNotice] = useState({ title: '', message: '', priority: 'urgent', targetRole: 'ALL' });
  const [publishingNotice, setPublishingNotice] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [sessionPagination, setSessionPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [sessionFilters, setSessionFilters] = useState({ status: 'active', deviceType: 'all', search: '' });

  // System Configuration State
  const [config, setConfig] = useState({
    maxConcurrentSessions: 5,
    maxRegisteredDevices: 10,
    requireDeviceApproval: false,
    revokeOldestOnLimit: true,
    sessionInactivityTimeoutMinutes: 43200,
    failedLoginThreshold: 5,
    lockoutDurationMinutes: 15,
    jwtLifespanDays: 90,
  });

  const handleImpersonateUser = async (targetUser) => {
    if (!targetUser) return;
    const targetId = targetUser._id || targetUser.id;
    const confirmMsg = `Are you sure you want to log in as ${targetUser.name} (${targetUser.role})? You will be switched to their portal with an instant one-click return option.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const res = await adminApi.impersonateUser(targetId);
      if (res && res.token) {
        const currentToken = token || localStorage.getItem('token');
        localStorage.setItem('hostelcare_impersonate_backup', currentToken);
        localStorage.setItem('token', res.token);
        triggerToast('success', `Switched session to ${targetUser.name} (${targetUser.role})`, 'Impersonation Active');

        const role = targetUser.role;
        const targetRoute =
          role === 'student'
            ? '/student'
            : role === 'caretaker'
            ? '/caretaker'
            : role === 'warden'
            ? '/warden'
            : role === 'superintendent'
            ? '/superintendent'
            : '/';

        window.location.replace(targetRoute);
      } else {
        throw new Error(res.message || 'Failed to switch user');
      }
    } catch (err) {
      console.error('Impersonation error:', err);
      triggerToast('error', err.message || 'Could not log in as user', 'Impersonation Failed');
    } finally {
      setLoading(false);
    }
  };
  const [savingConfig, setSavingConfig] = useState(false);

  // Notification Center State
  const [notifyForm, setNotifyForm] = useState({
    title: '',
    body: '',
    imageUrl: '',
    targetAudience: 'ALL_DEVICES',
    targetCriteria: { sessionId: '', registrationNumber: '', role: 'student', hostel: 'BH-1' },
    route: '/',
  });
  const [campaigns, setCampaigns] = useState([]);
  const [sendingNotify, setSendingNotify] = useState(false);

  // Mess Auto-Notification Schedule & Test State
  const [messAlertConfig, setMessAlertConfig] = useState({
    enabled: true,
    alertCountPerMeal: 1,
    dayModeOverride: 'auto',
    frequencies: {
      breakfast: 1,
      lunch: 1,
      snacks: 1,
      dinner: 1,
    },
    workingDays: {
      breakfast: { startHour: 7, startMinute: 0, timing: '07:00 AM – 09:15 AM' },
      lunch:     { startHour: 12, startMinute: 30, timing: '12:30 PM – 02:30 PM' },
      snacks:    { startHour: 17, startMinute: 45, timing: '05:45 PM – 07:30 PM' },
      dinner:    { startHour: 20, startMinute: 30, timing: '08:30 PM – 10:00 PM' },
    },
    sundayAndHolidays: {
      breakfast: { startHour: 8, startMinute: 0, timing: '08:00 AM – 10:00 AM' },
      lunch:     { startHour: 12, startMinute: 30, timing: '12:30 PM – 02:30 PM' },
      snacks:    { startHour: 17, startMinute: 30, timing: '05:30 PM – 07:00 PM' },
      dinner:    { startHour: 20, startMinute: 30, timing: '08:30 PM – 10:00 PM' },
    },
  });

  const [dayModeInfo, setDayModeInfo] = useState(null);
  const [togglingDayMode, setTogglingDayMode] = useState(false);

  // Food Menu Editor Modal State
  const [isFoodEditorModalOpen, setIsFoodEditorModalOpen] = useState(false);
  const [foodMenuData, setFoodMenuData] = useState(null);
  const [foodEditorDay, setFoodEditorDay] = useState('monday');
  const [foodEditorSlot, setFoodEditorSlot] = useState('lunch');
  const [foodItemsList, setFoodItemsList] = useState([]);
  const [newDishInput, setNewDishInput] = useState('');
  const [foodTimingInput, setFoodTimingInput] = useState('');
  const [foodBulkMode, setFoodBulkMode] = useState(false);
  const [foodBulkText, setFoodBulkText] = useState('');
  const [savingFoodMenu, setSavingFoodMenu] = useState(false);
  const [loadingFoodMenu, setLoadingFoodMenu] = useState(false);

  const [messAlertTelemetry, setMessAlertTelemetry] = useState({
    serverTime: null,
    activePushSessionsCount: 0,
  });
  const [savingMessAlerts, setSavingMessAlerts] = useState(false);
  const [todayDispatches, setTodayDispatches] = useState([]);
  const [purgingDispatches, setPurgingDispatches] = useState(false);
  const [testSlotKey, setTestSlotKey] = useState('breakfast');
  const [testingMessAlert, setTestingMessAlert] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState(null);
  const [scheduleDayTab, setScheduleDayTab] = useState('working'); // 'working' | 'sunday'

  // Device Registry & Granular Single-Student Controls State
  const [deviceRegistryList, setDeviceRegistryList] = useState([]);
  const [deviceRegistryPagination, setDeviceRegistryPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [deviceBlockFilter, setDeviceBlockFilter] = useState('');
  const [loadingDeviceRegistry, setLoadingDeviceRegistry] = useState(false);
  const [pingingDeviceId, setPingingDeviceId] = useState(null);
  const [mutingDeviceId, setMutingDeviceId] = useState(null);

  // Custom / Emergency Mess Announcement State
  const [customAnnouncementTitle, setCustomAnnouncementTitle] = useState('');
  const [customAnnouncementBody, setCustomAnnouncementBody] = useState('');
  const [customAnnouncementImage, setCustomAnnouncementImage] = useState('');
  const [customAnnouncementTargetBlock, setCustomAnnouncementTargetBlock] = useState('all');
  const [broadcastingCustomAlert, setBroadcastingCustomAlert] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [auditFilters, setAuditFilters] = useState({ action: 'all', outcome: 'all', search: '' });

  // Maintenance Management State
  const [maintenanceConfig, setMaintenanceConfig] = useState({
    global: {
      enabled: false,
      title: 'System Maintenance in Progress',
      message: 'HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.',
      plannedStart: '',
      plannedEnd: '',
    },
    selective: {
      enabled: false,
      title: 'Service Temporarily Unavailable',
      message: 'Access for your account or user group is currently paused for scheduled system maintenance.',
      affectedRoles: ['student'],
      affectedRegistrationNumbers: [],
      plannedStart: '',
      plannedEnd: '',
    },
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [confirmGlobalModal, setConfirmGlobalModal] = useState(false);
  const [targetRegInput, setTargetRegInput] = useState('');

  // App Version State
  const [appVersionConfig, setAppVersionConfig] = useState({
    latestVersion: '1.2.2.11',
    minimumSupportedVersion: '1.0.0',
    updateMessage: '',
    updateUrl: 'https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.11/hostelcare-v1.2.2.11.apk',
    forceUpdate: false,
    isSuspended: false,
    suspendedReason: '',
    releaseNotes: '',
    releaseMedia: [],
    apkSha256: '',
    targetAudience: 'all',
    targetedRegistrationNumbers: [],
    targetedRoles: [],
    targetedHostels: [],
  });
  const [appMediaInput, setAppMediaInput] = useState('');
  const appMediaFileInputRef = useRef(null);
  const [targetUserSearch, setTargetUserSearch] = useState('');
  const [targetUserSearchResults, setTargetUserSearchResults] = useState([]);
  const [searchingTargetUsers, setSearchingTargetUsers] = useState(false);
  const [targetManualReg, setTargetManualReg] = useState('');
  const [savingAppVersion, setSavingAppVersion] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const [manualCheckResult, setManualCheckResult] = useState(null);
  const [installedAppVersion, setInstalledAppVersion] = useState('1.1.0');

  // Dedicated Pilot Testing State
  const [pilotConfig, setPilotConfig] = useState({
    enabled: true,
    isSuspended: false,
    suspendedReason: '',
    version: '1.2.2.11',
    updateUrl: 'https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.11/hostelcare-v1.2.2.11.apk',
    updateMessage: 'You have been selected for the HostelCare Pilot Beta Program! Please update to test the newest features.',
    releaseNotes: '',
    releaseMedia: [],
    forceUpdate: false,
    apkSha256: '',
    targetedRegistrationNumbers: ['24E122A11'],
  });
  const [pilotMediaInput, setPilotMediaInput] = useState('');
  const pilotMediaFileInputRef = useRef(null);
  const [pilotTestQuery, setPilotTestQuery] = useState('24E122A11');
  const [pilotTestResult, setPilotTestResult] = useState(null);
  const [testingPilotUser, setTestingPilotUser] = useState(false);
  const [savingPilotConfig, setSavingPilotConfig] = useState(false);
  const [pilotManualReg, setPilotManualReg] = useState('');
  const [pilotSearchQuery, setPilotSearchQuery] = useState('');
  const [pilotSearchResults, setPilotSearchResults] = useState([]);
  const [searchingPilotUsers, setSearchingPilotUsers] = useState(false);
  const [deletingAppRelease, setDeletingAppRelease] = useState(false);
  const [deletingPilotRelease, setDeletingPilotRelease] = useState(false);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getOverview();
      if (res.success) {
        setOverview(res);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load system overview', 'Super Admin');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Users Directory
  const loadUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers({ page, limit: userPagination.limit, ...userFilters });
      if (res.success) {
        setUsers(res.users);
        setUserPagination(res.pagination);
        if (res.lockedCount !== undefined) {
          setLockedUsersCount(res.lockedCount);
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load users', 'User Directory');
    } finally {
      setLoading(false);
    }
  }, [userFilters, userPagination.limit]);

  // Load Sessions
  const loadSessions = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminApi.getSessions({ page, limit: sessionPagination.limit, ...sessionFilters });
      if (res.success) {
        setSessions(res.sessions);
        setSessionPagination(res.pagination);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load sessions', 'Sessions');
    } finally {
      setLoading(false);
    }
  }, [sessionFilters, sessionPagination.limit]);

  // Load System Config
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getConfig();
      if (res.success && res.config) {
        setConfig(res.config);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load system configuration', 'Config');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Notification Campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getNotificationHistory();
      if (res.success) {
        setCampaigns(res.campaigns);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load campaigns', 'Notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Audit Logs
  const loadAuditLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminApi.getAuditLogs({ page, limit: auditPagination.limit, ...auditFilters });
      if (res.success) {
        setAuditLogs(res.logs);
        setAuditPagination(res.pagination);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load audit logs', 'Audit Log');
    } finally {
      setLoading(false);
    }
  }, [auditFilters, auditPagination.limit]);

  // Load Global Emergency / Announcement Notices
  const loadNotices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getGlobalNotices();
      if (res.success) {
        setNotices(res.notices || []);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load notices', 'Notices');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle User Provisioning (Direct vs Pending Activation)
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!createUserData.name.trim() || !createUserData.registrationNumber.trim()) {
      triggerToast('error', 'Name and Registration Number are required', 'Validation');
      return;
    }
    if (!createUserData.adminPassword) {
      triggerToast('error', 'Super Admin re-authentication password is required', 'Security Auth');
      return;
    }
    if (createUserData.activateImmediately && (!createUserData.password || createUserData.password.length < 6)) {
      triggerToast('error', 'Password (min 6 chars) is required when activating account immediately', 'Validation');
      return;
    }

    setCreatingUser(true);
    try {
      const res = await adminApi.provisionUser(createUserData);
      if (res.success) {
        triggerToast('success', res.message || 'User account provisioned successfully', 'User Created');
        setCreateUserModalOpen(false);
        setCreateUserData({
          name: '',
          registrationNumber: '',
          role: 'student',
          hostel: 'BH-1',
          roomNumber: '',
          email: '',
          activateImmediately: true,
          password: '',
          adminPassword: '',
        });
        loadUsers(1);
      } else {
        triggerToast('error', res.message || 'Failed to create user', 'Creation Failed');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to create user account', 'Error');
    } finally {
      setCreatingUser(false);
    }
  };

  // Handle Publishing a Global Notice
  const handlePublishNotice = async (e) => {
    e.preventDefault();
    if (!newNotice.title.trim() || !newNotice.message.trim()) {
      triggerToast('error', 'Title and message are required', 'Validation');
      return;
    }
    setPublishingNotice(true);
    try {
      const res = await adminApi.createGlobalNotice(newNotice);
      if (res.success) {
        triggerToast('success', 'Global Notice published and broadcasted to all devices!', 'Notice Live');
        setNewNotice({ title: '', message: '', priority: 'urgent', targetRole: 'ALL' });
        loadNotices();
      } else {
        triggerToast('error', res.message || 'Failed to broadcast notice', 'Error');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to broadcast notice', 'Error');
    } finally {
      setPublishingNotice(false);
    }
  };

  const handleToggleNoticeStatus = async (noticeId, currentStatus) => {
    try {
      const res = await adminApi.toggleGlobalNoticeStatus(noticeId, !currentStatus);
      if (res.success) {
        triggerToast('success', `Notice ${!currentStatus ? 'Activated' : 'Deactivated'}`, 'Status Updated');
        loadNotices();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update notice status', 'Error');
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Are you sure you want to delete this global notice?')) return;
    try {
      const res = await adminApi.deleteGlobalNotice(noticeId);
      if (res.success) {
        triggerToast('success', 'Notice deleted successfully', 'Deleted');
        loadNotices();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to delete notice', 'Error');
    }
  };

  // Load Maintenance Configuration
  const loadMaintenance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getMaintenanceConfig();
      if (res.success && res.maintenance) {
        const m = res.maintenance;
        setMaintenanceConfig({
          global: {
            enabled: Boolean(m.global?.enabled),
            title: m.global?.title || 'System Maintenance in Progress',
            message: m.global?.message || 'HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly.',
            plannedStart: m.global?.plannedStart ? new Date(m.global.plannedStart).toISOString().slice(0, 16) : '',
            plannedEnd: m.global?.plannedEnd ? new Date(m.global.plannedEnd).toISOString().slice(0, 16) : '',
          },
          selective: {
            enabled: Boolean(m.selective?.enabled),
            title: m.selective?.title || 'Service Temporarily Unavailable',
            message: m.selective?.message || 'Access for your account or user group is currently paused for scheduled system maintenance.',
            affectedRoles: m.selective?.affectedRoles || ['student'],
            affectedRegistrationNumbers: m.selective?.affectedRegistrationNumbers || [],
            plannedStart: m.selective?.plannedStart ? new Date(m.selective.plannedStart).toISOString().slice(0, 16) : '',
            plannedEnd: m.selective?.plannedEnd ? new Date(m.selective.plannedEnd).toISOString().slice(0, 16) : '',
          },
        });
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load maintenance configuration', 'Maintenance');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load App Version Configuration
  const loadAppVersion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAppVersionConfig();
      if (res.success) {
        if (res.appVersion) {
          setAppVersionConfig((prev) => ({
            ...prev,
            ...res.appVersion,
            releaseMedia: res.appVersion.releaseMedia || [],
            isSuspended: Boolean(res.appVersion.isSuspended),
            suspendedReason: res.appVersion.suspendedReason || '',
            targetAudience: res.appVersion.targetAudience || 'all',
            targetedRegistrationNumbers: res.appVersion.targetedRegistrationNumbers || [],
          }));
        }
        if (res.pilotTesting) {
          setPilotConfig((prev) => ({
            ...prev,
            ...res.pilotTesting,
            releaseMedia: res.pilotTesting.releaseMedia || [],
            enabled: Boolean(res.pilotTesting.enabled),
            isSuspended: Boolean(res.pilotTesting.isSuspended),
            version: res.pilotTesting.version || '1.2.2.11',
            targetedRegistrationNumbers: res.pilotTesting.targetedRegistrationNumbers || [],
          }));
        }
      }
      const info = await appUpdateService.getInstalledVersion();
      setInstalledAppVersion(info.version || '1.1.0');
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load app version configuration', 'App Version');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleManualCheckForUpdates = async () => {
    try {
      setManualChecking(true);
      setManualCheckResult(null);
      const res = await appUpdateService.checkForUpdates({ manual: true });
      if (res.updateAvailable) {
        setManualCheckResult({
          status: 'update_available',
          message: `New version v${res.latestVersion} is available!`,
          latestVersion: res.latestVersion,
          releaseNotes: res.releaseNotes,
        });
      } else if (!res.errorMessage) {
        setManualCheckResult({
          status: 'up_to_date',
          message: res.isSuspended
            ? 'Updates are currently suspended by administration.'
            : `You're up to date! (Installed: v${res.currentVersion || installedAppVersion})`,
          currentVersion: res.currentVersion || installedAppVersion,
        });
      } else {
        setManualCheckResult({
          status: 'error',
          message: res.errorMessage || 'Unable to check for updates.',
        });
      }
    } catch (err) {
      setManualCheckResult({
        status: 'error',
        message: err.message || 'Unable to check for updates.',
      });
    } finally {
      setManualChecking(false);
    }
  };

  const handleToggleReleaseSuspension = async () => {
    const nextSuspended = !appVersionConfig.isSuspended;
    const updated = {
      ...appVersionConfig,
      isSuspended: nextSuspended,
    };
    setAppVersionConfig(updated);
    try {
      setSavingAppVersion(true);
      const res = await adminApi.updateAppVersionConfig(updated);
      if (res.success) {
        triggerToast(
          nextSuspended ? 'warning' : 'success',
          nextSuspended
            ? 'Release suspended successfully. No users will receive update notifications.'
            : 'Release resumed successfully. Update prompts are now active.',
          nextSuspended ? 'Release Suspended ⏸️' : 'Release Resumed ▶️'
        );
        if (res.appVersion) {
          setAppVersionConfig((prev) => ({
            ...prev,
            ...res.appVersion,
            isSuspended: Boolean(res.appVersion.isSuspended),
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to toggle release suspension', 'Error');
    } finally {
      setSavingAppVersion(false);
    }
  };

  const handleDeleteAppRelease = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this production release?\n\nThis will clear the release notes, media attachments, download URL, reset force update, and reset the version back to baseline so no users receive update prompts.'
    );
    if (!confirmed) return;

    try {
      setDeletingAppRelease(true);
      const res = await adminApi.deleteAppRelease();
      if (res.success) {
        triggerToast('success', 'Production app release deleted successfully and reset to baseline.', 'Release Deleted 🗑️');
        if (res.appVersion) {
          setAppVersionConfig((prev) => ({
            ...prev,
            ...res.appVersion,
            isSuspended: false,
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to delete release', 'Error');
    } finally {
      setDeletingAppRelease(false);
    }
  };

  const handleSelectTargetAudience = async (audience) => {
    const updated = {
      ...appVersionConfig,
      targetAudience: audience,
    };
    setAppVersionConfig(updated);
    try {
      const res = await adminApi.updateAppVersionConfig(updated);
      if (res.success) {
        triggerToast(
          'success',
          audience === 'specific'
            ? 'Switched rollout to Specific Pilot Users'
            : 'Switched rollout to All Users (Global Rollout)',
          'Audience Updated'
        );
      }
    } catch (e) {
      console.warn('Audience update failed:', e);
    }
  };

  const handleSearchTargetUsers = async (query) => {
    setTargetUserSearch(query);
    if (!query || query.trim().length < 2) {
      setTargetUserSearchResults([]);
      return;
    }
    try {
      setSearchingTargetUsers(true);
      const res = await adminApi.getUsers({ search: query.trim(), limit: 6 });
      if (res.success && res.users) {
        setTargetUserSearchResults(res.users);
      }
    } catch (e) {
      console.warn('Failed searching users for app release targeting:', e);
    } finally {
      setSearchingTargetUsers(false);
    }
  };

  const handleAddTargetUser = async (userOrReg) => {
    const reg = typeof userOrReg === 'string'
      ? userOrReg.trim().toUpperCase()
      : userOrReg.registrationNumber?.trim().toUpperCase();
    if (!reg) return;

    const existing = appVersionConfig.targetedRegistrationNumbers || [];
    if (existing.includes(reg)) {
      triggerToast('info', `User ${reg} is already added to pilot rollout`, 'Already Added');
      setTargetUserSearch('');
      setTargetUserSearchResults([]);
      setTargetManualReg('');
      return;
    }

    const updated = {
      ...appVersionConfig,
      targetAudience: 'specific',
      targetedRegistrationNumbers: [...existing, reg],
    };

    setAppVersionConfig(updated);
    setTargetUserSearch('');
    setTargetUserSearchResults([]);
    setTargetManualReg('');

    try {
      const res = await adminApi.updateAppVersionConfig(updated);
      if (res.success) {
        triggerToast('success', `Added ${reg} to pilot rollout and saved`, 'Pilot Rollout');
      }
    } catch (e) {
      triggerToast('error', e.message || 'Failed saving target user', 'Error');
    }
  };

  const handleRemoveTargetUser = async (reg) => {
    const updated = {
      ...appVersionConfig,
      targetedRegistrationNumbers: (appVersionConfig.targetedRegistrationNumbers || []).filter((r) => r !== reg),
    };
    setAppVersionConfig(updated);
    try {
      const res = await adminApi.updateAppVersionConfig(updated);
      if (res.success) {
        triggerToast('success', `Removed ${reg} from pilot rollout`, 'Pilot Rollout');
      }
    } catch (e) {
      triggerToast('error', e.message || 'Failed removing target user', 'Error');
    }
  };

  const handleTogglePilotTargetUser = async (u, e) => {
    if (e) e.stopPropagation();
    const reg = u?.registrationNumber?.trim().toUpperCase();
    if (!reg) return;

    const currentTargets = appVersionConfig.targetedRegistrationNumbers || [];
    const isTargeted = currentTargets.includes(reg);
    const nextTargets = isTargeted
      ? currentTargets.filter((r) => r !== reg)
      : [...currentTargets, reg];

    const updatedConfig = {
      ...appVersionConfig,
      targetAudience: 'specific',
      targetedRegistrationNumbers: nextTargets,
    };

    setAppVersionConfig(updatedConfig);
    try {
      const res = await adminApi.updateAppVersionConfig(updatedConfig);
      if (res.success) {
        triggerToast(
          'success',
          isTargeted
            ? `Removed ${u.name || reg} from targeted pilot release`
            : `Added ${u.name || reg} to targeted pilot release (v${appVersionConfig.latestVersion || '1.2.2.11'})`,
          'Pilot Rollout'
        );
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed updating app version rollout', 'Error');
    }
  };

  // Media Management Handlers for App Updates & Pilot Testing
  const handleAddAppMedia = () => {
    if (!appMediaInput || !appMediaInput.trim()) {
      // If text input is empty, open file picker to let user choose a screenshot/media file
      if (appMediaFileInputRef.current) {
        appMediaFileInputRef.current.click();
      } else {
        triggerToast('warning', 'Please enter a media URL or select a screenshot file', 'Media Required');
      }
      return;
    }
    let url = appMediaInput.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) {
      url = 'https://' + url;
    }
    const existing = appVersionConfig.releaseMedia || [];
    if (existing.includes(url)) {
      triggerToast('info', 'Media URL is already added', 'Already Added');
      setAppMediaInput('');
      return;
    }
    setAppVersionConfig((prev) => ({
      ...prev,
      releaseMedia: [...existing, url],
    }));
    setAppMediaInput('');
    triggerToast('success', 'Added media attachment to changelog', 'Media Added');
  };

  const handleAppMediaFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      triggerToast('error', 'Media file exceeds 3MB limit.', 'File Too Large');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const existing = appVersionConfig.releaseMedia || [];
      setAppVersionConfig((prev) => ({
        ...prev,
        releaseMedia: [...existing, dataUrl],
      }));
      triggerToast('success', `Added ${file.name} to changelog media`, 'Media Added');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAppMedia = (url) => {
    setAppVersionConfig((prev) => ({
      ...prev,
      releaseMedia: (prev.releaseMedia || []).filter((m) => m !== url),
    }));
  };

  const handleInsertAppMediaToNotes = (url) => {
    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
    const snippet = isVideo ? `\n${url}\n` : `\n![Screenshot Preview](${url})\n`;
    setAppVersionConfig((prev) => ({
      ...prev,
      releaseNotes: (prev.releaseNotes || '') + snippet,
    }));
    triggerToast('success', 'Inserted media snippet into changelog notes', 'Markdown Inserted');
  };

  const handleAddPilotMedia = () => {
    if (!pilotMediaInput || !pilotMediaInput.trim()) {
      if (pilotMediaFileInputRef.current) {
        pilotMediaFileInputRef.current.click();
      } else {
        triggerToast('warning', 'Please enter a media URL or select a screenshot file', 'Media Required');
      }
      return;
    }
    let url = pilotMediaInput.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) {
      url = 'https://' + url;
    }
    const existing = pilotConfig.releaseMedia || [];
    if (existing.includes(url)) {
      triggerToast('info', 'Media URL is already added', 'Already Added');
      setPilotMediaInput('');
      return;
    }
    setPilotConfig((prev) => ({
      ...prev,
      releaseMedia: [...existing, url],
    }));
    setPilotMediaInput('');
    triggerToast('success', 'Added media attachment to pilot changelog', 'Media Added');
  };

  const handlePilotMediaFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      triggerToast('error', 'Media file exceeds 3MB limit.', 'File Too Large');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const existing = pilotConfig.releaseMedia || [];
      setPilotConfig((prev) => ({
        ...prev,
        releaseMedia: [...existing, dataUrl],
      }));
      triggerToast('success', `Added ${file.name} to pilot changelog media`, 'Media Added');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePilotMedia = (url) => {
    setPilotConfig((prev) => ({
      ...prev,
      releaseMedia: (prev.releaseMedia || []).filter((m) => m !== url),
    }));
  };

  const handleInsertPilotMediaToNotes = (url) => {
    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
    const snippet = isVideo ? `\n${url}\n` : `\n![Screenshot Preview](${url})\n`;
    setPilotConfig((prev) => ({
      ...prev,
      releaseNotes: (prev.releaseNotes || '') + snippet,
    }));
    triggerToast('success', 'Inserted media snippet into pilot changelog text', 'Markdown Inserted');
  };

  // Pilot Testing Handlers
  const handleTogglePilotSuspension = async () => {
    const nextSuspended = !pilotConfig.isSuspended;
    const updatedPilot = {
      ...pilotConfig,
      isSuspended: nextSuspended,
    };
    setPilotConfig(updatedPilot);
    try {
      setSavingPilotConfig(true);
      const res = await adminApi.updateAppVersionConfig({
        ...appVersionConfig,
        pilotTesting: updatedPilot,
      });
      if (res.success) {
        triggerToast(
          nextSuspended ? 'warning' : 'success',
          nextSuspended
            ? 'Pilot release suspended. Targeted pilot users will not receive pilot updates.'
            : 'Pilot release resumed. Targeted pilot users will receive pilot updates.',
          nextSuspended ? 'Pilot Suspended ⏸️' : 'Pilot Resumed ▶️'
        );
        if (res.pilotTesting) {
          setPilotConfig((prev) => ({
            ...prev,
            ...res.pilotTesting,
            isSuspended: Boolean(res.pilotTesting.isSuspended),
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to toggle pilot release suspension', 'Error');
    } finally {
      setSavingPilotConfig(false);
    }
  };

  const handleDeletePilotRelease = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this pilot testing release?\n\nThis will clear the pilot version, media attachments, APK URL, disable pilot testing, and remove all targeted testers.'
    );
    if (!confirmed) return;

    try {
      setDeletingPilotRelease(true);
      const res = await adminApi.deletePilotRelease();
      if (res.success) {
        triggerToast('success', 'Pilot testing release deleted successfully and reset.', 'Pilot Deleted 🗑️');
        if (res.pilotTesting) {
          setPilotConfig((prev) => ({
            ...prev,
            ...res.pilotTesting,
            enabled: false,
            isSuspended: false,
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to delete pilot release', 'Error');
    } finally {
      setDeletingPilotRelease(false);
    }
  };

  const handleTogglePilotEnabled = async () => {
    const nextEnabled = !pilotConfig.enabled;
    const updatedPilot = {
      ...pilotConfig,
      enabled: nextEnabled,
    };
    setPilotConfig(updatedPilot);
    try {
      setSavingPilotConfig(true);
      const res = await adminApi.updateAppVersionConfig({
        ...appVersionConfig,
        pilotTesting: updatedPilot,
      });
      if (res.success) {
        triggerToast(
          nextEnabled ? 'success' : 'info',
          nextEnabled ? 'Pilot Testing program enabled.' : 'Pilot Testing program disabled.',
          'Pilot Status'
        );
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update pilot status', 'Error');
    } finally {
      setSavingPilotConfig(false);
    }
  };

  const handleSavePilotConfig = async (e) => {
    if (e) e.preventDefault();
    setSavingPilotConfig(true);
    try {
      const res = await adminApi.updateAppVersionConfig({
        ...appVersionConfig,
        pilotTesting: pilotConfig,
      });
      if (res.success) {
        triggerToast('success', 'Pilot testing release parameters saved successfully', 'Pilot Updated');
        if (res.pilotTesting) {
          setPilotConfig((prev) => ({
            ...prev,
            ...res.pilotTesting,
            isSuspended: Boolean(res.pilotTesting.isSuspended),
            enabled: Boolean(res.pilotTesting.enabled),
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to save pilot configuration', 'Save Error');
    } finally {
      setSavingPilotConfig(false);
    }
  };

  const handleSearchPilotUsers = async (query) => {
    setPilotSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setPilotSearchResults([]);
      return;
    }
    try {
      setSearchingPilotUsers(true);
      const res = await adminApi.getUsers({ search: query.trim(), limit: 6 });
      if (res.success && res.users) {
        setPilotSearchResults(res.users);
      }
    } catch (e) {
      console.warn('Failed searching users for pilot:', e);
    } finally {
      setSearchingPilotUsers(false);
    }
  };

  const handleAddPilotTester = async (userOrReg) => {
    const reg = typeof userOrReg === 'string'
      ? userOrReg.trim().toUpperCase()
      : userOrReg.registrationNumber?.trim().toUpperCase();
    if (!reg) return;

    const existing = pilotConfig.targetedRegistrationNumbers || [];
    if (existing.includes(reg)) {
      triggerToast('info', `User ${reg} is already in the pilot group`, 'Already Added');
      setPilotSearchQuery('');
      setPilotSearchResults([]);
      setPilotManualReg('');
      return;
    }

    const updatedPilot = {
      ...pilotConfig,
      targetedRegistrationNumbers: [...existing, reg],
    };

    setPilotConfig(updatedPilot);
    setPilotSearchQuery('');
    setPilotSearchResults([]);
    setPilotManualReg('');

    try {
      const res = await adminApi.updateAppVersionConfig({
        ...appVersionConfig,
        pilotTesting: updatedPilot,
      });
      if (res.success) {
        triggerToast('success', `Added ${reg} to pilot testing group`, 'Pilot Tester Added');
      }
    } catch (e) {
      triggerToast('error', e.message || 'Failed adding pilot tester', 'Error');
    }
  };

  const handleRemovePilotTester = async (reg) => {
    const updatedPilot = {
      ...pilotConfig,
      targetedRegistrationNumbers: (pilotConfig.targetedRegistrationNumbers || []).filter((r) => r !== reg),
    };
    setPilotConfig(updatedPilot);
    try {
      const res = await adminApi.updateAppVersionConfig({
        ...appVersionConfig,
        pilotTesting: updatedPilot,
      });
      if (res.success) {
        triggerToast('success', `Removed ${reg} from pilot testing group`, 'Pilot Tester Removed');
      }
    } catch (e) {
      triggerToast('error', e.message || 'Failed removing pilot tester', 'Error');
    }
  };

  const handleRunPilotTestVerification = async () => {
    if (!pilotTestQuery || !pilotTestQuery.trim()) {
      triggerToast('warning', 'Please enter a registration number to verify', 'Validation');
      return;
    }
    setTestingPilotUser(true);
    setPilotTestResult(null);
    try {
      const res = await adminApi.testPilotUserEligibility(pilotTestQuery.trim().toUpperCase());
      setPilotTestResult(res);
      if (res.success) {
        if (res.verdict?.isEligible) {
          triggerToast('success', `${pilotTestQuery} is ELIGIBLE for pilot release v${res.pilotConfig?.version}`, 'Verification Result');
        } else {
          triggerToast('info', `${pilotTestQuery}: ${res.verdict?.reason || 'Not currently eligible'}`, 'Verification Result');
        }
      }
    } catch (err) {
      setPilotTestResult({
        success: false,
        message: err.message || 'Failed to verify eligibility',
      });
      triggerToast('error', err.message || 'Verification failed', 'Verification Error');
    } finally {
      setTestingPilotUser(false);
    }
  };

  // Load Mess Auto-Notification Schedule
  const loadMessNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getMessNotificationSchedule();
      if (res.success && res.config) {
        const rawFreq = res.config.frequencies || {};
        const fallbackCount = res.config.alertCountPerMeal || 1;
        setMessAlertConfig((prev) => ({
          enabled: Boolean(res.config.enabled),
          vacationMode: Boolean(res.config.vacationMode),
          mealSwitches: res.config.mealSwitches || { breakfast: true, lunch: true, snacks: true, dinner: true },
          leadTimes: res.config.leadTimes || { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 },
          customTemplates: res.config.customTemplates || {},
          targetBlocks: res.config.targetBlocks || [],
          targetRoles: res.config.targetRoles || ['student'],
          alertCountPerMeal: fallbackCount,
          frequencies: {
            breakfast: Number(rawFreq.breakfast ?? fallbackCount ?? prev.frequencies?.breakfast ?? 1),
            lunch:     Number(rawFreq.lunch ?? fallbackCount ?? prev.frequencies?.lunch ?? 1),
            snacks:    Number(rawFreq.snacks ?? fallbackCount ?? prev.frequencies?.snacks ?? 1),
            dinner:    Number(rawFreq.dinner ?? fallbackCount ?? prev.frequencies?.dinner ?? 1),
          },
          workingDays: res.config.workingDays || prev.workingDays,
          sundayAndHolidays: res.config.sundayAndHolidays || prev.sundayAndHolidays,
        }));
        setMessAlertTelemetry({
          serverTime: res.serverTimeIST || res.serverTime || null,
          activePushSessionsCount: res.activePushSessionsCount || 0,
          radar: res.radar || {
            androidHardwareCount: 0,
            webPushCount: 0,
            staleTokensCount: 0,
            legacySessionsCount: res.activePushSessionsCount || 0,
            totalReachableDevices: res.activePushSessionsCount || 0,
            fcmReady: false,
          },
        });
        setTodayDispatches(res.todayDispatches || []);
        if (res.dayModeInfo) {
          setDayModeInfo(res.dayModeInfo);
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load mess notification schedule', 'Mess Alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Device Registry Directory (Layer 1 Vault Viewer)
  const loadDeviceRegistry = useCallback(async (page = 1) => {
    try {
      setLoadingDeviceRegistry(true);
      const res = await adminApi.getDeviceRegistry({
        search: deviceSearchQuery,
        hostelBlock: deviceBlockFilter,
        page,
        limit: 15,
      });
      if (res.success) {
        setDeviceRegistryList(res.devices || []);
        setDeviceRegistryPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load device registry:', err);
    } finally {
      setLoadingDeviceRegistry(false);
    }
  }, [deviceSearchQuery, deviceBlockFilter]);

  // Single-Student Mute / Unmute Toggle
  const handleToggleDeviceMute = async (deviceId, currentMuted, studentName = '') => {
    try {
      setMutingDeviceId(deviceId);
      const res = await adminApi.toggleDeviceMute(deviceId, !currentMuted);
      if (res.success) {
        triggerToast('info', res.message, 'Device Mute Toggled 🔕');
        setDeviceRegistryList((prev) =>
          prev.map((d) => (d.deviceId === deviceId ? { ...d, isMuted: !currentMuted } : d))
        );
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to toggle device mute', 'Error');
    } finally {
      setMutingDeviceId(null);
    }
  };

  // Single-Student 1-Click Direct Ping
  const handlePingSingleDevice = async (deviceId, studentName = '') => {
    try {
      setPingingDeviceId(deviceId);
      const res = await adminApi.pingSingleDevice(deviceId, {
        slotKey: testSlotKey,
        customTitle: `🎯 Direct Alert for ${studentName || 'Student'}`,
        customBody: `Super Admin test ping delivered exclusively to your device for ${testSlotKey.toUpperCase()}.`,
      });
      if (res.success) {
        triggerToast('success', res.message || `Test ping delivered to ${studentName || deviceId}!`, 'Device Pinged 📱');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to ping device', 'Error');
    } finally {
      setPingingDeviceId(null);
    }
  };

  // Single Device Prune / Delete
  const handleDeleteDeviceEntry = async (deviceId, studentName = '') => {
    if (!window.confirm(`Are you sure you want to prune and unregister device for ${studentName || deviceId}?`)) return;
    try {
      const res = await adminApi.deleteDeviceRegistryEntry(deviceId);
      if (res.success) {
        triggerToast('success', 'Device pruned from hardware vault', 'Pruned 🗑️');
        setDeviceRegistryList((prev) => prev.filter((d) => d.deviceId !== deviceId));
        loadMessNotifications();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to prune device', 'Error');
    }
  };

  // Emergency / Custom Announcement Broadcast
  const handleBroadcastCustomAnnouncement = async () => {
    if (!customAnnouncementTitle.trim() || !customAnnouncementBody.trim()) {
      triggerToast('warning', 'Please provide both Title and Body for the announcement', 'Missing Info');
      return;
    }
    const confirmed = window.confirm(
      `Broadcast this custom mess announcement to ${
        customAnnouncementTargetBlock === 'all' ? 'ALL students' : `Block ${customAnnouncementTargetBlock}`
      }?\n\nTitle: ${customAnnouncementTitle}\nBody: ${customAnnouncementBody}`
    );
    if (!confirmed) return;

    try {
      setBroadcastingCustomAlert(true);
      const res = await adminApi.broadcastCustomMessAlert({
        title: customAnnouncementTitle.trim(),
        body: customAnnouncementBody.trim(),
        imageUrl: customAnnouncementImage.trim() || null,
        targetBlocks: customAnnouncementTargetBlock === 'all' ? [] : [customAnnouncementTargetBlock],
        targetRoles: ['student'],
      });
      if (res.success) {
        triggerToast('success', res.message || 'Custom announcement broadcasted successfully!', 'Broadcast Sent 📢');
        setCustomAnnouncementTitle('');
        setCustomAnnouncementBody('');
        setCustomAnnouncementImage('');
        loadMessNotifications();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to broadcast announcement', 'Error');
    } finally {
      setBroadcastingCustomAlert(false);
    }
  };

  const handlePurgeDispatches = async () => {
    if (!window.confirm("Are you sure you want to clear/delete today's dispatched mess alert records? This will purge all logged delivery records and reset duplicate counters.")) return;
    try {
      setPurgingDispatches(true);
      const res = await adminApi.purgeMessNotificationDispatches();
      if (res.success) {
        triggerToast('success', res.message || 'Dispatched alert records purged successfully!', 'Records Purged 🗑️');
        loadMessNotifications();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to purge dispatches', 'Error');
    } finally {
      setPurgingDispatches(false);
    }
  };

  const handleSetStrictSingleAlert = async () => {
    const singleAlertConfig = {
      ...messAlertConfig,
      alertCountPerMeal: 1,
      frequencies: {
        breakfast: 1,
        lunch: 1,
        snacks: 1,
        dinner: 1,
      },
    };
    setMessAlertConfig(singleAlertConfig);
    await handleSaveMessAlertConfig(singleAlertConfig);
  };

  const handleSaveMessAlertConfig = async (overrideConfig = null) => {
    try {
      setSavingMessAlerts(true);
      const payload = overrideConfig || messAlertConfig;
      const res = await adminApi.updateMessNotificationSchedule(payload);
      if (res.success && res.config) {
        const rawFreq = res.config.frequencies || {};
        const fallbackCount = res.config.alertCountPerMeal || 1;
        setMessAlertConfig({
          enabled: Boolean(res.config.enabled),
          alertCountPerMeal: fallbackCount,
          frequencies: {
            breakfast: Number(rawFreq.breakfast ?? fallbackCount ?? 1),
            lunch:     Number(rawFreq.lunch ?? fallbackCount ?? 1),
            snacks:    Number(rawFreq.snacks ?? fallbackCount ?? 1),
            dinner:    Number(rawFreq.dinner ?? fallbackCount ?? 1),
          },
          workingDays: res.config.workingDays,
          sundayAndHolidays: res.config.sundayAndHolidays,
        });
        triggerToast('success', 'Mess notification schedule & frequencies saved in MongoDB!', 'Schedule Saved 🍱');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update mess notification schedule', 'Error');
    } finally {
      setSavingMessAlerts(false);
    }
  };

  // Food Menu Editor Handlers
  const handleOpenFoodEditor = async (day = null, slot = null) => {
    setIsFoodEditorModalOpen(true);
    setLoadingFoodMenu(true);
    try {
      const res = await adminApi.getMessMenu();
      const menu = res.menu || DEFAULT_MESS_DATA;
      setFoodMenuData(menu);
      const targetDay = day || foodEditorDay;
      const targetSlot = slot || foodEditorSlot;
      setFoodEditorDay(targetDay);
      setFoodEditorSlot(targetSlot);
      const schedule = menu.schedule || DEFAULT_MESS_DATA.schedule;
      const meal = schedule[targetDay]?.meals?.[targetSlot] || {};
      const items = Array.isArray(meal.items) ? [...meal.items] : [];
      setFoodItemsList(items);
      setFoodBulkText(items.join('\n'));
      setFoodTimingInput(meal.timing || '');
    } catch (err) {
      triggerToast('error', err.message || 'Failed to fetch current mess menu', 'Food Menu');
    } finally {
      setLoadingFoodMenu(false);
    }
  };

  const handleSelectFoodDaySlot = (day, slot) => {
    setFoodEditorDay(day);
    setFoodEditorSlot(slot);
    if (!foodMenuData) return;
    const schedule = foodMenuData.schedule || DEFAULT_MESS_DATA.schedule;
    const meal = schedule[day]?.meals?.[slot] || {};
    const items = Array.isArray(meal.items) ? [...meal.items] : [];
    setFoodItemsList(items);
    setFoodBulkText(items.join('\n'));
    setFoodTimingInput(meal.timing || '');
  };

  const handleAddDish = () => {
    const val = newDishInput.trim();
    if (!val) return;
    if (foodItemsList.includes(val)) {
      triggerToast('warning', `'${val}' is already in this meal's list.`, 'Duplicate Item');
      return;
    }
    const updated = [...foodItemsList, val];
    setFoodItemsList(updated);
    setFoodBulkText(updated.join('\n'));
    setNewDishInput('');
  };

  const handleRemoveDish = (indexToRemove) => {
    const updated = foodItemsList.filter((_, idx) => idx !== indexToRemove);
    setFoodItemsList(updated);
    setFoodBulkText(updated.join('\n'));
  };

  const handleSaveFoodMenu = async () => {
    setSavingFoodMenu(true);
    try {
      const scheduleCopy = JSON.parse(JSON.stringify(foodMenuData?.schedule || DEFAULT_MESS_DATA.schedule));
      if (!scheduleCopy[foodEditorDay]) {
        scheduleCopy[foodEditorDay] = { day: foodEditorDay, label: foodEditorDay.charAt(0).toUpperCase() + foodEditorDay.slice(1), meals: {} };
      }
      if (!scheduleCopy[foodEditorDay].meals) {
        scheduleCopy[foodEditorDay].meals = {};
      }
      const existingMeal = scheduleCopy[foodEditorDay].meals[foodEditorSlot] || {};

      const finalItems = foodBulkMode
        ? foodBulkText.split('\n').map((s) => s.trim()).filter(Boolean)
        : [...foodItemsList];

      scheduleCopy[foodEditorDay].meals[foodEditorSlot] = {
        ...existingMeal,
        name: existingMeal.name || foodEditorSlot.charAt(0).toUpperCase() + foodEditorSlot.slice(1),
        timing: foodTimingInput.trim() || existingMeal.timing || '',
        items: finalItems,
      };

      const payload = {
        title: foodMenuData?.title || DEFAULT_MESS_DATA.title,
        season: foodMenuData?.season || DEFAULT_MESS_DATA.season,
        hostel: foodMenuData?.hostel || DEFAULT_MESS_DATA.hostel,
        schedule: scheduleCopy,
        guidelines: foodMenuData?.guidelines || DEFAULT_MESS_DATA.guidelines,
      };

      const res = await adminApi.updateMessMenu(payload);
      if (res.success && res.menu) {
        setFoodMenuData(res.menu);
        triggerToast('success', `Updated ${foodEditorSlot} items for ${foodEditorDay.toUpperCase()}!`, 'Menu Saved 🍽️');
        setIsFoodEditorModalOpen(false);
      } else {
        triggerToast('error', res.message || 'Failed to update mess menu', 'Error');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to save food items', 'Error');
    } finally {
      setSavingFoodMenu(false);
    }
  };

  const handleResetFoodMenu = async () => {
    if (!window.confirm('Reset all days and meal items back to official 2026 default timetable?')) return;
    setSavingFoodMenu(true);
    try {
      const res = await adminApi.resetMessMenu();
      if (res.success && res.menu) {
        setFoodMenuData(res.menu);
        handleSelectFoodDaySlot(foodEditorDay, foodEditorSlot);
        triggerToast('info', 'Restored verified 2026 mess timetable.', 'Reset Complete');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to reset menu', 'Error');
    } finally {
      setSavingFoodMenu(false);
    }
  };

  const handleResetMessScheduleToOfficial = async () => {
    const officialDefaults = {
      enabled: true,
      workingDays: {
        breakfast: { startHour: 7, startMinute: 0, timing: '07:00 AM – 09:15 AM' },
        lunch:     { startHour: 12, startMinute: 30, timing: '12:30 PM – 02:30 PM' },
        snacks:    { startHour: 17, startMinute: 45, timing: '05:45 PM – 07:30 PM' },
        dinner:    { startHour: 20, startMinute: 30, timing: '08:30 PM – 10:00 PM' },
      },
      sundayAndHolidays: {
        breakfast: { startHour: 8, startMinute: 0, timing: '08:00 AM – 10:00 AM' },
        lunch:     { startHour: 12, startMinute: 30, timing: '12:30 PM – 02:30 PM' },
        snacks:    { startHour: 17, startMinute: 30, timing: '05:30 PM – 07:00 PM' },
        dinner:    { startHour: 20, startMinute: 30, timing: '08:30 PM – 10:00 PM' },
      },
    };
    const confirmed = window.confirm(
      'Reset all meal alert schedules to the official mess timings (Notice: 08/10/2026)?\n\n' +
      '• Working Days: Breakfast 07:00, Lunch 12:30, Snacks 17:45, Dinner 20:30\n' +
      '• Sunday/Holidays: Breakfast 08:00, Lunch 12:30, Snacks 17:30, Dinner 20:30'
    );
    if (!confirmed) return;
    setMessAlertConfig(officialDefaults);
    await handleSaveMessAlertConfig(officialDefaults);
  };

  const handleTestMessAlert = async (pingMyPhone = false) => {
    try {
      setTestingMessAlert(true);
      setTestAlertResult(null);
      const res = await adminApi.testMessNotificationBroadcast({
        slotKey: testSlotKey,
        pingMyPhone,
      });
      if (res.success) {
        setTestAlertResult(res);
        triggerToast(
          'success',
          res.message || `Test alert triggered to ${res.result?.targets || 0} active device(s)!`,
          pingMyPhone ? 'Admin Phone Pinged 📱' : 'Test Alert Broadcasted 🚀'
        );
      } else {
        triggerToast('warning', res.message || 'Test broadcast finished with issues', 'Test Alert');
      }
    } catch (err) {
      setTestAlertResult({
        success: false,
        message: err.message || 'Failed to dispatch test notification',
      });
      triggerToast('error', err.message || 'Failed to dispatch test notification', 'Dispatch Error');
    } finally {
      setTestingMessAlert(false);
    }
  };

  const [delayedAutoFireCountdown, setDelayedAutoFireCountdown] = useState(null);
  const [delayedSlotKey, setDelayedSlotKey] = useState(null);
  const [rearmingSlot, setRearmingSlot] = useState(false);

  const handleSimulateAutoFire = async (slotKey, delaySeconds = 0) => {
    try {
      setTestingMessAlert(true);
      const res = await adminApi.simulateAutoFire(slotKey, delaySeconds, true);
      if (res.success) {
        if (delaySeconds > 0) {
          setDelayedSlotKey(slotKey);
          setDelayedAutoFireCountdown(delaySeconds);
          triggerToast('info', res.message, 'Auto-Fire Armed ⏱️');
          let remaining = delaySeconds;
          const interval = setInterval(() => {
            remaining -= 1;
            setDelayedAutoFireCountdown(remaining);
            if (remaining <= 0) {
              clearInterval(interval);
              setDelayedAutoFireCountdown(null);
              setDelayedSlotKey(null);
              loadMessNotifications();
              triggerToast('success', `${slotKey.toUpperCase()} auto-fire broadcast executed by server!`, 'Dispatched 🚀');
            }
          }, 1000);
        } else {
          setTestAlertResult(res);
          triggerToast('success', res.message, 'Auto-Fire Dispatched 🚀');
          await loadMessNotifications();
        }
      } else {
        triggerToast('warning', res.message || 'Auto-fire simulation failed', 'Warning');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to trigger auto-fire simulation', 'Error');
    } finally {
      setTestingMessAlert(false);
    }
  };

  const handleRearmSlot = async (slotKey = 'all') => {
    try {
      setRearmingSlot(true);
      const res = await adminApi.rearmMessSlot(slotKey);
      if (res.success) {
        triggerToast('success', res.message, 'Slot Re-Armed 🔄');
        await loadMessNotifications();
      } else {
        triggerToast('warning', res.message || 'Failed to re-arm slot', 'Warning');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to re-arm slot', 'Error');
    } finally {
      setRearmingSlot(false);
    }
  };

  const handleToggleDayMode = async (mode) => {
    try {
      setTogglingDayMode(true);
      const nextConfig = {
        ...messAlertConfig,
        dayModeOverride: mode,
      };
      setMessAlertConfig(nextConfig);
      const res = await adminApi.updateMessNotificationSchedule({
        dayModeOverride: mode,
      });
      if (res.success) {
        const modeLabel =
          mode === 'working'
            ? 'Working Days'
            : mode === 'sunday'
            ? 'Sunday Timetable'
            : mode === 'holiday'
            ? 'Holiday Timetable'
            : 'Auto (Follow Calendar)';
        triggerToast(
          'success',
          `Schedule mode set to ${mode.toUpperCase()}! Active timetable: ${modeLabel}`,
          'Day Mode Updated 📅'
        );
        await loadMessNotifications();
      } else {
        triggerToast('warning', res.message || 'Failed to update day mode', 'Day Mode');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update day mode', 'Error');
    } finally {
      setTogglingDayMode(false);
    }
  };

  // Temporary Sub-Admin Delegation Loader (defined before initial load effect to prevent TDZ)
  const loadDelegations = useCallback(async () => {
    try {
      setLoadingDelegations(true);
      const res = await adminApi.getDelegations();
      if (res && res.success) {
        setDelegationsList(res.delegations || []);
        setDelegationsStats(res.stats || { total: 0, active: 0, indefinite: 0 });
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to load delegations', 'Delegations');
    } finally {
      setLoadingDelegations(false);
    }
  }, []);

  // Initial load according to active tab
  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    else if (activeTab === 'users') {
      loadUsers(1);
      loadAppVersion();
    }
    else if (activeTab === 'sessions') loadSessions(1);
    else if (activeTab === 'limits') loadConfig();
    else if (activeTab === 'maintenance') loadMaintenance();
    else if (activeTab === 'appversion' || activeTab === 'pilottesting') loadAppVersion();
    else if (activeTab === 'notifications') loadCampaigns();
    else if (activeTab === 'notices') loadNotices();
    else if (activeTab === 'messalerts') {
      loadMessNotifications();
      loadDeviceRegistry(1);
    }
    else if (activeTab === 'delegations') loadDelegations();
    else if (activeTab === 'audit') loadAuditLogs(1);
  }, [activeTab, loadOverview, loadUsers, loadSessions, loadConfig, loadMaintenance, loadAppVersion, loadCampaigns, loadNotices, loadMessNotifications, loadDeviceRegistry, loadAuditLogs, loadDelegations]);

  // Fetch full details for a selected user
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setEditUserData({
      name: user.name || '',
      email: user.email || '',
      registrationNumber: user.registrationNumber || '',
      role: user.role || 'student',
      hostel: user.hostel || '',
      roomNumber: user.roomNumber || '',
      newPassword: '',
      maxDevices: user.maxDevices !== null && user.maxDevices !== undefined ? user.maxDevices : '',
    });
    try {
      const res = await adminApi.getUserDetails(user._id);
      if (res.success) {
        setUserDetails(res);
        if (res.user) {
          setEditUserData((prev) => ({
            ...prev,
            registrationNumber: res.user.registrationNumber || prev.registrationNumber,
            hostel: res.user.hostel || prev.hostel,
            roomNumber: res.user.roomNumber || prev.roomNumber,
            maxDevices: res.user.maxDevices !== null && res.user.maxDevices !== undefined ? res.user.maxDevices : '',
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'User Details');
    }
  };

  // Update profile handler
  const handleSaveUserProfile = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await adminApi.updateUserProfile(selectedUser._id, editUserData);
      if (res.success) {
        triggerToast('success', res.message, 'Profile Updated');
        loadUsers(userPagination.page);
        handleSelectUser(res.user);
      }
    } catch (err) {
      triggerToast('error', err.message, 'Update Failed');
    }
  };

  // Administrative Flush User Account (Revoke all sessions, wipe device vault, reset lockout counters)
  const handleFlushUser = async (userId) => {
    if (
      !window.confirm(
        "⚠️ ADMINISTRATIVE FLUSH USER ACCOUNT:\n\nThis will immediately:\n1. Terminate & revoke ALL active sessions on all devices\n2. Wipe hardware device registry & push tokens\n3. Clear failed login attempts counter to 0\n4. Remove login lockouts and restore status to 'active'\n\nAre you sure you want to completely flush this account?"
      )
    ) {
      return;
    }
    try {
      setFlushingUser(true);
      const res = await adminApi.flushUser(userId);
      if (res.success) {
        triggerToast('success', res.message || 'Account flushed and refreshed', 'Account Flushed');
        loadUsers(userPagination.page);
        if (selectedUser && selectedUser._id === userId) {
          handleSelectUser({
            ...selectedUser,
            failedLoginAttempts: 0,
            lockUntil: null,
            isLocked: false,
            accountStatus: 'active',
          });
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to flush account', 'Flush Failed');
    } finally {
      setFlushingUser(false);
    }
  };

  // Super Admin Self-Profile Modals & Handlers
  const openMyProfileModal = async () => {
    setIsMyProfileModalOpen(true);
    setLoadingMyProfile(true);
    try {
      const res = await adminApi.getSuperAdminProfile();
      if (res.success && res.admin) {
        setMyProfileData({
          name: res.admin.name || '',
          email: res.admin.email || '',
          registrationNumber: res.admin.registrationNumber || '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to fetch admin profile', 'Admin Profile');
    } finally {
      setLoadingMyProfile(false);
    }
  };

  const handleSaveMyProfile = async (e) => {
    e.preventDefault();
    if (myProfileData.newPassword && myProfileData.newPassword.length < 6) {
      triggerToast('error', 'New password must be at least 6 characters', 'Validation Error');
      return;
    }
    if (myProfileData.newPassword && myProfileData.newPassword !== myProfileData.confirmPassword) {
      triggerToast('error', 'New passwords do not match', 'Validation Error');
      return;
    }

    try {
      setSavingMyProfile(true);
      const payload = {
        name: myProfileData.name,
        email: myProfileData.email,
        registrationNumber: myProfileData.registrationNumber,
      };
      if (myProfileData.newPassword) {
        payload.newPassword = myProfileData.newPassword;
      }
      const res = await adminApi.updateSuperAdminProfile(payload);
      if (res.success) {
        triggerToast('success', res.message || 'Super Admin profile updated successfully!', 'Profile Saved');
        setIsMyProfileModalOpen(false);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update profile', 'Admin Profile');
    } finally {
      setSavingMyProfile(false);
    }
  };

  // Temporary Sub-Admin Delegation Handlers
  const searchUsersForDelegation = async (query) => {
    setDelegationUserSearch(query);
    if (!query || query.trim().length < 2) {
      setDelegationSearchResults([]);
      return;
    }
    try {
      setSearchingDelegationUsers(true);
      const res = await adminApi.getUsers({ search: query.trim(), limit: 8 });
      if (res.success && res.users) {
        // Exclude permanent superadmins from delegation target list
        setDelegationSearchResults(res.users.filter((u) => u.role !== 'superadmin'));
      }
    } catch (_) {
    } finally {
      setSearchingDelegationUsers(false);
    }
  };

  const handleCreateDelegation = async (e) => {
    e.preventDefault();
    if (!delegationFormData.userId) {
      triggerToast('error', 'Please select a user to grant Sub-Admin power', 'Validation Error');
      return;
    }
    const effectiveScopes = delegationFormData.scopeMode === 'all'
      ? ['all']
      : (delegationFormData.selectedScopes || []).length > 0
      ? delegationFormData.selectedScopes
      : ['all'];

    try {
      setSubmittingDelegation(true);
      const payload = {
        userId: delegationFormData.userId,
        title: delegationFormData.title.trim() || 'Acting Sub-Admin',
        durationMode: delegationFormData.durationMode,
        customExpiresAt: delegationFormData.durationMode === 'custom' ? delegationFormData.customExpiresAt : null,
        isIndefinite: delegationFormData.durationMode === 'indefinite',
        scopes: effectiveScopes,
        notes: delegationFormData.notes.trim(),
      };
      const res = await adminApi.createDelegation(payload);
      if (res.success) {
        triggerToast('success', res.message || 'Sub-Admin powers granted successfully!', 'Delegation Granted');
        setIsCreateDelegationModalOpen(false);
        setDelegationFormData(DEFAULT_DELEGATION_FORM);
        setDelegationUserSearch('');
        setDelegationSearchResults([]);
        loadDelegations();
        loadUsers(userPagination.page);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to grant delegation', 'Delegation Failed');
    } finally {
      setSubmittingDelegation(false);
    }
  };

  const handleUpdateDelegationScopes = async (delegationId, newScopes) => {
    try {
      setSavingDelegationScopes(true);
      const res = await adminApi.updateDelegationScopes(delegationId, newScopes);
      if (res && res.success) {
        triggerToast('success', res.message || 'Feature permissions updated successfully!');
        setEditingDelegationScopes(null);
        loadDelegations();
        loadUsers(userPagination.page);
      } else {
        throw new Error(res.message || 'Failed to update feature permissions');
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update feature permissions');
    } finally {
      setSavingDelegationScopes(false);
    }
  };

  const handleRevokeDelegation = async (delegationId, targetName) => {
    if (
      !window.confirm(
        `⚠️ REVOKE SUB-ADMIN PRIVILEGES:\n\nAre you sure you want to revoke Sub-Admin powers from ${targetName}?\n\nThey will immediately be stripped of Super Admin access and revert to their normal role.`
      )
    ) {
      return;
    }
    try {
      const res = await adminApi.revokeDelegation(delegationId);
      if (res.success) {
        triggerToast('success', res.message || 'Delegation revoked', 'Privilege Revoked');
        loadDelegations();
        loadUsers(userPagination.page);
        if (selectedUser && (selectedUser.delegationId === delegationId || selectedUser._id === res.delegation?.userId)) {
          setSelectedUser((prev) => ({
            ...prev,
            isDelegatedSubAdmin: false,
            delegatedRole: null,
            delegationId: null,
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to revoke delegation', 'Revoke Error');
    }
  };

  const handleUpdateDelegationDuration = async (delegationId, durationMode, customExpiresAt) => {
    try {
      const res = await adminApi.updateDelegationDuration(delegationId, {
        durationMode,
        customExpiresAt,
        isIndefinite: durationMode === 'indefinite',
      });
      if (res.success) {
        triggerToast('success', res.message || 'Duration updated successfully', 'Duration Updated');
        loadDelegations();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update duration', 'Duration Error');
    }
  };

  // Update individual user device limit handler
  const handleUpdateDeviceLimit = async (userId, limitValue) => {
    try {
      const payloadLimit = limitValue === '' ? null : Number(limitValue);
      const res = await adminApi.updateUserDeviceLimit(userId, payloadLimit);
      if (res.success) {
        triggerToast('success', res.message, 'Device Limit Updated');
        loadUsers(userPagination.page);
        if (selectedUser && selectedUser._id === userId) {
          setSelectedUser((prev) => ({
            ...prev,
            maxDevices: res.user.maxDevices,
            effectiveDeviceLimit: res.user.effectiveDeviceLimit,
          }));
          setEditUserData((prev) => ({
            ...prev,
            maxDevices: res.user.maxDevices !== null ? res.user.maxDevices : '',
          }));
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'Limit Update Failed');
    }
  };

  // Toggle account status
  const handleToggleUserStatus = async (userId, newStatus) => {
    try {
      const res = await adminApi.updateUserStatus(userId, { accountStatus: newStatus });
      if (res.success) {
        triggerToast('success', res.message, 'Status Updated');
        loadUsers(userPagination.page);
        if (selectedUser && selectedUser._id === userId) {
          handleSelectUser({ ...selectedUser, accountStatus: newStatus });
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'Action Failed');
    }
  };

  // Force logout all sessions for a user
  const handleForceLogoutUser = async (userId) => {
    if (!window.confirm('Are you sure you want to invalidate all active sessions for this user?')) return;
    try {
      const res = await adminApi.forceLogoutUser(userId);
      if (res.success) {
        triggerToast('success', res.message, 'Force Logout Executed');
        if (selectedUser && selectedUser._id === userId) {
          handleSelectUser(selectedUser);
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'Logout Failed');
    }
  };

  // Unlock user lockout handler
  const handleUnlockUser = async (userId, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await adminApi.unlockUser(userId);
      if (res.success) {
        triggerToast('success', res.message, 'Account Unlocked');
        loadUsers(userPagination.page);
        if (selectedUser && selectedUser._id === userId) {
          setSelectedUser((prev) => ({
            ...prev,
            isLocked: false,
            lockUntil: null,
            lockMinutesRemaining: 0,
            failedLoginAttempts: 0,
          }));
          if (userDetails?.user) {
            setUserDetails((prev) => ({
              ...prev,
              user: {
                ...prev.user,
                isLocked: false,
                lockUntil: null,
                lockMinutesRemaining: 0,
                failedLoginAttempts: 0,
              },
            }));
          }
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'Unlock Failed');
    }
  };

  // Lock user account handler
  const handleLockUser = async (userId, durationMinutes = 15, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await adminApi.lockUser(userId, durationMinutes);
      if (res.success) {
        triggerToast('success', res.message, 'Account Locked');
        loadUsers(userPagination.page);
        if (selectedUser && selectedUser._id === userId) {
          const updated = res.user || {};
          setSelectedUser((prev) => ({
            ...prev,
            isLocked: true,
            lockUntil: updated.lockUntil,
            lockMinutesRemaining: updated.lockMinutesRemaining || durationMinutes,
            failedLoginAttempts: updated.failedLoginAttempts || 5,
          }));
          if (userDetails?.user) {
            setUserDetails((prev) => ({
              ...prev,
              user: {
                ...prev.user,
                isLocked: true,
                lockUntil: updated.lockUntil,
                lockMinutesRemaining: updated.lockMinutesRemaining || durationMinutes,
                failedLoginAttempts: updated.failedLoginAttempts || 5,
              },
            }));
          }
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'Lock Failed');
    }
  };

  // Adjust lock duration handler (extend or reduce lock time)
  const handleAdjustUserLock = async (userId, adjustMinutes, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await adminApi.adjustUserLock(userId, adjustMinutes);
      if (res.success) {
        triggerToast('success', res.message, adjustMinutes > 0 ? 'Lock Extended' : 'Lock Reduced');
        loadUsers(userPagination.page);
        if (selectedUser && selectedUser._id === userId) {
          const updated = res.user || {};
          setSelectedUser((prev) => ({
            ...prev,
            isLocked: updated.isLocked,
            lockUntil: updated.lockUntil,
            lockMinutesRemaining: updated.lockMinutesRemaining || 0,
            failedLoginAttempts: updated.failedLoginAttempts || 0,
          }));
          if (userDetails?.user) {
            setUserDetails((prev) => ({
              ...prev,
              user: {
                ...prev.user,
                isLocked: updated.isLocked,
                lockUntil: updated.lockUntil,
                lockMinutesRemaining: updated.lockMinutesRemaining || 0,
                failedLoginAttempts: updated.failedLoginAttempts || 0,
              },
            }));
          }
        }
      }
    } catch (err) {
      triggerToast('error', err.message, 'Adjustment Failed');
    }
  };

  // Reset password execution
  const handleExecutePasswordReset = async (e) => {
    e.preventDefault();
    const { userId, newPassword, adminPassword } = resetPasswordModal;
    if (!newPassword || newPassword.length < 6) {
      triggerToast('error', 'New password must be at least 6 characters', 'Validation');
      return;
    }
    if (!adminPassword) {
      triggerToast('error', 'Super Admin confirmation password is required', 'Validation');
      return;
    }
    try {
      const res = await adminApi.resetUserPassword(userId, newPassword, adminPassword);
      if (res.success) {
        triggerToast('success', res.message, 'Password Reset');
        setResetPasswordModal({ open: false, userId: null, newPassword: '', adminPassword: '' });
      }
    } catch (err) {
      triggerToast('error', err.message, 'Reset Failed');
    }
  };

  // Revoke individual session
  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm(`Revoke session ${sessionId}? The user will be logged out immediately.`)) return;
    try {
      const res = await adminApi.revokeSession(sessionId);
      if (res.success) {
        triggerToast('success', res.message, 'Session Revoked');
        loadSessions(sessionPagination.page);
      }
    } catch (err) {
      triggerToast('error', err.message, 'Revoke Failed');
    }
  };

  // Save System Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await adminApi.updateConfig(config);
      if (res.success) {
        triggerToast('success', 'System login and session limits updated successfully', 'Settings Saved');
        setConfig(res.config);
      }
    } catch (err) {
      triggerToast('error', err.message, 'Config Save Failed');
    } finally {
      setSavingConfig(false);
    }
  };

  // Send Notification
  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notifyForm.title.trim() || !notifyForm.body.trim()) {
      triggerToast('error', 'Title and body are required', 'Notification');
      return;
    }

    try {
      setSendingNotify(true);
      const res = await adminApi.sendNotification(notifyForm);
      if (res.success) {
        triggerToast('success', res.message, 'Push Campaign Dispatched');
        setNotifyForm({
          title: '',
          body: '',
          imageUrl: '',
          targetAudience: 'ALL_DEVICES',
          targetCriteria: { sessionId: '', registrationNumber: '', role: 'student', hostel: 'BH-1' },
          route: '/',
        });
        loadCampaigns();
      }
    } catch (err) {
      triggerToast('error', err.message, 'Dispatch Failed');
    } finally {
      setSendingNotify(false);
    }
  };

  // Maintenance Handlers
  const handleSaveMaintenance = async (payloadOverride) => {
    const payload = payloadOverride || maintenanceConfig;
    try {
      setSavingMaintenance(true);
      const res = await adminApi.updateMaintenanceConfig(payload);
      if (res.success) {
        triggerToast('success', res.message || 'Maintenance settings applied successfully', 'Maintenance');
        loadMaintenance();
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to update maintenance settings', 'Maintenance Error');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleToggleGlobalSwitch = (newEnabled) => {
    if (newEnabled) {
      setConfirmGlobalModal(true);
    } else {
      const updated = {
        ...maintenanceConfig,
        global: { ...maintenanceConfig.global, enabled: false },
      };
      setMaintenanceConfig(updated);
      handleSaveMaintenance(updated);
    }
  };

  const handleConfirmEnableGlobal = () => {
    setConfirmGlobalModal(false);
    const updated = {
      ...maintenanceConfig,
      global: { ...maintenanceConfig.global, enabled: true },
    };
    setMaintenanceConfig(updated);
    handleSaveMaintenance(updated);
  };

  const handleToggleSelectiveSwitch = (newEnabled) => {
    const updated = {
      ...maintenanceConfig,
      selective: { ...maintenanceConfig.selective, enabled: newEnabled },
    };
    setMaintenanceConfig(updated);
    handleSaveMaintenance(updated);
  };

  const handleAddTargetReg = (e) => {
    if (e) e.preventDefault();
    const clean = targetRegInput.trim().toUpperCase();
    if (!clean) return;
    const current = maintenanceConfig.selective.affectedRegistrationNumbers || [];
    if (current.includes(clean)) {
      triggerToast('warning', `Registration number ${clean} is already in the list`, 'Duplicate');
      return;
    }
    const updated = {
      ...maintenanceConfig,
      selective: {
        ...maintenanceConfig.selective,
        affectedRegistrationNumbers: [...current, clean],
      },
    };
    setMaintenanceConfig(updated);
    setTargetRegInput('');
  };

  const handleRemoveTargetReg = (regToRemove) => {
    const updated = {
      ...maintenanceConfig,
      selective: {
        ...maintenanceConfig.selective,
        affectedRegistrationNumbers: maintenanceConfig.selective.affectedRegistrationNumbers.filter(
          (r) => r !== regToRemove
        ),
      },
    };
    setMaintenanceConfig(updated);
  };

  const handleToggleRoleSelection = (role) => {
    const current = maintenanceConfig.selective.affectedRoles || [];
    const updatedRoles = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setMaintenanceConfig((prev) => ({
      ...prev,
      selective: {
        ...prev.selective,
        affectedRoles: updatedRoles,
      },
    }));
  };

  const handleDisableAllMaintenance = () => {
    const updated = {
      ...maintenanceConfig,
      global: { ...maintenanceConfig.global, enabled: false },
      selective: { ...maintenanceConfig.selective, enabled: false },
    };
    setMaintenanceConfig(updated);
    handleSaveMaintenance(updated);
  };

  const handleSaveAppVersion = async (e) => {
    if (e) e.preventDefault();
    setSavingAppVersion(true);
    try {
      const res = await adminApi.updateAppVersionConfig(appVersionConfig);
      if (res.success) {
        triggerToast('success', res.message || 'App version configuration saved', 'App Version Updated');
        setAppVersionConfig(res.appVersion);
      }
    } catch (err) {
      triggerToast('error', err.message || 'Failed to save app version configuration', 'Save Error');
    } finally {
      setSavingAppVersion(false);
    }
  };

  return (
    <div className="sa-portal-container">
      {/* 1. Header Banner */}
      <div className="sa-header-banner">
        <div className="sa-header-info">
          <div className="sa-header-icon">
            🛡️
          </div>
          <div className="sa-header-text">
            <div className="sa-header-title-row">
              <h1 className="sa-header-title">
                Super Admin Control Panel
              </h1>
              <span className="sa-badge-rbac">
                RBAC PRIVILEGED
              </span>
            </div>
            <p className="sa-header-subtitle">
              Centralized user directory, session control, device limits, push dispatch & security audits
            </p>
          </div>

          <div className="sa-header-actions">
            <button
              type="button"
              onClick={openMyProfileModal}
              id="sa-header-my-profile-btn"
              className="sa-header-profile-action-btn"
              title="Edit your Super Admin name, email, registration number, and master password"
            >
              <span>👤</span>
              <span>My Profile</span>
            </button>
          </div>
        </div>

        {/* Delegated Sub-Admin Banner Alert */}
        {isDelegatedSubAdmin && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.22) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>👑</span>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 750, color: '#fbbf24' }}>
                  Acting Sub-Admin Portal: {currentUser.delegationTitle || 'Sub-Admin'}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(251, 191, 36, 0.9)', marginTop: '2px' }}>
                  {currentUser.delegationIndefinite
                    ? '♾️ Privileges Active: Valid until manually revoked by Super Admin (Jab Super Admin Chahe)'
                    : `⏳ Privileges Active: Valid until ${currentUser.delegationExpiresAt ? new Date(currentUser.delegationExpiresAt).toLocaleString() : 'scheduled expiry'}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fef3c7' }}>Granted Features:</span>
              {userScopes.includes('all') ? (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.3)',
                    color: '#6ee7b7',
                    fontSize: '0.74rem',
                    fontWeight: 750,
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                  }}
                >
                  🌟 Full Super Admin Power (All Features)
                </span>
              ) : (
                userScopes.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.25)',
                      color: '#fde68a',
                      fontSize: '0.72rem',
                      fontWeight: 650,
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    {DELEGATION_FEATURE_MODULES.find((m) => m.id === s)?.label.split(' ')[0] || ''} {s}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab Switcher Pills */}
        <div className="sa-tab-bar">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`sa-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. TAB: OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div>
          {/* Top 4 KPI Cards */}
          <div className="sa-kpi-grid">
            {[
              { title: 'Total Registered Users', value: overview.stats.totalUsers, icon: '👥', color: '#4361ee' },
              { title: 'Active Accounts', value: overview.stats.activeUsers, icon: '✅', color: '#10b981' },
              { title: 'Active Device Sessions', value: overview.stats.activeSessions, icon: '📱', color: '#8b5cf6' },
              { title: 'Notification Campaigns', value: overview.stats.totalCampaigns, icon: '📢', color: '#f59e0b' },
            ].map((kpi, idx) => (
              <div key={idx} className="sa-kpi-card">
                <div>
                  <div className="sa-kpi-title">{kpi.title}</div>
                  <div className="sa-kpi-value">{kpi.value}</div>
                </div>
                <div
                  className="sa-kpi-icon-box"
                  style={{
                    background: `${kpi.color}18`,
                    color: kpi.color,
                  }}
                >
                  {kpi.icon}
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown Grids */}
          <div className="sa-breakdown-grid">
            {/* Roles Breakdown */}
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--border-color)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                User Distribution by Role
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {Object.entries(overview.roleBreakdown || {}).map(([roleName, count]) => (
                  <div key={roleName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{roleName}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Device Type Breakdown */}
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--border-color)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Active Devices by Platform
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {Object.entries(overview.deviceBreakdown || {}).map(([deviceType, count]) => (
                  <div key={deviceType} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {deviceType === 'android' ? '🤖 Android Phone / Tablet' : deviceType === 'browser' ? '🌐 Web Browser' : '💻 Desktop Client'}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Audit Trail Preview */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Recent Security Audit Logs
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                View Full Audit Trail →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(overview.recentActivity || []).map((log) => (
                <div key={log._id} className="sa-audit-item">
                  <div className="sa-audit-item-left">
                    <span className="sa-audit-badge">[{log.action}]</span>
                    <span className="sa-audit-summary">{log.summary}</span>
                  </div>
                  <div className="sa-audit-item-meta">
                    by {log.adminRegistrationNumber} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: USER DIRECTORY */}
      {activeTab === 'users' && (
        <div className={`sa-users-grid ${selectedUser ? 'has-selection' : ''}`}>
          {/* Main Users Table */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Locked Accounts Radar Pill / Banner */}
            {lockedUsersCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  marginBottom: '1.25rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.25) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }}>🔒</span>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 750, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Security Radar: {lockedUsersCount} Account{lockedUsersCount > 1 ? 's' : ''} Locked Out</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.3)',
                          color: '#ffffff',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                        }}
                      >
                        POLICY ALERT
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'rgba(252, 165, 165, 0.85)', marginTop: '2px' }}>
                      Users reached maximum failed login attempts or were administratively locked. 1-click unlock available.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUserFilters((prev) => ({ ...prev, status: 'locked' }));
                      loadUsers(1);
                    }}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.6)',
                      background: 'rgba(239, 68, 68, 0.35)',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <span>🎯</span>
                    <span>Filter Locked ({lockedUsersCount})</span>
                  </button>
                  {userFilters.status === 'locked' && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserFilters((prev) => ({ ...prev, status: 'all' }));
                        loadUsers(1);
                      }}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: 650,
                        cursor: 'pointer',
                      }}
                    >
                      Show All
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Filters Row */}
            <div className="sa-filters-bar">
              <input
                type="text"
                placeholder="Search by reg#, name, email..."
                value={userFilters.search}
                onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="sa-filter-search"
              />

              <select
                value={userFilters.role}
                onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value }))}
                className="sa-filter-select"
              >
                <option value="all">All Roles</option>
                <option value="student">Student</option>
                <option value="caretaker">Caretaker</option>
                <option value="warden">Warden</option>
                <option value="superintendent">Superintendent</option>
                <option value="superadmin">Super Admin</option>
              </select>

              <select
                value={userFilters.status}
                onChange={(e) => setUserFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="sa-filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="locked">🔒 Locked Out</option>
                <option value="deactivated">Deactivated</option>
                <option value="suspended">Suspended</option>
              </select>

              <div className="sa-filter-actions-row">
                <button
                  type="button"
                  onClick={() => loadUsers(1)}
                  className="sa-filter-btn sa-search-btn"
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={() => setCreateUserModalOpen(true)}
                  className="sa-create-user-filter-btn"
                  id="btn-open-create-user-modal"
                >
                  <span>➕</span>
                  <span>Create User</span>
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="sa-desktop-table">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Registration #</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Name & Email</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Hostel / Room</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Devices</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {loading ? 'Loading users...' : 'No users found matching query.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u._id}
                        onClick={() => handleSelectUser(u)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          background: selectedUser?._id === u._id ? 'var(--primary-light)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {u.registrationNumber}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email || 'No email registered'}</div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: u.role === 'superadmin' ? '#7c3aed22' : 'var(--bg-secondary)',
                              color: u.role === 'superadmin' ? '#7c3aed' : 'var(--text-primary)',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              fontSize: '0.75rem',
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {u.hostel} {u.roomNumber ? `• Rm ${u.roomNumber}` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background:
                                  (u.activeDeviceCount || 0) >= (u.maxDevices || config.maxConcurrentSessions || 3)
                                    ? '#fef3c7'
                                    : 'var(--bg-secondary)',
                                color:
                                  (u.activeDeviceCount || 0) >= (u.maxDevices || config.maxConcurrentSessions || 3)
                                    ? '#b45309'
                                    : 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              {u.activeDeviceCount || 0} / {u.maxDevices || config.maxConcurrentSessions || 3} devices
                            </span>
                            {u.maxDevices && (
                              <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontWeight: 700 }}>
                                (Custom)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                background:
                                  u.accountStatus === 'active'
                                    ? 'var(--success-bg)'
                                    : 'var(--danger-bg)',
                                color:
                                  u.accountStatus === 'active'
                                    ? 'var(--success-text)'
                                    : 'var(--danger-text)',
                              }}
                            >
                              {u.accountStatus}
                            </span>
                            {u.isLocked && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Temporarily locked due to multiple wrong passwords. ${u.lockMinutesRemaining}m remaining.`}
                              >
                                🔒 Locked ({u.lockMinutesRemaining}m)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {u.isLocked && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleUnlockUser(u._id, e)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(16, 185, 129, 0.5)',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: '#059669',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Unlock user account immediately"
                                >
                                  🔓 Unlock
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleAdjustUserLock(u._id, 15, e)}
                                  style={{
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Extend lock time by 15 minutes"
                                >
                                  +15m
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleAdjustUserLock(u._id, -15, e)}
                                  style={{
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Reduce lock time by 15 minutes"
                                >
                                  -15m
                                </button>
                              </>
                            )}
                            {u._id !== currentUser?.id && u.role !== 'superadmin' && u.accountStatus === 'active' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImpersonateUser(u);
                                }}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(99, 102, 241, 0.4)',
                                  background: 'rgba(99, 102, 241, 0.12)',
                                  color: '#6366f1',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Login as ${u.name} (${u.role})`}
                              >
                                ⚡ Login As
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectUser(u);
                              }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Details →
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="sa-mobile-cards">
              {users.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading users...' : 'No users found matching query.'}
                </div>
              ) : (
                users.map((u) => (
                  <div
                    key={u._id}
                    className={`sa-user-card ${selectedUser?._id === u._id ? 'selected' : ''}`}
                    onClick={() => handleSelectUser(u)}
                  >
                    <div className="sa-user-card-header">
                      <div className="sa-user-card-reg">{u.registrationNumber}</div>
                      <div className="sa-user-card-badges">
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: u.role === 'superadmin' ? '#7c3aed22' : 'var(--bg-card)',
                            color: u.role === 'superadmin' ? '#7c3aed' : 'var(--text-primary)',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            fontSize: '0.72rem',
                          }}
                        >
                          {u.role}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background:
                              u.accountStatus === 'active'
                                ? 'var(--success-bg)'
                                : 'var(--danger-bg)',
                            color:
                              u.accountStatus === 'active'
                                ? 'var(--success-text)'
                                : 'var(--danger-text)',
                          }}
                        >
                          {u.accountStatus}
                        </span>
                        {u.isLocked && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            🔒 Locked ({u.lockMinutesRemaining}m)
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="sa-user-card-name">{u.name}</div>
                      <div className="sa-user-card-email">{u.email || 'No email registered'}</div>
                    </div>

                    <div className="sa-user-card-details">
                      <span>🏢 {u.hostel || 'Hostel N/A'} {u.roomNumber ? `• Rm ${u.roomNumber}` : ''}</span>
                      <span>📱 {u.activeDeviceCount || 0} / {u.maxDevices || config.maxConcurrentSessions || 3} devices</span>
                    </div>

                    <div className="sa-user-card-actions">
                      {u.isLocked && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleUnlockUser(u._id, e)}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(16, 185, 129, 0.5)',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            🔓 Unlock
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAdjustUserLock(u._id, 15, e)}
                            style={{
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Extend lock by 15 mins"
                          >
                            +15m
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAdjustUserLock(u._id, -15, e)}
                            style={{
                              padding: '0.4rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Reduce lock by 15 mins"
                          >
                            -15m
                          </button>
                        </>
                      )}
                      {u._id !== currentUser?.id && u.role !== 'superadmin' && u.accountStatus === 'active' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImpersonateUser(u);
                          }}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#6366f1',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          ⚡ Login As
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleTogglePilotTargetUser(u, e)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          border: (appVersionConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase())
                            ? '1px solid rgba(245, 158, 11, 0.6)'
                            : '1px solid var(--border-color)',
                          background: (appVersionConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase())
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'var(--bg-card)',
                          color: (appVersionConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase())
                            ? '#f59e0b'
                            : 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title={
                          (appVersionConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase())
                            ? 'Remove this user from pilot app release'
                            : 'Release new update only to this user'
                        }
                      >
                        {(appVersionConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase())
                          ? '🎯 In Pilot ✓'
                          : '🎯 Release Update'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectUser(u);
                        }}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Manage Details →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.825rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ color: 'var(--text-muted)' }}>
                Page {userPagination.page} of {userPagination.totalPages} ({userPagination.total} users)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={userPagination.page <= 1}
                  onClick={() => loadUsers(userPagination.page - 1)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    cursor: userPagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: userPagination.page <= 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={userPagination.page >= userPagination.totalPages}
                  onClick={() => loadUsers(userPagination.page + 1)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    cursor: userPagination.page >= userPagination.totalPages ? 'not-allowed' : 'pointer',
                    opacity: userPagination.page >= userPagination.totalPages ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* User Details & Management Modal Popup */}
          {selectedUser && (
            <div
              className="sa-user-details-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedUser(null);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.72)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9995,
                padding: '1rem',
                boxSizing: 'border-box',
              }}
            >
              <div
                className="sa-user-details-drawer sa-user-details-modal-dialog"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  maxHeight: '90vh',
                  maxWidth: '680px',
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  overflowY: 'auto',
                }}
              >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    style={{
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                    }}
                  >
                    ← Back to List
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    User Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ×
                </button>
              </div>

              {/* Status & ID Badge */}
              <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {selectedUser.registrationNumber}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: selectedUser.accountStatus === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: selectedUser.accountStatus === 'active' ? 'var(--success-text)' : 'var(--danger-text)',
                    }}
                  >
                    {selectedUser.accountStatus}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Activation: {selectedUser.isActivated ? 'Activated' : 'Pending Activation'} • Last login:{' '}
                  {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'}
                </div>
              </div>

              {/* Lockout Warning Banner */}
              {selectedUser.isLocked && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔒</span> Account Temporarily Locked
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>
                        Remaining: ~<strong>{selectedUser.lockMinutesRemaining || 1} min</strong> (failed attempts: {selectedUser.failedLoginAttempts || 5})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlockUser(selectedUser._id)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #10b981',
                        background: '#10b981',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      🔓 Unlock Account Now
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Adjust Lock Time:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdjustUserLock(selectedUser._id, 15)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      +15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustUserLock(selectedUser._id, 30)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      +30m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustUserLock(selectedUser._id, 60)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      +1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustUserLock(selectedUser._id, -15)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      -15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustUserLock(selectedUser._id, -30)}
                      style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      -30m
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Profile Form */}
              <form onSubmit={handleSaveUserProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-secondary)' }}>Registration Number</label>
                    <input
                      type="text"
                      value={editUserData.registrationNumber || ''}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, registrationNumber: e.target.value.toUpperCase() }))}
                      placeholder="e.g. 21BCE1000"
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-secondary)' }}>Full Name</label>
                    <input
                      type="text"
                      value={editUserData.name}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, name: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                  <input
                    type="email"
                    value={editUserData.email}
                    onChange={(e) => setEditUserData((prev) => ({ ...prev, email: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</label>
                    <select
                      value={editUserData.role}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, role: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="caretaker">Caretaker</option>
                      <option value="warden">Warden</option>
                      <option value="superintendent">Superintendent</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hostel</label>
                    <input
                      type="text"
                      value={editUserData.hostel}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, hostel: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Room #</label>
                    <input
                      type="text"
                      value={editUserData.roomNumber}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, roomNumber: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Direct New Password</label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep"
                      value={editUserData.newPassword || ''}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, newPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Individual Device Limit Field */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Device Limit (maxDevices)
                    </label>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'var(--primary-light, #e0e7ff)',
                        color: 'var(--primary)',
                      }}
                    >
                      Usage: {userDetails?.user?.activeDeviceCount ?? userDetails?.activeSessions?.length ?? selectedUser?.activeDeviceCount ?? 0} / {editUserData.maxDevices || selectedUser?.maxDevices || config.maxConcurrentSessions || 3} devices
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      placeholder={`System default (${config.maxConcurrentSessions})`}
                      value={editUserData.maxDevices}
                      onChange={(e) => setEditUserData((prev) => ({ ...prev, maxDevices: e.target.value }))}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateDeviceLimit(selectedUser._id, editUserData.maxDevices)}
                      style={{
                        padding: '0.45rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--primary)',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Update Limit
                    </button>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Set a positive integer (1, 2, 3...) or clear to use the system-wide default ({config.maxConcurrentSessions}).
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '0.55rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  Save Profile Updates
                </button>
              </form>

              {/* Administrative Actions Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ADMINISTRATIVE ACTIONS</div>

                {selectedUser.role === 'superadmin' ? (
                  <div
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#059669',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🛡️</span> SuperAdmin accounts are permanently exempt from all login lockouts.
                  </div>
                ) : selectedUser.isLocked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleUnlockUser(selectedUser._id)}
                      style={{
                        padding: '0.55rem',
                        borderRadius: '6px',
                        border: '1px solid #10b981',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#059669',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🔓</span> Unlock Account (Clear Login Lockout)
                    </button>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleAdjustUserLock(selectedUser._id, 15)}
                        style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⏱️ +15m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustUserLock(selectedUser._id, 60)}
                        style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⏱️ +1h
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustUserLock(selectedUser._id, -15)}
                        style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⏱️ -15m
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedUser.failedLoginAttempts > 0 && (
                      <button
                        type="button"
                        onClick={() => handleUnlockUser(selectedUser._id)}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        🔄 Reset Failed Attempts ({selectedUser.failedLoginAttempts})
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleLockUser(selectedUser._id, config.lockoutDurationMinutes || 15)}
                        style={{
                          flex: 1,
                          padding: '0.55rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                        title={`Lock account for ${config.lockoutDurationMinutes || 15} minutes`}
                      >
                        <span>🔒</span> Lock Account ({config.lockoutDurationMinutes || 15}m)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const mins = window.prompt("Enter lock duration in minutes:", "60");
                          if (mins && !isNaN(parseInt(mins))) {
                            handleLockUser(selectedUser._id, parseInt(mins));
                          }
                        }}
                        style={{
                          padding: '0.55rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                        title="Lock for custom duration"
                      >
                        Custom...
                      </button>
                    </div>
                  </div>
                )}

                {selectedUser.accountStatus === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleUserStatus(selectedUser._id, 'deactivated')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--danger-border)',
                      background: 'var(--danger-bg)',
                      color: 'var(--danger-text)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    🚫 Deactivate Account & Revoke Sessions
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleUserStatus(selectedUser._id, 'active')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--success-border)',
                      background: 'var(--success-bg)',
                      color: 'var(--success-text)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✅ Activate / Enable Account
                  </button>
                )}

                {selectedUser._id !== currentUser?.id && selectedUser.role !== 'superadmin' && selectedUser.accountStatus === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleImpersonateUser(selectedUser)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: '1px solid #6366f1',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.22) 100%)',
                      color: '#6366f1',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
                    }}
                  >
                    <span>⚡</span> Login as this User (Impersonate)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setResetPasswordModal({
                      open: true,
                      userId: selectedUser._id,
                      newPassword: '',
                      adminPassword: '',
                    })
                  }
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  🔑 Reset User Password
                </button>

                <button
                  type="button"
                  onClick={() => handleFlushUser(selectedUser._id)}
                  disabled={flushingUser}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(220, 38, 38, 0.25) 100%)',
                    color: '#f87171',
                    fontWeight: 750,
                    fontSize: '0.8rem',
                    cursor: flushingUser ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: '6px',
                    width: '100%',
                    boxSizing: 'border-box',
                    whiteSpace: 'normal',
                    lineHeight: 1.3,
                    boxShadow: '0 2px 10px rgba(239, 68, 68, 0.18)',
                  }}
                  title="Revoke all active sessions, clear push tokens, prune hardware device vault, and clear lockouts"
                >
                  <span>🔥</span>
                  <span>{flushingUser ? 'Flushing Account...' : 'Flush Account (Purge Sessions & Device Vault)'}</span>
                </button>

                {selectedUser.role !== 'superadmin' && (
                  selectedUser.isDelegatedSubAdmin ? (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.22) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>👑</span> ACTIVE SUB-ADMIN
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fde68a' }}>
                          {selectedUser.delegationIndefinite ? '♾️ Until Revoked' : '⏳ Temporary'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeDelegation(selectedUser.delegationId, selectedUser.name)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.5)',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⛔ Revoke Sub-Admin Power
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDelegationFormData({
                          ...DEFAULT_DELEGATION_FORM,
                          userId: selectedUser._id,
                          targetUserName: selectedUser.name,
                          targetUserRegNo: selectedUser.registrationNumber,
                        });
                        setIsCreateDelegationModalOpen(true);
                      }}
                      style={{
                        padding: '0.55rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.2) 100%)',
                        color: '#fbbf24',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
                      }}
                      title="Delegate temporary or indefinite Sub-Admin privileges without master password"
                    >
                      <span>👑</span>
                      <span>Delegate Sub-Admin Powers...</span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => handleForceLogoutUser(selectedUser._id)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  🚪 Force Logout from All Devices
                </button>
              </div>

              {/* Active Sessions Mini-list */}
              {userDetails && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ACTIVE SESSIONS ({userDetails.activeSessions.length})
                  </div>
                  {userDetails.activeSessions.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No active sessions</div>
                  ) : (
                    userDetails.activeSessions.map((s) => (
                      <div
                        key={s.sessionId}
                        style={{
                          fontSize: '0.74rem',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          border: '1px solid var(--border-color)',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {s.deviceNickname || s.deviceType}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>
                            IP: {s.ip}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(s.sessionId)}
                          style={{
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            flexShrink: 0,
                          }}
                          title="Revoke this session"
                        >
                          Revoke
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
              </div>
            </div>
          )}

          {/* Reset Password Modal */}
          {resetPasswordModal.open && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
              }}
            >
              <form
                onSubmit={handleExecutePasswordReset}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '1.5rem',
                  maxWidth: '420px',
                  width: '100%',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Administrative Password Reset
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This will securely update the user's password using Argon2 and instantly invalidate all their existing sessions.
                </p>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    New Password for User
                  </label>
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={resetPasswordModal.newPassword}
                    onChange={(e) => setResetPasswordModal((prev) => ({ ...prev, newPassword: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--danger-text)' }}>
                    Your Super Admin Password (Re-authentication)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your admin password"
                    value={resetPasswordModal.adminPassword}
                    onChange={(e) => setResetPasswordModal((prev) => ({ ...prev, adminPassword: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setResetPasswordModal({ open: false, userId: null, newPassword: '', adminPassword: '' })}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Confirm & Reset
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Create / Provision User Account Modal */}
          {createUserModalOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
              }}
              onClick={() => setCreateUserModalOpen(false)}
            >
              <form
                onSubmit={handleCreateUserSubmit}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '1.5rem',
                  maxWidth: '500px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ➕ Create User Account
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCreateUserModalOpen(false)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Create an account for any role. You can choose whether to activate immediately with a password or leave inactive for student activation.
                </p>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={createUserData.name}
                    onChange={(e) => setCreateUserData((prev) => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                      marginTop: '4px',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Registration # *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2101297001"
                      value={createUserData.registrationNumber}
                      onChange={(e) => setCreateUserData((prev) => ({ ...prev, registrationNumber: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        marginTop: '4px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Account Role *</label>
                    <select
                      value={createUserData.role}
                      onChange={(e) => setCreateUserData((prev) => ({ ...prev, role: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        marginTop: '4px',
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="caretaker">Caretaker</option>
                      <option value="warden">Warden</option>
                      <option value="superintendent">Superintendent</option>
                      <option value="chiefHostelWarden">Chief Hostel Warden</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Hostel Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BH-1, BH-2, GH-1"
                      value={createUserData.hostel}
                      onChange={(e) => setCreateUserData((prev) => ({ ...prev, hostel: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        marginTop: '4px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Room # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. A-304"
                      value={createUserData.roomNumber}
                      onChange={(e) => setCreateUserData((prev) => ({ ...prev, roomNumber: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        marginTop: '4px',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={createUserData.email}
                    onChange={(e) => setCreateUserData((prev) => ({ ...prev, email: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                      marginTop: '4px',
                    }}
                  />
                </div>

                {/* Activation Mode Switch */}
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createUserData.activateImmediately}
                      onChange={(e) =>
                        setCreateUserData((prev) => ({ ...prev, activateImmediately: e.target.checked }))
                      }
                    />
                    <span>Activate Account Immediately?</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {createUserData.activateImmediately
                      ? '✅ Account will be active immediately. You can set the user password below.'
                      : '⏳ Account will be saved in pending activation state. User will set password during student activation.'}
                  </span>
                </div>

                {createUserData.activateImmediately && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Initial User Password (min 6 chars) *
                    </label>
                    <input
                      type="password"
                      required={createUserData.activateImmediately}
                      minLength={6}
                      placeholder="Set password for user"
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData((prev) => ({ ...prev, password: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        marginTop: '4px',
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger-text)' }}>
                    Your Super Admin Password (Re-authentication) *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your superadmin password"
                    value={createUserData.adminPassword}
                    onChange={(e) => setCreateUserData((prev) => ({ ...prev, adminPassword: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                      marginTop: '4px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setCreateUserModalOpen(false)}
                    style={{
                      padding: '0.55rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {creatingUser ? 'Provisioning...' : '🚀 Provision User'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB: SESSIONS & DEVICES */}
      {activeTab === 'sessions' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Filters */}
          <div className="sa-filters-bar">
            <input
              type="text"
              placeholder="Filter by reg#, device, IP..."
              value={sessionFilters.search}
              onChange={(e) => setSessionFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="sa-filter-search"
            />

            <select
              value={sessionFilters.status}
              onChange={(e) => setSessionFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="sa-filter-select"
            >
              <option value="active">Active Sessions Only</option>
              <option value="revoked">Revoked Sessions</option>
              <option value="expired">Expired Sessions</option>
              <option value="all">All Sessions</option>
            </select>

            <select
              value={sessionFilters.deviceType}
              onChange={(e) => setSessionFilters((prev) => ({ ...prev, deviceType: e.target.value }))}
              className="sa-filter-select"
            >
              <option value="all">All Device Types</option>
              <option value="android">Android Devices</option>
              <option value="browser">Web Browsers</option>
              <option value="desktop">Desktop Computers</option>
            </select>

            <button
              type="button"
              onClick={() => loadSessions(1)}
              className="sa-filter-btn"
            >
              Filter
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="sa-desktop-table">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>User</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Device Details</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>IP & Client</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Last Activity</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No session records found.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.sessionId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.registrationNumber}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.userId?.name || ''} ({s.userId?.role || ''})
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.deviceType === 'android' ? '🤖' : s.deviceType === 'desktop' ? '💻' : '🌐'} {s.deviceNickname}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.os} • {s.browser}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        <div>{s.ip}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Push: {s.pushProvider === 'none' ? 'Unsubscribed' : s.pushProvider.toUpperCase()}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            background:
                              s.status === 'active'
                                ? 'var(--success-bg)'
                                : 'var(--danger-bg)',
                            color:
                              s.status === 'active'
                                ? 'var(--success-text)'
                                : 'var(--danger-text)',
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {new Date(s.lastActivityAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        {s.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.sessionId)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              border: '1px solid var(--danger-border)',
                              background: 'var(--danger-bg)',
                              color: 'var(--danger-text)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="sa-mobile-cards">
            {sessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No session records found.
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s.sessionId} className="sa-session-card">
                  <div className="sa-session-card-top">
                    <div className="sa-session-card-device">
                      {s.deviceType === 'android' ? '🤖' : s.deviceType === 'desktop' ? '💻' : '🌐'} {s.deviceNickname}
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background:
                          s.status === 'active'
                            ? 'var(--success-bg)'
                            : 'var(--danger-bg)',
                        color:
                          s.status === 'active'
                            ? 'var(--success-text)'
                            : 'var(--danger-text)',
                      }}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="sa-session-card-user">
                    {s.registrationNumber} • {s.userId?.name || ''} ({s.userId?.role || ''})
                  </div>

                  <div className="sa-session-card-meta">
                    <div>📱 {s.os} • {s.browser} • IP: {s.ip}</div>
                    <div>🔔 Push: {s.pushProvider === 'none' ? 'Unsubscribed' : s.pushProvider.toUpperCase()}</div>
                    <div>🕒 Last Active: {new Date(s.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(s.lastActivityAt).toLocaleDateString()}</div>
                  </div>

                  {s.status === 'active' && (
                    <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(s.sessionId)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid var(--danger-border)',
                          background: 'var(--danger-bg)',
                          color: 'var(--danger-text)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Revoke Session
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. TAB: LOGIN LIMITS & CONFIGURATION */}
      {activeTab === 'limits' && (
        <form
          onSubmit={handleSaveConfig}
          className="sa-limits-form"
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            maxWidth: '680px',
            margin: '0 auto',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Configurable Login & Device Security Rules
          </h2>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            These limits are strictly validated in the MongoDB backend during authentication to prevent account sharing and unauthorized access.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Maximum Concurrent Sessions Per User
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.maxConcurrentSessions}
                onChange={(e) => setConfig((prev) => ({ ...prev, maxConcurrentSessions: parseInt(e.target.value) || 1 }))}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Limits how many simultaneous active logins a single user may hold (Recommended: 2 - 4).
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Maximum Registered Devices Per User
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.maxRegisteredDevices}
                onChange={(e) => setConfig((prev) => ({ ...prev, maxRegisteredDevices: parseInt(e.target.value) || 1 }))}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="revokeOldestCheck"
                checked={config.revokeOldestOnLimit}
                onChange={(e) => setConfig((prev) => ({ ...prev, revokeOldestOnLimit: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="revokeOldestCheck" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Automatically revoke oldest session when login exceeds limit
              </label>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-8px', marginLeft: '28px' }}>
              If unchecked, new login attempts that exceed the limit will be blocked until the user manually logs out elsewhere.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Session Inactivity Timeout (Minutes)
              </label>
              <input
                type="number"
                min="15"
                max="43200"
                value={config.sessionInactivityTimeoutMinutes}
                onChange={(e) => setConfig((prev) => ({ ...prev, sessionInactivityTimeoutMinutes: parseInt(e.target.value) || 1440 }))}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                10080 minutes = 7 days. Sessions without activity beyond this duration will be marked expired.
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛡️</span> Failed Login Lockout & Token Lifespan
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Configure protection against brute-force password guessing and decide client session token longevity.
                <strong style={{ color: '#10b981', display: 'block', marginTop: '4px' }}>
                  ✓ SuperAdmin accounts are permanently exempt from all login lockouts.
                </strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Failed Password Attempts Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.failedLoginThreshold ?? 5}
                    onChange={(e) => setConfig((prev) => ({ ...prev, failedLoginThreshold: parseInt(e.target.value) || 5 }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Number of consecutive wrong password entries before account is locked (Default: 5 attempts).
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Global Account Lockout Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={config.lockoutDurationMinutes ?? 15}
                    onChange={(e) => setConfig((prev) => ({ ...prev, lockoutDurationMinutes: parseInt(e.target.value) || 15 }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[5, 10, 15, 30, 60, 1440].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className="sa-preset-chip"
                        onClick={() => setConfig((prev) => ({ ...prev, lockoutDurationMinutes: mins }))}
                        style={{
                          border: config.lockoutDurationMinutes === mins ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: config.lockoutDurationMinutes === mins ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                          color: config.lockoutDurationMinutes === mins ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {mins === 60 ? '1 hour' : mins === 1440 ? '24 hours' : `${mins} min`}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Default lockout duration applied automatically when a user exceeds failed password attempts.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    JWT Authentication Token Lifespan (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={config.jwtLifespanDays ?? 90}
                    onChange={(e) => setConfig((prev) => ({ ...prev, jwtLifespanDays: parseInt(e.target.value) || 90 }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[7, 14, 30, 60, 90, 180, 365].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className="sa-preset-chip"
                        onClick={() => setConfig((prev) => ({ ...prev, jwtLifespanDays: days }))}
                        style={{
                          border: config.jwtLifespanDays === days ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: config.jwtLifespanDays === days ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                          color: config.jwtLifespanDays === days ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    How long client login JWT tokens stay valid before requiring re-authentication (Default: 90 days).
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              style={{
                padding: '0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: savingConfig ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-primary)',
              }}
            >
              {savingConfig ? 'Saving Configuration...' : 'Save System Security Rules'}
            </button>
          </div>
        </form>
      )}

      {/* 6. TAB: MAINTENANCE MANAGEMENT */}
      {activeTab === 'maintenance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Active Maintenance Status Alert Banner */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--border-radius-lg)',
              border: maintenanceConfig.global.enabled
                ? '1px solid rgba(239, 68, 68, 0.4)'
                : maintenanceConfig.selective.enabled
                ? '1px solid rgba(245, 158, 11, 0.4)'
                : '1px solid rgba(16, 185, 129, 0.3)',
              background: maintenanceConfig.global.enabled
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.08) 100%)'
                : maintenanceConfig.selective.enabled
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.06) 100%)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  fontSize: '2rem',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))',
                }}
              >
                {maintenanceConfig.global.enabled ? '🚨' : maintenanceConfig.selective.enabled ? '⚠️' : '✅'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {maintenanceConfig.global.enabled
                      ? 'Global Maintenance is Active'
                      : maintenanceConfig.selective.enabled
                      ? 'Selective Maintenance is Active'
                      : 'All Services Operational'}
                  </h3>
                  {maintenanceConfig.global.enabled && maintenanceConfig.selective.enabled && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: '#dc2626',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                      }}
                    >
                      GLOBAL PRECEDENCE
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {maintenanceConfig.global.enabled
                    ? 'HostelCare is currently unavailable to all students, caretakers, wardens, and superintendents. Only Super Admins retain access.'
                    : maintenanceConfig.selective.enabled
                    ? `Restricting selected roles (${(maintenanceConfig.selective.affectedRoles || []).join(', ') || 'none'}) and ${(maintenanceConfig.selective.affectedRegistrationNumbers || []).length} targeted account(s). Unaffected roles continue operating normally.`
                    : 'System is running normally. No maintenance modes are currently restricting student or staff access.'}
                </p>
              </div>
            </div>

            {(maintenanceConfig.global.enabled || maintenanceConfig.selective.enabled) && (
              <button
                type="button"
                onClick={handleDisableAllMaintenance}
                disabled={savingMaintenance}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                }}
              >
                🛑 Disable All Maintenance
              </button>
            )}
          </div>

          {/* Two Mode Configuration Cards */}
          <div className="sa-two-col-grid">
            {/* Mode 1: Global Maintenance Card */}
            <div
              className="sa-config-card"
              style={{
                border: maintenanceConfig.global.enabled ? '2px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-color)',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.4rem' }}>🌐</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Mode 1: Global Maintenance
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Takes precedence over selective mode
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleGlobalSwitch(!maintenanceConfig.global.enabled)}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '20px',
                      border: 'none',
                      background: maintenanceConfig.global.enabled ? '#ef4444' : 'var(--bg-secondary)',
                      color: maintenanceConfig.global.enabled ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {maintenanceConfig.global.enabled ? '🔴 Active (Disable)' : '⚪ Inactive (Enable)'}
                  </button>
                </div>

                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Temporarily makes HostelCare unavailable to normal users. Normal users receive HTTP 503 and a maintenance screen. Super Admins retain full access for monitoring and recovery.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Custom Maintenance Title
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={maintenanceConfig.global.title}
                      onChange={(e) =>
                        setMaintenanceConfig((prev) => ({
                          ...prev,
                          global: { ...prev.global, title: e.target.value },
                        }))
                      }
                      placeholder="System Maintenance in Progress"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Custom Maintenance Message
                    </label>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={maintenanceConfig.global.message}
                      onChange={(e) =>
                        setMaintenanceConfig((prev) => ({
                          ...prev,
                          global: { ...prev.global, message: e.target.value },
                        }))
                      }
                      placeholder="HostelCare is temporarily undergoing scheduled maintenance. Please check back shortly."
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div className="sa-form-grid-2col">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Planned Start (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={maintenanceConfig.global.plannedStart}
                        onChange={(e) =>
                          setMaintenanceConfig((prev) => ({
                            ...prev,
                            global: { ...prev.global, plannedStart: e.target.value },
                          }))
                        }
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Planned End (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={maintenanceConfig.global.plannedEnd}
                        onChange={(e) =>
                          setMaintenanceConfig((prev) => ({
                            ...prev,
                            global: { ...prev.global, plannedEnd: e.target.value },
                          }))
                        }
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => handleSaveMaintenance()}
                  disabled={savingMaintenance}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: savingMaintenance ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingMaintenance ? 'Saving...' : 'Save Global Settings'}
                </button>
                {maintenanceConfig.global.enabled && (
                  <button
                    type="button"
                    onClick={() => handleToggleGlobalSwitch(false)}
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--danger-border)',
                      background: 'var(--danger-bg)',
                      color: 'var(--danger-text)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Disable Mode 1
                  </button>
                )}
              </div>
            </div>

            {/* Mode 2: Selective / Role-Based Maintenance Card */}
            <div
              className="sa-config-card"
              style={{
                border: maintenanceConfig.selective.enabled ? '2px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-color)',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.4rem' }}>🎯</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Mode 2: Selective Maintenance
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Role-based and targeted user restriction
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleSelectiveSwitch(!maintenanceConfig.selective.enabled)}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '20px',
                      border: 'none',
                      background: maintenanceConfig.selective.enabled ? '#f59e0b' : 'var(--bg-secondary)',
                      color: maintenanceConfig.selective.enabled ? '#000000' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {maintenanceConfig.selective.enabled ? '🟠 Active (Disable)' : '⚪ Inactive (Enable)'}
                  </button>
                </div>

                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Restricts access for selected roles or specific registration numbers while other roles continue using HostelCare normally.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {/* Affected Roles Multi-Select Checkboxes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Affected User Roles
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {[
                        { role: 'student', label: 'Student' },
                        { role: 'caretaker', label: 'Caretaker' },
                        { role: 'warden', label: 'Warden' },
                        { role: 'superintendent', label: 'Superintendent' },
                      ].map((item) => {
                        const isChecked = (maintenanceConfig.selective.affectedRoles || []).includes(item.role);
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => handleToggleRoleSelection(item.role)}
                            style={{
                              padding: '0.35rem 0.8rem',
                              borderRadius: '6px',
                              border: isChecked ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                              background: isChecked ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-secondary)',
                              color: isChecked ? '#f59e0b' : 'var(--text-secondary)',
                              fontSize: '0.8rem',
                              fontWeight: isChecked ? 700 : 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <span>{isChecked ? '✓' : '+'}</span>
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Target Users by Registration Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Specific Users by Registration Number (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '100%', minWidth: 0 }}>
                      <input
                        type="text"
                        placeholder="e.g. 21BCE1001"
                        value={targetRegInput}
                        onChange={(e) => setTargetRegInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTargetReg(e)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddTargetReg}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                    </div>

                    {/* Tag list */}
                    {(maintenanceConfig.selective.affectedRegistrationNumbers || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                        {maintenanceConfig.selective.affectedRegistrationNumbers.map((reg) => (
                          <span
                            key={reg}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.75rem',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {reg}
                            <button
                              type="button"
                              onClick={() => handleRemoveTargetReg(reg)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--danger-text)',
                                cursor: 'pointer',
                                padding: 0,
                                fontWeight: 700,
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Selective Mode Title
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={maintenanceConfig.selective.title}
                      onChange={(e) =>
                        setMaintenanceConfig((prev) => ({
                          ...prev,
                          selective: { ...prev.selective, title: e.target.value },
                        }))
                      }
                      placeholder="Service Temporarily Unavailable"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Selective Mode Message
                    </label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={maintenanceConfig.selective.message}
                      onChange={(e) =>
                        setMaintenanceConfig((prev) => ({
                          ...prev,
                          selective: { ...prev.selective, message: e.target.value },
                        }))
                      }
                      placeholder="Access for your account or user group is currently paused for scheduled system maintenance."
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => handleSaveMaintenance()}
                  disabled={savingMaintenance}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: savingMaintenance ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingMaintenance ? 'Saving...' : 'Save Selective Settings'}
                </button>
                {maintenanceConfig.selective.enabled && (
                  <button
                    type="button"
                    onClick={() => handleToggleSelectiveSwitch(false)}
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--danger-border)',
                      background: 'var(--danger-bg)',
                      color: 'var(--danger-text)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Disable Mode 2
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6b. TAB: APP VERSION & UPDATE MANAGEMENT */}
      {activeTab === 'appversion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Info Banner */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>📲</span>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Mobile App Update Management
                </h2>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Configure Android version requirements, Google Play In-App Updates, and forced security rollouts.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: appVersionConfig.forceUpdate ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: appVersionConfig.forceUpdate ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                  color: appVersionConfig.forceUpdate ? '#ef4444' : '#10b981',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{appVersionConfig.forceUpdate ? '🚨 Forced Mode (Immediate)' : '✨ Flexible Mode (Optional)'}</span>
              </div>

              <button
                type="button"
                onClick={loadAppVersion}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Manual Check for Update Card */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem 1.5rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CLIENT APP UPDATE STATUS
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Installed Version: <strong>v{installedAppVersion}</strong></span>
                {manualCheckResult?.status === 'up_to_date' && (
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                    You're up to date!
                  </span>
                )}
              </div>
              {manualCheckResult ? (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color:
                      manualCheckResult.status === 'up_to_date'
                        ? '#10b981'
                        : manualCheckResult.status === 'update_available'
                        ? '#38bdf8'
                        : '#ef4444',
                  }}
                >
                  {manualCheckResult.message}
                </div>
              ) : (
                <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click below to verify if your device has the latest released HostelCare APK.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                disabled={manualChecking}
                onClick={handleManualCheckForUpdates}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: manualChecking ? 'not-allowed' : 'pointer',
                  opacity: manualChecking ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                <span>{manualChecking ? '⏳ Checking...' : '🔍 Check for Update'}</span>
              </button>
              {manualCheckResult?.status === 'update_available' && (
                <button
                  type="button"
                  onClick={() => appUpdateService.performUpdate()}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Update Now
                </button>
              )}
            </div>
          </div>

          <div className="sa-two-col-grid">
            {/* Version Configuration Form Card */}
            <form
              onSubmit={handleSaveAppVersion}
              className="sa-config-card"
              style={{
                gap: '1rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Version Parameters
              </h3>

              {/* Release Suspension (Pause / Resume) Control Card */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: appVersionConfig.isSuspended ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                  border: appVersionConfig.isSuspended ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.25rem' }}>{appVersionConfig.isSuspended ? '⏸️' : '🟢'}</span>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Release Status: {appVersionConfig.isSuspended ? 'SUSPENDED (PAUSED)' : 'ACTIVE (ROLLING OUT)'}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: appVersionConfig.isSuspended ? '#ef4444' : '#10b981',
                        color: '#fff',
                      }}
                    >
                      {appVersionConfig.isSuspended ? 'PAUSED' : 'LIVE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {appVersionConfig.isSuspended
                      ? '⚠️ Production updates are paused. Users will not receive global update notifications (Pilot testing remains independent).'
                      : 'All eligible clients (based on Rollout Audience below) are receiving update checks and prompts.'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={savingAppVersion}
                    onClick={handleToggleReleaseSuspension}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: appVersionConfig.isSuspended
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: savingAppVersion ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: appVersionConfig.isSuspended
                        ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                        : '0 4px 12px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    {appVersionConfig.isSuspended ? '▶️ Resume Release' : '⏸️ Suspend Release'}
                  </button>

                  <button
                    type="button"
                    disabled={deletingAppRelease || savingAppVersion}
                    onClick={handleDeleteAppRelease}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#f87171',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: deletingAppRelease ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title="Permanently delete this release notes, URL and reset to baseline"
                  >
                    <span>{deletingAppRelease ? '⏳ Deleting...' : '🗑️ Delete Release'}</span>
                  </button>
                </div>
              </div>

              <div className="sa-form-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Latest Version *
                  </label>
                  <input
                    type="text"
                    required
                    value={appVersionConfig.latestVersion}
                    onChange={(e) => setAppVersionConfig((prev) => ({ ...prev, latestVersion: e.target.value }))}
                    placeholder="e.g. 1.2.0"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Highest released version on Play Store.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Minimum Supported Version *
                  </label>
                  <input
                    type="text"
                    required
                    value={appVersionConfig.minimumSupportedVersion}
                    onChange={(e) => setAppVersionConfig((prev) => ({ ...prev, minimumSupportedVersion: e.target.value }))}
                    placeholder="e.g. 1.0.0"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Any app below this version is blocked.
                  </div>
                </div>
              </div>

              {/* Force Update Toggle */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: appVersionConfig.forceUpdate ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)',
                  border: appVersionConfig.forceUpdate ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    Enforce Immediate Update (All Outdated Versions)
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    When enabled, any client with version below Latest Version will be blocked until updated.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAppVersionConfig((prev) => ({ ...prev, forceUpdate: !prev.forceUpdate }))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    background: appVersionConfig.forceUpdate ? '#ef4444' : 'var(--border-color)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {appVersionConfig.forceUpdate ? 'ACTIVE (BLOCKING)' : 'DISABLED'}
                </button>
              </div>

              {/* Release Target Audience Selector */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: appVersionConfig.targetAudience === 'specific' ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-secondary)',
                  border: appVersionConfig.targetAudience === 'specific' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🎯 Release Rollout Audience</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: appVersionConfig.targetAudience === 'specific' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: appVersionConfig.targetAudience === 'specific' ? '#f59e0b' : '#3b82f6',
                        }}
                      >
                        {appVersionConfig.targetAudience === 'specific' ? 'PILOT / SPECIFIC USERS' : 'GLOBAL (ALL USERS)'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Release to everyone globally or selectively test with specific users (filtered by Name or Registration Number).
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--bg-card)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => handleSelectTargetAudience('all')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: appVersionConfig.targetAudience === 'all' ? 'var(--primary)' : 'transparent',
                        color: appVersionConfig.targetAudience === 'all' ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      🌐 All Users
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTargetAudience('specific')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: appVersionConfig.targetAudience === 'specific' ? '#f59e0b' : 'transparent',
                        color: appVersionConfig.targetAudience === 'specific' ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      🎯 Specific Users
                    </button>
                  </div>
                </div>

                {appVersionConfig.targetAudience === 'specific' && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', paddingTop: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Filter & Add User by Name or Registration Number:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={targetUserSearch}
                        onChange={(e) => handleSearchTargetUsers(e.target.value)}
                        placeholder="Search student/user name or reg number (e.g. Om Verma or 21BCON001)..."
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box',
                        }}
                      />
                      {searchingTargetUsers && (
                        <span style={{ position: 'absolute', right: '12px', top: '9px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Searching...
                        </span>
                      )}
                      {targetUserSearchResults.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 40,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            marginTop: '4px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                            maxHeight: '220px',
                            overflowY: 'auto',
                          }}
                        >
                          {targetUserSearchResults.map((u) => {
                            const isAdded = (appVersionConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase());
                            return (
                              <div
                                key={u._id}
                                onClick={() => !isAdded && handleAddTargetUser(u)}
                                style={{
                                  padding: '8px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: isAdded ? 'default' : 'pointer',
                                  opacity: isAdded ? 0.6 : 1,
                                  borderBottom: '1px solid var(--border-color)',
                                }}
                                onMouseEnter={(e) => !isAdded && (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                onMouseLeave={(e) => !isAdded && (e.currentTarget.style.background = 'transparent')}
                              >
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    {u.name}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {u.registrationNumber} • {u.role} {u.hostel ? `(${u.hostel})` : ''}
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isAdded ? '#10b981' : 'var(--primary)' }}>
                                  {isAdded ? 'Added ✓' : '+ Add to Release'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick Manual Entry */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input
                        type="text"
                        value={targetManualReg}
                        onChange={(e) => setTargetManualReg(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (targetManualReg.trim()) handleAddTargetUser(targetManualReg);
                          }
                        }}
                        placeholder="Or directly enter Reg Number (e.g. 21BCON001) & press Add"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => targetManualReg.trim() && handleAddTargetUser(targetManualReg)}
                        style={{
                          padding: '0.45rem 1rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'var(--primary)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '72px',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                        }}
                      >
                        + Add
                      </button>
                    </div>

                    {/* Chips for Selected Registration Numbers */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Active Release Targets ({appVersionConfig.targetedRegistrationNumbers?.length || 0}):
                      </div>
                      {(!appVersionConfig.targetedRegistrationNumbers || appVersionConfig.targetedRegistrationNumbers.length === 0) ? (
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontStyle: 'italic' }}>
                          ⚠️ No specific users added yet. Search above to add pilot users, or switch to "All Users".
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {appVersionConfig.targetedRegistrationNumbers.map((reg) => (
                            <span
                              key={reg}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 8px',
                                borderRadius: '14px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                color: 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              <span>👤 {reg}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTargetUser(reg)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: '0.8rem',
                                  lineHeight: 1,
                                }}
                                title="Remove User"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Update URL */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Direct APK Download Link (HTTPS)
                </label>
                <input
                  type="url"
                  value={appVersionConfig.updateUrl}
                  onChange={(e) => setAppVersionConfig((prev) => ({ ...prev, updateUrl: e.target.value }))}
                  placeholder="https://github.com/Omverma713/HostelCare/releases/download/v1.2.0/hostelcare-v1.2.0.apk"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  Must be a reachable HTTPS direct download link to the published APK asset on GitHub Releases (e.g. <code style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>https://github.com/Omverma713/HostelCare/releases/download/vX.Y.Z/hostelcare-vX.Y.Z.apk</code>). If empty or unconfigured, the app will notify users that download is pending rather than opening a broken link.
                </div>
              </div>

              {/* Release APK SHA-256 Checksum */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Release APK SHA-256 Checksum (Optional for Security Verification)
                </label>
                <input
                  type="text"
                  value={appVersionConfig.apkSha256 || ''}
                  onChange={(e) => setAppVersionConfig((prev) => ({ ...prev, apkSha256: e.target.value.trim() }))}
                  placeholder="e.g. d73fc60e13975c61d40acf56959e5953d7b2c24eeadf57c7bd54b45763fb1400"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  If provided, HostelCare verifies the downloaded APK's SHA-256 hash before launching Android's package installer.
                </div>
              </div>

              {/* Update Message */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Update Dialog Message
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={appVersionConfig.updateMessage}
                  onChange={(e) => setAppVersionConfig((prev) => ({ ...prev, updateMessage: e.target.value }))}
                  placeholder="A new version of HostelCare is available. Please update to enjoy the latest features."
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Release Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Release Notes / Changelog (Supports Screenshots, GIFs & Videos)
                </label>
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={appVersionConfig.releaseNotes}
                  onChange={(e) => setAppVersionConfig((prev) => ({ ...prev, releaseNotes: e.target.value }))}
                  placeholder="• Fixed complaint push notification sync&#10;• New UI preview: ![New Look](https://example.com/demo.gif)&#10;• https://example.com/screenshot.png"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  💡 <strong>Rich Media Supported:</strong> You can paste image/GIF/video URLs directly or use Markdown syntax (e.g. <code>![Screenshot](https://...png)</code>). Images and animated GIFs scale responsively and can be tapped for full-screen view in the Android app.
                </div>
              </div>

              {/* Changelog Media Attachments UI */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🖼️ Changelog Media Attachments ({appVersionConfig.releaseMedia?.length || 0})</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Screenshots, GIFs & Videos</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    ref={appMediaFileInputRef}
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={handleAppMediaFileUpload}
                  />
                  <input
                    type="url"
                    value={appMediaInput}
                    onChange={(e) => setAppMediaInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAppMedia())}
                    placeholder="Paste image/GIF/video HTTPS link (or click Upload File)..."
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddAppMedia}
                    id="btn-add-changelog-media"
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Add Media
                  </button>
                  <button
                    type="button"
                    onClick={() => appMediaFileInputRef.current?.click()}
                    title="Upload image or screenshot from your device"
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📁 Upload File
                  </button>
                </div>

                {/* Media items list */}
                {appVersionConfig.releaseMedia && appVersionConfig.releaseMedia.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {appVersionConfig.releaseMedia.map((url, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                            {/\.(mp4|webm|mov)(\?.*)?$/i.test(url) ? '🎥' : '🖼️'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', direction: 'rtl', textAlign: 'left' }}>
                            {url}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleInsertAppMediaToNotes(url)}
                            title="Insert Markdown snippet into notes"
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)',
                              color: 'var(--primary)',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Insert in Notes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAppMedia(url)}
                            title="Remove attachment"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              padding: '0 4px',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No media attached yet. Enter an image, screenshot, or video URL above to showcase inside the app's changelog.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={savingAppVersion}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: savingAppVersion ? 'not-allowed' : 'pointer',
                  opacity: savingAppVersion ? 0.7 : 1,
                }}
              >
                {savingAppVersion ? 'Releasing Update...' : '🚀 Release the Update'}
              </button>
            </form>

            {/* Live Client Preview Card */}
            <div className="sa-config-card">
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                📱 Live Mobile In-App Dialog Preview
              </h3>

              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '14px',
                  background: '#0d152c',
                  border: appVersionConfig.forceUpdate ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                  color: '#ffffff',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {appVersionConfig.isSuspended && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.6)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fca5a5',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    <span>⏸️</span>
                    <span>RELEASE SUSPENDED — All client update popups and force update blocks are paused.</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: appVersionConfig.forceUpdate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                    }}
                  >
                    {appVersionConfig.forceUpdate ? '🚨' : '✨'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: appVersionConfig.forceUpdate ? '#f87171' : '#a5b4fc' }}>
                      {appVersionConfig.forceUpdate ? 'CRITICAL UPDATE REQUIRED' : 'HOSTELCARE UPDATE'}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      {appVersionConfig.forceUpdate ? 'Update Required to Continue' : 'New Version Available'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    fontSize: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Current: v1.0.0</span>
                  <span style={{ color: '#818cf8' }}>→</span>
                  <span style={{ fontWeight: 800, color: '#38bdf8' }}>Available: v{appVersionConfig.latestVersion || '1.0.0'}</span>
                </div>

                <div style={{ marginBottom: '0.6rem' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: appVersionConfig.targetAudience === 'specific' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                      color: appVersionConfig.targetAudience === 'specific' ? '#f59e0b' : '#60a5fa',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {appVersionConfig.targetAudience === 'specific'
                      ? `🎯 Pilot Rollout: ${appVersionConfig.targetedRegistrationNumbers?.length || 0} Target User(s)`
                      : '🌐 Global Rollout: All Users'}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.75rem', lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {appVersionConfig.updateMessage || 'A new version of HostelCare is available.'}
                </div>

                {appVersionConfig.releaseNotes && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      fontSize: '0.725rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                      marginBottom: '0.75rem',
                      whiteSpace: 'pre-line',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '2px' }}>What's New:</div>
                    {appVersionConfig.releaseNotes}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!appVersionConfig.forceUpdate && (
                    <button
                      type="button"
                      disabled
                      style={{
                        flex: '1 1 110px',
                        minWidth: 0,
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      Later
                    </button>
                  )}
                  <button
                    type="button"
                    disabled
                    style={{
                      flex: '1 1 110px',
                      minWidth: 0,
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: appVersionConfig.forceUpdate
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {appVersionConfig.forceUpdate ? 'Update Now (Required)' : 'Update Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6c. TAB: DEDICATED PILOT TESTING SECTION */}
      {activeTab === 'pilottesting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Info Banner */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.6rem' }}>🧪</span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Pilot Testing & Canary Rollouts
                </h2>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: pilotConfig.isSuspended
                      ? 'rgba(239, 68, 68, 0.15)'
                      : pilotConfig.enabled
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(156, 163, 175, 0.15)',
                    border: pilotConfig.isSuspended
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : pilotConfig.enabled
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(156, 163, 175, 0.3)',
                    color: pilotConfig.isSuspended
                      ? '#ef4444'
                      : pilotConfig.enabled
                      ? '#10b981'
                      : '#9ca3af',
                  }}
                >
                  {pilotConfig.isSuspended
                    ? '⏸️ PILOT SUSPENDED'
                    : pilotConfig.enabled
                    ? '🟢 PILOT ACTIVE (ROLLING OUT)'
                    : '⚪ PILOT DISABLED'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Deploy pre-release APK versions (e.g. <strong>v{pilotConfig.version || '1.2.2.6'}</strong>) strictly to selected students like <strong>24E122A11</strong> before public rollout.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Suspend / Resume Button */}
              <button
                type="button"
                disabled={savingPilotConfig}
                onClick={handleTogglePilotSuspension}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: pilotConfig.isSuspended
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: savingPilotConfig ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: pilotConfig.isSuspended
                    ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                    : '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
                title={pilotConfig.isSuspended ? 'Resume this pilot release' : 'Suspend this release immediately'}
              >
                <span>{pilotConfig.isSuspended ? '▶️ Resume Pilot Release' : '⏸️ Suspend this Release'}</span>
              </button>

              {/* Delete Pilot Release Button */}
              <button
                type="button"
                disabled={deletingPilotRelease || savingPilotConfig}
                onClick={handleDeletePilotRelease}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: deletingPilotRelease ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Permanently delete this pilot release, notes and URL"
              >
                <span>{deletingPilotRelease ? '⏳ Deleting...' : '🗑️ Delete Release'}</span>
              </button>

              {/* Enable / Disable Pilot Toggle */}
              <button
                type="button"
                disabled={savingPilotConfig}
                onClick={handleTogglePilotEnabled}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: pilotConfig.enabled ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                  color: pilotConfig.enabled ? '#3b82f6' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: savingPilotConfig ? 'not-allowed' : 'pointer',
                }}
              >
                {pilotConfig.enabled ? '⚡ Pilot Enabled' : '💤 Pilot Disabled'}
              </button>

              <button
                type="button"
                onClick={loadAppVersion}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Diagnostic & User Verification Card */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔍 Live Student Pilot Diagnostic & Verification Tool</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Test if a specific student (e.g. <strong>24E122A11</strong>) will receive the pilot update when their app requests an update check.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={pilotTestQuery}
                onChange={(e) => setPilotTestQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRunPilotTestVerification();
                  }
                }}
                placeholder="Enter Student Reg No (e.g. 24E122A11)..."
                style={{
                  flex: '1 1 260px',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              />
              <button
                type="button"
                disabled={testingPilotUser}
                onClick={handleRunPilotTestVerification}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: testingPilotUser ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                {testingPilotUser ? '⏳ Diagnosing...' : '🚀 Verify Eligibility'}
              </button>
            </div>

            {/* Diagnostic Results Box */}
            {pilotTestResult && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  borderRadius: '10px',
                  background: pilotTestResult.verdict?.isEligible ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: pilotTestResult.verdict?.isEligible ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.25rem' }}>{pilotTestResult.verdict?.isEligible ? '✅' : '⚠️'}</span>
                    <strong style={{ fontSize: '0.95rem', color: pilotTestResult.verdict?.isEligible ? '#10b981' : '#ef4444' }}>
                      {pilotTestResult.verdict?.isEligible
                        ? `ELIGIBLE: User will receive Pilot Release v${pilotTestResult.pilotConfig?.version}`
                        : `NOT ELIGIBLE: ${pilotTestResult.verdict?.reason || 'Criteria not met'}`}
                    </strong>
                  </div>
                  {!pilotTestResult.checks?.inPilotGroup && (
                    <button
                      type="button"
                      onClick={() => handleAddPilotTester(pilotTestResult.student?.registrationNumber || pilotTestQuery)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Add to Pilot Testers Now
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <strong>User Found:</strong> {pilotTestResult.student ? `${pilotTestResult.student.name} (${pilotTestResult.student.role})` : '❌ Not registered'}
                  </div>
                  <div>
                    <strong>In Pilot Group:</strong> {pilotTestResult.checks?.inPilotGroup ? '✅ YES' : '❌ NO'}
                  </div>
                  <div>
                    <strong>Pilot Enabled:</strong> {pilotTestResult.checks?.pilotEnabled ? '✅ YES' : '❌ NO'}
                  </div>
                  <div>
                    <strong>Release Suspended:</strong> {pilotTestResult.checks?.isSuspended ? '⏸️ YES (Suspended)' : '🟢 NO (Active)'}
                  </div>
                  <div>
                    <strong>Active IP Mapped:</strong> {pilotTestResult.checks?.ipTracked ? `✅ YES (${pilotTestResult.checks.detectedIp})` : 'ℹ️ No active session IP'}
                  </div>
                  <div>
                    <strong>Target Version:</strong> v{pilotTestResult.pilotConfig?.version || '1.2.2.6'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sa-two-col-grid">
            {/* Left Column: Pilot Release Parameters Form */}
            <form
              onSubmit={handleSavePilotConfig}
              className="sa-config-card"
              style={{ gap: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ⚙️ Pilot Release Parameters
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: v{pilotConfig.version || '1.2.2.6'}</span>
              </div>

              {/* Prominent Per-Release Suspension Card */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: pilotConfig.isSuspended ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                  border: pilotConfig.isSuspended ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.25rem' }}>{pilotConfig.isSuspended ? '⏸️' : '🟢'}</span>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Pilot Release: {pilotConfig.isSuspended ? 'SUSPENDED (PAUSED)' : 'ACTIVE (DELIVERING)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {pilotConfig.isSuspended
                      ? '⚠️ This release is suspended. When testers check for updates, they will NOT receive update notifications.'
                      : 'Active pilot testers will receive this release update prompt immediately.'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={savingPilotConfig}
                    onClick={handleTogglePilotSuspension}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: pilotConfig.isSuspended
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: savingPilotConfig ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {pilotConfig.isSuspended ? '▶️ Resume this Release' : '⏸️ Suspend this Release'}
                  </button>

                  <button
                    type="button"
                    disabled={deletingPilotRelease || savingPilotConfig}
                    onClick={handleDeletePilotRelease}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#f87171',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: deletingPilotRelease ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title="Permanently delete this pilot release and reset all pilot parameters"
                  >
                    <span>{deletingPilotRelease ? '⏳ Deleting...' : '🗑️ Delete Release'}</span>
                  </button>
                </div>
              </div>

              <div className="sa-form-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Pilot Version *
                  </label>
                  <input
                    type="text"
                    required
                    value={pilotConfig.version}
                    onChange={(e) => setPilotConfig((prev) => ({ ...prev, version: e.target.value }))}
                    placeholder="e.g. 1.2.2.6"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Version delivered to pilot testers (e.g. 1.2.2.6).
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Pilot Enforce Immediate Update
                  </label>
                  <div
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pilotConfig.forceUpdate ? 'Immediate Blocking' : 'Flexible (Can Skip)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPilotConfig((prev) => ({ ...prev, forceUpdate: !prev.forceUpdate }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: 'none',
                        background: pilotConfig.forceUpdate ? '#ef4444' : 'var(--border-color)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                      }}
                    >
                      {pilotConfig.forceUpdate ? 'Forced' : 'Flexible'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct APK Link */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Pilot APK Direct Download URL (HTTPS)
                </label>
                <input
                  type="url"
                  required
                  value={pilotConfig.updateUrl}
                  onChange={(e) => setPilotConfig((prev) => ({ ...prev, updateUrl: e.target.value }))}
                  placeholder="https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.6/hostelcare-v1.2.2.6.apk"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Direct GitHub Release or CDN link for APK download.
                </div>
              </div>

              {/* Pilot Message */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Update Dialog Header / Banner Message
                </label>
                <input
                  type="text"
                  value={pilotConfig.updateMessage}
                  onChange={(e) => setPilotConfig((prev) => ({ ...prev, updateMessage: e.target.value }))}
                  placeholder="You have been selected for the HostelCare Pilot Beta Program! Please update to test the newest features."
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Pilot Release Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Release Notes / What's New for Pilot Testers
                </label>
                <textarea
                  rows={4}
                  value={pilotConfig.releaseNotes}
                  onChange={(e) => setPilotConfig((prev) => ({ ...prev, releaseNotes: e.target.value }))}
                  placeholder="- Fixed IP & Registration Number pilot update detection&#10;- Added one-click release suspension control&#10;- In-app complaint resolution improvements"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Pilot Changelog Media Attachments UI */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🖼️ Pilot Changelog Media Attachments ({pilotConfig.releaseMedia?.length || 0})</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Screenshots, GIFs & Videos</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    ref={pilotMediaFileInputRef}
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={handlePilotMediaFileUpload}
                  />
                  <input
                    type="url"
                    value={pilotMediaInput}
                    onChange={(e) => setPilotMediaInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPilotMedia())}
                    placeholder="Paste pilot screenshot/GIF/video HTTPS link (or click Upload File)..."
                    style={{
                      flex: 1,
                      minWidth: '200px',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddPilotMedia}
                    id="btn-add-pilot-changelog-media"
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Add Media
                  </button>
                  <button
                    type="button"
                    onClick={() => pilotMediaFileInputRef.current?.click()}
                    title="Upload image or screenshot from your device"
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📁 Upload File
                  </button>
                </div>

                {/* Media items list */}
                {pilotConfig.releaseMedia && pilotConfig.releaseMedia.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pilotConfig.releaseMedia.map((url, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                            {/\.(mp4|webm|mov)(\?.*)?$/i.test(url) ? '🎥' : '🖼️'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', direction: 'rtl', textAlign: 'left' }}>
                            {url}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleInsertPilotMediaToNotes(url)}
                            title="Insert Markdown snippet into pilot changelog"
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)',
                              color: 'var(--primary)',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Insert in Notes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePilotMedia(url)}
                            title="Remove attachment"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              padding: '0 4px',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No media attached yet. Enter an image, screenshot, or video URL above for beta testers to view.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={savingPilotConfig}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: savingPilotConfig ? 'not-allowed' : 'pointer',
                  opacity: savingPilotConfig ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                {savingPilotConfig ? 'Saving Pilot Release...' : '🚀 Save & Deploy Pilot Release'}
              </button>
            </form>

            {/* Right Column: Testers Management & Live In-App Dialog Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Testers Management Card */}
              <div className="sa-config-card" style={{ gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    👥 Designated Pilot Testers ({pilotConfig.targetedRegistrationNumbers?.length || 0})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only these users get v{pilotConfig.version}</span>
                </div>

                {/* Search & Add User */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Search & Add Student by Name or Registration Number:
                  </label>
                  <input
                    type="text"
                    value={pilotSearchQuery}
                    onChange={(e) => handleSearchPilotUsers(e.target.value)}
                    placeholder="Search student name or reg no (e.g. Om Verma or 24E122A11)..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchingPilotUsers && (
                    <span style={{ position: 'absolute', right: '12px', top: '32px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Searching...
                    </span>
                  )}
                  {pilotSearchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 40,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        marginTop: '4px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                        maxHeight: '220px',
                        overflowY: 'auto',
                      }}
                    >
                      {pilotSearchResults.map((u) => {
                        const isAdded = (pilotConfig.targetedRegistrationNumbers || []).includes(u.registrationNumber?.toUpperCase());
                        return (
                          <div
                            key={u._id}
                            onClick={() => !isAdded && handleAddPilotTester(u)}
                            style={{
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: isAdded ? 'default' : 'pointer',
                              opacity: isAdded ? 0.6 : 1,
                              borderBottom: '1px solid var(--border-color)',
                            }}
                            onMouseEnter={(e) => !isAdded && (e.currentTarget.style.background = 'var(--bg-secondary)')}
                            onMouseLeave={(e) => !isAdded && (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                {u.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {u.registrationNumber} • {u.role} {u.hostel ? `(${u.hostel})` : ''}
                              </div>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isAdded ? '#10b981' : 'var(--primary)' }}>
                              {isAdded ? 'Added ✓' : '+ Add Tester'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Direct Manual Entry */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={pilotManualReg}
                    onChange={(e) => setPilotManualReg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (pilotManualReg.trim()) handleAddPilotTester(pilotManualReg);
                      }
                    }}
                    placeholder="Or enter Reg No directly (e.g. 24E122A11)..."
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => pilotManualReg.trim() && handleAddPilotTester(pilotManualReg)}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    + Add
                  </button>
                </div>

                {/* Active Testers Chips */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Active Pilot Group Members:
                  </div>
                  {(!pilotConfig.targetedRegistrationNumbers || pilotConfig.targetedRegistrationNumbers.length === 0) ? (
                    <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontStyle: 'italic' }}>
                      ⚠️ No testers added yet. Add <strong>24E122A11</strong> to begin testing.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {pilotConfig.targetedRegistrationNumbers.map((reg) => (
                        <span
                          key={reg}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            background: reg === '24E122A11' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                            border: reg === '24E122A11' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(245, 158, 11, 0.4)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          <span>👤 {reg}</span>
                          {reg === '24E122A11' && (
                            <span style={{ fontSize: '0.65rem', background: '#4f46e5', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>
                              TARGET
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePilotTester(reg)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontWeight: 800,
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontSize: '0.85rem',
                              lineHeight: 1,
                            }}
                            title="Remove from pilot group"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile In-App Dialog Preview for Pilot */}
              <div className="sa-config-card" style={{ gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  📱 In-App Dialog Preview for Pilot Testers
                </h3>

                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: '14px',
                    background: '#0d152c',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
                    color: '#ffffff',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {pilotConfig.isSuspended && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.25)',
                        border: '1px solid rgba(239, 68, 68, 0.6)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#fca5a5',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>⏸️</span>
                      <span>PILOT RELEASE SUSPENDED — Dialog will NOT appear for testers until resumed.</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                      }}
                    >
                      🧪
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a5b4fc' }}>
                        PILOT CANARY RELEASE
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        HostelCare Beta Update Available
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '6px',
                      fontSize: '0.75rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span>Target: <strong>v{pilotConfig.version || '1.2.2.6'}</strong></span>
                    <span style={{ color: '#38bdf8' }}>Channel: Pilot Beta</span>
                  </div>

                  <div style={{ fontSize: '0.8rem', lineHeight: 1.4, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.75rem' }}>
                    {pilotConfig.updateMessage || 'You have been selected for the HostelCare Pilot Beta Program! Please update to test the newest features.'}
                  </div>

                  {pilotConfig.releaseNotes && (
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        lineHeight: 1.5,
                        marginBottom: '0.75rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)', marginBottom: '2px' }}>What's New in v{pilotConfig.version}:</div>
                      {pilotConfig.releaseNotes}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {!pilotConfig.forceUpdate && (
                      <button
                        type="button"
                        disabled
                        style={{
                          flex: '1 1 110px',
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'transparent',
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Later
                      </button>
                    )}
                    <button
                      type="button"
                      disabled
                      style={{
                        flex: '1 1 110px',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      Download & Update Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB: NOTIFICATION CENTER */}
      {activeTab === 'notifications' && (
        <div className="sa-two-col-grid">
          {/* Composer Form */}
          <form
            onSubmit={handleSendNotification}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Broadcast Push Notification
            </h2>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Send targeted alerts directly to Android phone notification shades (FCM) & web browsers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Audience</label>
                <select
                  value={notifyForm.targetAudience}
                  onChange={(e) => setNotifyForm((prev) => ({ ...prev, targetAudience: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    marginTop: '4px',
                  }}
                >
                  <option value="ALL_DEVICES">📢 All Active Devices & Users</option>
                  <option value="ROLE_GROUP">👥 Role Group (e.g. all students)</option>
                  <option value="HOSTEL_GROUP">🏢 Hostel Group (e.g. BH-1)</option>
                  <option value="SINGLE_USER">👤 Single User by Registration #</option>
                  <option value="SINGLE_DEVICE">📱 Single Session / Device ID</option>
                </select>
              </div>

              {notifyForm.targetAudience === 'ROLE_GROUP' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Target Role</label>
                  <select
                    value={notifyForm.targetCriteria.role}
                    onChange={(e) =>
                      setNotifyForm((prev) => ({
                        ...prev,
                        targetCriteria: { ...prev.targetCriteria, role: e.target.value },
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      marginTop: '4px',
                    }}
                  >
                    <option value="student">Students</option>
                    <option value="caretaker">Caretakers</option>
                    <option value="warden">Wardens</option>
                    <option value="superintendent">Superintendents</option>
                  </select>
                </div>
              )}

              {notifyForm.targetAudience === 'HOSTEL_GROUP' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hostel Name</label>
                  <input
                    type="text"
                    value={notifyForm.targetCriteria.hostel}
                    onChange={(e) =>
                      setNotifyForm((prev) => ({
                        ...prev,
                        targetCriteria: { ...prev.targetCriteria, hostel: e.target.value },
                      }))
                    }
                    placeholder="e.g. BH-1, GH-2"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                      marginTop: '4px',
                    }}
                  />
                </div>
              )}

              {notifyForm.targetAudience === 'SINGLE_USER' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={notifyForm.targetCriteria.registrationNumber}
                    onChange={(e) =>
                      setNotifyForm((prev) => ({
                        ...prev,
                        targetCriteria: { ...prev.targetCriteria, registrationNumber: e.target.value },
                      }))
                    }
                    placeholder="e.g. 21BCE1001"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                      marginTop: '4px',
                    }}
                  />
                </div>
              )}

              {notifyForm.targetAudience === 'SINGLE_DEVICE' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Session ID</label>
                  <input
                    type="text"
                    value={notifyForm.targetCriteria.sessionId}
                    onChange={(e) =>
                      setNotifyForm((prev) => ({
                        ...prev,
                        targetCriteria: { ...prev.targetCriteria, sessionId: e.target.value },
                      }))
                    }
                    placeholder="Paste internal UUID sessionId"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                      marginTop: '4px',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Notification Title</label>
                <input
                  type="text"
                  value={notifyForm.title}
                  onChange={(e) => setNotifyForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. HostelCare Emergency Notice"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    marginTop: '4px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Message Body</label>
                <textarea
                  rows={3}
                  value={notifyForm.body}
                  onChange={(e) => setNotifyForm((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Enter the push notification body..."
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    marginTop: '4px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target In-App Route</label>
                <input
                  type="text"
                  value={notifyForm.route}
                  onChange={(e) => setNotifyForm((prev) => ({ ...prev, route: e.target.value }))}
                  placeholder="e.g. /feedback, /student, /custom-notifications"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    marginTop: '4px',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    🖼️ Banner Image URL (BigPicture Rich Notification • Optional)
                  </label>
                  {notifyForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setNotifyForm((prev) => ({ ...prev, imageUrl: '' }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger-text)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      Clear Image
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={notifyForm.imageUrl}
                  onChange={(e) => setNotifyForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://example.com/banner.jpg (Direct image link for rich expandable poster)"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    marginTop: '4px',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Supports PNG, JPG, or WebP URLs. Android renders this directly as a large expandable banner image in the notification shade.
                </span>
              </div>

              {/* Live Android Notification Shade Preview */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  background: 'rgba(16, 28, 61, 0.75)',
                  border: '1px solid rgba(67, 97, 238, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        background: '#4361EE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: '#fff',
                        fontWeight: 800,
                      }}
                    >
                      🛡️
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                      HostelCare • now
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Android Shade Preview</span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                  {notifyForm.title.trim() || 'Notification Title'}
                </div>

                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  {notifyForm.body.trim() || 'Notification message body will appear here in the Android notification shade.'}
                </div>

                {notifyForm.imageUrl && notifyForm.imageUrl.trim() && (
                  <div
                    style={{
                      marginTop: '6px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      maxHeight: '180px',
                      background: '#0a0f1d',
                    }}
                  >
                    <img
                      src={notifyForm.imageUrl.trim()}
                      alt="Banner Preview"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: '180px',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={sendingNotify}
                style={{
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4361ee 0%, #3451d1 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: sendingNotify ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-primary)',
                }}
              >
                {sendingNotify ? 'Dispatching...' : '🚀 Dispatch Push Campaign'}
              </button>
            </div>
          </form>

          {/* Past Campaigns Log */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Campaign Delivery History ({campaigns.length})
            </h3>

            {campaigns.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No past notification campaigns found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
                {campaigns.map((c) => (
                  <div
                    key={c._id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.title}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: c.status === 'accepted_by_provider' ? 'var(--success-bg)' : 'var(--status-pending-bg)',
                          color: c.status === 'accepted_by_provider' ? 'var(--success-text)' : 'var(--status-pending-text)',
                        }}
                      >
                        {c.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ color: 'var(--text-secondary)' }}>{c.body}</div>

                    {c.imageUrl && (
                      <div
                        style={{
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          maxHeight: '120px',
                          marginTop: '2px',
                        }}
                      >
                        <img
                          src={c.imageUrl}
                          alt="Campaign Banner"
                          style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    )}

                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Target: {c.targetAudience} ({c.targetCount} targets) • Accepted: {c.successCount} • Failed: {c.failureCount} • Sent:{' '}
                      {new Date(c.sentAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7.5. TAB: GLOBAL POP-UP NOTICES */}
      {activeTab === 'notices' && (
        <div className="sa-notices-container">
          {/* Header Card */}
          <div className="sa-notices-header-card">
            <div>
              <h2 className="sa-notices-title">
                <span>🚨</span> Real-time Global Pop-up Notice Manager
              </h2>
              <p className="sa-notices-subtitle">
                Broadcast emergency alerts and campus announcements that instantly pop up over mobile APK and web screens with a dismiss cross (✕).
              </p>
            </div>
            <button
              type="button"
              onClick={loadNotices}
              className="sa-notices-refresh-btn"
            >
              🔄 Refresh Notices
            </button>
          </div>

          <div className="sa-notices-grid">
            {/* Left Column: Create / Broadcast Notice Form */}
            <div className="sa-notices-form-card">
              <h3 className="sa-notices-card-title">
                <span>📢</span> Broadcast New Pop-up Notice
              </h3>

              <form onSubmit={handlePublishNotice} className="sa-notices-form">
                <div className="sa-notices-field">
                  <label className="sa-notices-label">
                    Notice Headline / Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 🚨 Emergency Maintenance: Water Supply Disruption"
                    value={newNotice.title}
                    onChange={(e) => setNewNotice((prev) => ({ ...prev, title: e.target.value }))}
                    className="sa-notices-input"
                  />
                </div>

                <div className="sa-notices-form-row">
                  <div className="sa-notices-field">
                    <label className="sa-notices-label">
                      Priority Level *
                    </label>
                    <select
                      value={newNotice.priority}
                      onChange={(e) => setNewNotice((prev) => ({ ...prev, priority: e.target.value }))}
                      className="sa-notices-select"
                    >
                      <option value="urgent">🚨 Urgent / Critical Alert</option>
                      <option value="warning">⚠️ Important Notice</option>
                      <option value="info">📢 General Campus Info</option>
                    </select>
                  </div>

                  <div className="sa-notices-field">
                    <label className="sa-notices-label">
                      Target Audience *
                    </label>
                    <select
                      value={newNotice.targetRole}
                      onChange={(e) => setNewNotice((prev) => ({ ...prev, targetRole: e.target.value }))}
                      className="sa-notices-select"
                    >
                      <option value="ALL">Everyone (All Users)</option>
                      <option value="student">Students Only</option>
                      <option value="staff">Staff & Wardens</option>
                      <option value="caretaker">Caretakers Only</option>
                      <option value="warden">Wardens Only</option>
                    </select>
                  </div>
                </div>

                <div className="sa-notices-field">
                  <label className="sa-notices-label">
                    Notice Message Content (Detailed Instructions) *
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Provide full details. This message will immediately show inside a prominent pop-up on all students' and staffs' mobile apps and web screens..."
                    value={newNotice.message}
                    onChange={(e) => setNewNotice((prev) => ({ ...prev, message: e.target.value }))}
                    className="sa-notices-textarea"
                  />
                </div>

                <div className="sa-notices-warning-banner">
                  <span>⚡</span>
                  Publishing will immediately trigger real-time WebSockets and set the active pop-up banner on mobile APKs.
                </div>

                <button
                  type="submit"
                  disabled={publishingNotice}
                  className="sa-notices-submit-btn"
                >
                  {publishingNotice ? 'Broadcasting...' : '📢 Publish & Pop-up on All Devices'}
                </button>
              </form>
            </div>

            {/* Right Column: Existing Notices History & Status Controls */}
            <div className="sa-notices-list-card">
              <h3 className="sa-notices-card-title">
                <span>📜</span> Active & Broadcasted Notices ({notices.length})
              </h3>

              {notices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No global notices published yet. Use the form on the left to broadcast an emergency or campus announcement.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '600px', overflowY: 'auto' }}>
                  {notices.map((n) => (
                    <div
                      key={n._id}
                      className={`sa-notices-item-card ${n.isActive ? 'is-active' : ''}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '20px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              background: n.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                              color: n.isActive ? '#10b981' : 'var(--text-muted)',
                            }}
                          >
                            {n.isActive ? '🔴 POP-UP ACTIVE' : '⚪ INACTIVE'}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '20px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background:
                                n.priority === 'urgent'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : n.priority === 'warning'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(59, 130, 246, 0.15)',
                              color:
                                n.priority === 'urgent'
                                  ? '#ef4444'
                                  : n.priority === 'warning'
                                  ? '#d97706'
                                  : '#3b82f6',
                            }}
                          >
                            {n.priority?.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Audience: <strong>{n.targetRole || 'ALL'}</strong>
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                        </span>
                      </div>

                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 750, color: 'var(--text-primary)' }}>
                        {n.title}
                      </h4>

                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                        {n.message}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          By: {n.createdByName || 'Super Admin'}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleNoticeStatus(n._id, n.isActive)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '7px',
                              border: '1px solid var(--border-color)',
                              background: n.isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              color: n.isActive ? '#ef4444' : '#10b981',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {n.isActive ? '⏹ Deactivate' : '▶ Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNotice(n._id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '7px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'transparent',
                              color: '#ef4444',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="Delete notice"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. TAB: MESS AUTO-NOTIFICATIONS & SCHEDULE */}
      {activeTab === 'messalerts' && (
        <div className="sa-mess-container">
          {/* Header & Status Card */}
          <div className="sa-mess-card">
            <div className="sa-mess-header-row">
              <div className="sa-mess-title-group">
                <div className="sa-mess-title-line">
                  <span style={{ fontSize: '1.4rem' }}>🍱</span>
                  <h2 className="sa-mess-title">
                    Automated Mess Menu Push Notification Engine
                  </h2>
                  <span
                    className="sa-mess-status-pill"
                    style={{
                      background: messAlertConfig.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: messAlertConfig.enabled ? '#22c55e' : '#ef4444',
                      border: `1px solid ${messAlertConfig.enabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}
                  >
                    {messAlertConfig.enabled ? '● ENGINE ACTIVE' : '○ ENGINE MUTED'}
                  </span>
                </div>
                <p className="sa-mess-desc">
                  The backend background daemon inspects server IST time every 30 seconds and automatically delivers high-priority meal push notifications to all student & staff devices (FCM & WebPush) at the exact meal start time.
                </p>
              </div>

              {/* Master Toggle & Telemetry */}
              <div className="sa-mess-actions">
                <button
                  type="button"
                  onClick={() => {
                    const nextEnabled = !messAlertConfig.enabled;
                    setMessAlertConfig((prev) => ({ ...prev, enabled: nextEnabled }));
                    handleSaveMessAlertConfig({ ...messAlertConfig, enabled: nextEnabled });
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: messAlertConfig.enabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: messAlertConfig.enabled ? '#22c55e' : '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {messAlertConfig.enabled ? '🔔 Notifications: ENABLED' : '🔕 Notifications: MUTED'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextVacation = !messAlertConfig.vacationMode;
                    setMessAlertConfig((prev) => ({ ...prev, vacationMode: nextVacation }));
                    handleSaveMessAlertConfig({ ...messAlertConfig, vacationMode: nextVacation });
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 170, 0, 0.4)',
                    background: messAlertConfig.vacationMode ? 'rgba(255, 170, 0, 0.25)' : 'rgba(255, 170, 0, 0.08)',
                    color: '#ffaa00',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  title="Freeze all scheduled mess alerts during vacation/breaks without modifying timetable"
                >
                  {messAlertConfig.vacationMode ? '🏖️ Vacation Freeze: ACTIVE' : '🏖️ Vacation Mode: OFF'}
                </button>

                <button
                  type="button"
                  onClick={loadMessNotifications}
                  title="Refresh live status and active subscriber count"
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Refresh Status
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenFoodEditor()}
                  title="Open live Daily Food Items Manager to add, edit or customize dishes for any day"
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(67, 97, 238, 0.4)',
                    background: 'rgba(67, 97, 238, 0.12)',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  🍽️ Edit Daily Food Items
                </button>
              </div>

              {/* Independent Per-Meal Notification Frequency Configurator */}
              <div
                style={{
                  marginTop: '0.95rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(67, 97, 238, 0.05)',
                  border: '1px solid rgba(67, 97, 238, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📢 Notification Delivery Frequency (Independent per Meal)</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Configure how many notifications are scheduled for each meal. Changes apply to future occurrences only; past alerts are never resent.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleSetStrictSingleAlert}
                      disabled={savingMessAlerts}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                      title="Set all meals to exactly 1 notification each with 1 click"
                    >
                      ⚡ Set Strict 1x (Single Alert Per Meal)
                    </button>

                    <button
                      type="button"
                      onClick={handlePurgeDispatches}
                      disabled={purgingDispatches}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: purgingDispatches ? 'not-allowed' : 'pointer',
                      }}
                      title="Clear today's dispatched alerts from database to reset or cancel repeats"
                    >
                      {purgingDispatches ? 'Purging...' : "🗑️ Clear Today's Dispatched Alerts"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRearmSlot('all')}
                      disabled={rearmingSlot}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#c084fc',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: rearmingSlot ? 'not-allowed' : 'pointer',
                      }}
                      title="Clears all 4 meal locks for today so auto-cron will fire again on schedule"
                    >
                      {rearmingSlot ? 'Re-Arming...' : '🔄 Re-Arm All 4 Slots'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveMessAlertConfig()}
                      disabled={savingMessAlerts}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: savingMessAlerts ? 'not-allowed' : 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {savingMessAlerts ? 'Saving...' : '💾 Save Frequencies'}
                    </button>
                  </div>
                </div>

                {/* Cyberpunk Day Mode Selector (Working Day vs Sunday vs Holiday Override) */}
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(16, 28, 61, 0.95) 0%, rgba(20, 35, 75, 0.95) 100%)',
                    border: '1px solid rgba(0, 243, 255, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#00f3ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📅 Day Mode & Active Timetable Selector</span>
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: dayModeInfo?.isHolidaySchedule ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: dayModeInfo?.isHolidaySchedule ? '#f59e0b' : '#10b981',
                          border: dayModeInfo?.isHolidaySchedule ? '1px solid #f59e0b' : '1px solid #10b981',
                        }}
                      >
                        {dayModeInfo?.isHolidaySchedule ? '🏖️ Sunday & Holiday Timings Active' : '💼 Working Days Timings Active'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      Today: <strong style={{ color: 'var(--text-primary)' }}>{dayModeInfo?.weekday ? dayModeInfo.weekday.toUpperCase() : 'TODAY'}</strong>
                      {dayModeInfo?.dayModeOverride && dayModeInfo.dayModeOverride !== 'auto' && (
                        <span style={{ color: '#f43f5e', fontWeight: 750, marginLeft: '6px' }}>
                          (⚡ MANUAL OVERRIDE: {dayModeInfo.dayModeOverride.toUpperCase()})
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
                    {[
                      { key: 'auto', label: '🤖 Auto (Calendar)', desc: 'Sunday = Sunday/Holiday, Mon-Sat = Working' },
                      { key: 'working', label: '💼 Working Day', desc: 'Force Working Schedule (7:00 AM breakfast, 5:45 PM snacks)' },
                      { key: 'sunday', label: '🏖️ Sunday Timings', desc: 'Force Sunday Schedule (8:00 AM breakfast, 5:30 PM snacks)' },
                      { key: 'holiday', label: '🎉 Holiday Override', desc: 'Force Holiday Mode (Festival/Institute Holiday)' },
                    ].map((mode) => {
                      const isActive = (messAlertConfig.dayModeOverride || 'auto') === mode.key;
                      return (
                        <button
                          key={mode.key}
                          type="button"
                          onClick={() => handleToggleDayMode(mode.key)}
                          disabled={togglingDayMode}
                          style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            border: isActive ? '1px solid #00f3ff' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: isActive
                              ? 'linear-gradient(135deg, rgba(0, 243, 255, 0.22) 0%, rgba(67, 97, 238, 0.25) 100%)'
                              : 'rgba(255, 255, 255, 0.03)',
                            color: isActive ? '#00f3ff' : 'var(--text-primary)',
                            fontWeight: isActive ? 800 : 600,
                            fontSize: '0.76rem',
                            cursor: togglingDayMode ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '3px',
                            transition: 'all 0.15s ease',
                            textAlign: 'left',
                          }}
                          title={mode.desc}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span>{mode.label}</span>
                            {isActive && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>● ACTIVE</span>}
                          </div>
                          <span style={{ fontSize: '0.66rem', color: isActive ? 'rgba(0, 243, 255, 0.85)' : 'var(--text-muted)' }}>
                            {mode.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Counter Summary Strip */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      📊 Current Delivery Total:
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        fontWeight: 800,
                      }}
                    >
                      {(Number(messAlertConfig.frequencies?.breakfast || 1) +
                        Number(messAlertConfig.frequencies?.lunch || 1) +
                        Number(messAlertConfig.frequencies?.snacks || 1) +
                        Number(messAlertConfig.frequencies?.dinner || 1))} Alerts / Day Total
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      (Breakfast: {messAlertConfig.frequencies?.breakfast || 1}x, Lunch: {messAlertConfig.frequencies?.lunch || 1}x, Snacks: {messAlertConfig.frequencies?.snacks || 1}x, Dinner: {messAlertConfig.frequencies?.dinner || 1}x)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Today Dispatched So Far:</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: todayDispatches.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                        color: todayDispatches.length > 0 ? '#10b981' : '#9ca3af',
                        fontWeight: 800,
                      }}
                    >
                      {todayDispatches.length} Alert(s)
                    </span>
                  </div>
                </div>

                {/* Delayed Auto-Fire Active Countdown Banner */}
                {delayedAutoFireCountdown !== null && (
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%)',
                      border: '1px solid #f59e0b',
                      color: '#f59e0b',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      ⏱️ AUTO-FIRE ARMED: <strong>{delayedSlotKey?.toUpperCase()}</strong> broadcast will automatically trigger in <strong>{delayedAutoFireCountdown}s</strong>! Lock your phone screen now and observe the wake-lock heads-up alert!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDelayedAutoFireCountdown(null);
                        setDelayedSlotKey(null);
                      }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '5px',
                        border: '1px solid #ef4444',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                  {[
                    { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
                    { key: 'lunch',     label: 'Lunch',     emoji: '🍛' },
                    { key: 'snacks',    label: 'Snacks',    emoji: '☕' },
                    { key: 'dinner',    label: 'Dinner',    emoji: '🍲' },
                  ].map((meal) => {
                    const currentFreq = messAlertConfig.frequencies?.[meal.key] || messAlertConfig.alertCountPerMeal || 1;
                    const slotDispatch = todayDispatches.find((d) => d.mealSlot === meal.key && d.status === 'dispatched');
                    const dispatchTime = slotDispatch?.dispatchedAt
                      ? new Date(slotDispatch.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : null;

                    return (
                      <div
                        key={meal.key}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: slotDispatch ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {meal.emoji} {meal.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: currentFreq === 3 ? '#ef4444' : currentFreq === 2 ? '#f59e0b' : '#10b981',
                              background: currentFreq === 3 ? 'rgba(239, 68, 68, 0.12)' : currentFreq === 2 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Saved: {currentFreq}x
                          </span>
                        </div>

                        {/* Frequency Buttons */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          {[
                            { count: 1, label: '1x (Start)' },
                            { count: 2, label: '2x (+15m)' },
                            { count: 3, label: '3x (+30m)' },
                          ].map((opt) => (
                            <button
                              key={opt.count}
                              type="button"
                              onClick={() => {
                                const nextFrequencies = {
                                  ...messAlertConfig.frequencies,
                                  [meal.key]: opt.count,
                                };
                                setMessAlertConfig((prev) => ({
                                  ...prev,
                                  frequencies: nextFrequencies,
                                }));
                              }}
                              style={{
                                flex: 1,
                                padding: '0.35rem 0.2rem',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: currentFreq === opt.count ? 'var(--primary)' : 'var(--border-color)',
                                background: currentFreq === opt.count ? 'var(--primary)' : 'var(--bg-card)',
                                color: currentFreq === opt.count ? '#ffffff' : 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'center',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Real-time Dispatch Status Radar */}
                        <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Today's Status:</span>
                            {slotDispatch ? (
                              <span style={{ color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span>✅ DISPATCHED</span>
                                <span style={{ color: 'var(--text-muted)' }}>({dispatchTime})</span>
                              </span>
                            ) : (
                              <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                                ⏳ PENDING / UPCOMING
                              </span>
                            )}
                          </div>

                          {/* Granular Auto-Fire & Re-Arm Action Bar */}
                          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                            <button
                              type="button"
                              onClick={() => handleSimulateAutoFire(meal.key, 0)}
                              disabled={testingMessAlert}
                              style={{
                                flex: 1,
                                padding: '4px 6px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                borderRadius: '5px',
                                border: '1px solid rgba(0, 243, 255, 0.4)',
                                background: 'rgba(0, 243, 255, 0.12)',
                                color: '#00f3ff',
                                cursor: 'pointer',
                              }}
                              title="Directly trigger this meal alert using the real production auto-cron pipeline"
                            >
                              ⚡ Auto-Fire Now
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSimulateAutoFire(meal.key, 15)}
                              disabled={testingMessAlert || delayedAutoFireCountdown !== null}
                              style={{
                                padding: '4px 6px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                borderRadius: '5px',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: '#f59e0b',
                                cursor: 'pointer',
                              }}
                              title="Arms an automatic background timer for 15 seconds. Lock your phone and observe wake-lock in action!"
                            >
                              ⏱️ 15s Timer
                            </button>

                            {slotDispatch && (
                              <button
                                type="button"
                                onClick={() => handleRearmSlot(meal.key)}
                                disabled={rearmingSlot}
                                style={{
                                  padding: '4px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  borderRadius: '5px',
                                  border: '1px solid rgba(168, 85, 247, 0.4)',
                                  background: 'rgba(168, 85, 247, 0.12)',
                                  color: '#c084fc',
                                  cursor: 'pointer',
                                }}
                                title="Clears today's dispatch lock so the automatic schedule or auto-cron can fire it again"
                              >
                                🔄 Re-Arm
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Safe horizontal line */}
            <hr className="sa-mess-divider-line" />

            {/* Cyberpunk Live Device Radar & Hardware Vault HUD */}
            <div
              style={{
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(5, 19, 41, 0.95) 0%, rgba(10, 28, 61, 0.95) 100%)',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                padding: '1rem',
                boxShadow: '0 0 25px rgba(0, 243, 255, 0.08), inset 0 0 15px rgba(0, 243, 255, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Radar Status Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#00ff66',
                      boxShadow: '0 0 10px #00ff66',
                      animation: 'pulse 1.8s infinite',
                    }}
                  />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#00f3ff', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    🛰️ Live Device Radar & Hardware Vault (Layer 1 Active)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: messAlertTelemetry.radar?.fcmReady ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 170, 0, 0.15)',
                      color: messAlertTelemetry.radar?.fcmReady ? '#00ff66' : '#ffaa00',
                      border: `1px solid ${messAlertTelemetry.radar?.fcmReady ? 'rgba(0, 255, 102, 0.3)' : 'rgba(255, 170, 0, 0.3)'}`,
                    }}
                  >
                    {messAlertTelemetry.radar?.fcmReady ? '● FCM HIGH-PRIORITY: ONLINE' : '▲ FCM: VAPID / LOCAL FALLBACK'}
                  </span>
                </div>
              </div>

              {/* Holographic Radar KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', zIndex: 1 }}>
                <div
                  style={{
                    background: 'rgba(0, 243, 255, 0.05)',
                    border: '1px solid rgba(0, 243, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#00f3ff', letterSpacing: '0.5px' }}>
                    🟢 ANDROID HARDWARE VAULT
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                    {messAlertTelemetry.radar?.androidHardwareCount ?? 0}
                    <span style={{ fontSize: '0.75rem', color: '#88a0c4', fontWeight: 500, marginLeft: '4px' }}>Nodes (Permanent)</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#6882a8', marginTop: '2px' }}>Never expires if app closed</div>
                </div>

                <div
                  style={{
                    background: 'rgba(0, 255, 102, 0.05)',
                    border: '1px solid rgba(0, 255, 102, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#00ff66', letterSpacing: '0.5px' }}>
                    🌐 WEB PUSH BROWSERS
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                    {messAlertTelemetry.radar?.webPushCount ?? 0}
                    <span style={{ fontSize: '0.75rem', color: '#88a0c4', fontWeight: 500, marginLeft: '4px' }}>Browsers</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#6882a8', marginTop: '2px' }}>VAPID WebPush Subscribed</div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 170, 0, 0.05)',
                    border: '1px solid rgba(255, 170, 0, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ffaa00', letterSpacing: '0.5px' }}>
                    📡 TOTAL REACHABLE NODES
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffaa00', marginTop: '2px' }}>
                    {(messAlertTelemetry.radar?.totalReachableDevices ?? messAlertTelemetry.activePushSessionsCount) || 0}
                    <span style={{ fontSize: '0.75rem', color: '#88a0c4', fontWeight: 500, marginLeft: '4px' }}>Total Targets</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#6882a8', marginTop: '2px' }}>Ready for next automated alert</div>
                </div>

                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.5px' }}>
                    🧹 AUTO-PRUNED STALE NODES
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                    {messAlertTelemetry.radar?.staleTokensCount ?? 0}
                    <span style={{ fontSize: '0.75rem', color: '#88a0c4', fontWeight: 500, marginLeft: '4px' }}>Cleaned</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#6882a8', marginTop: '2px' }}>Uninstalled tokens purged</div>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Grid: Left = Schedule Configurator, Right = Live Test Broadcast Studio */}
          <div className="sa-mess-two-col">
            {/* LEFT: Schedule Configurator */}
            <div className="sa-mess-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ⏰ Meal Start Timings & Schedule
                </h3>

                {/* Day Category Tabs */}
                <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setScheduleDayTab('working')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: scheduleDayTab === 'working' ? 'var(--primary)' : 'transparent',
                      color: scheduleDayTab === 'working' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    Working Days (Mon–Sat)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleDayTab('sunday')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: scheduleDayTab === 'sunday' ? 'var(--primary)' : 'transparent',
                      color: scheduleDayTab === 'sunday' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    Sunday & Holidays
                  </button>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Notifications trigger precisely when IST clock reaches the Start Hour & Minute configured below.
              </p>

              {/* Meal Slots List */}
              {(() => {
                const dayKey = scheduleDayTab === 'working' ? 'workingDays' : 'sundayAndHolidays';
                const currentSchedule = messAlertConfig[dayKey] || {};
                const slotsMeta = [
                  { key: 'breakfast', name: 'Breakfast', emoji: '🍳', defaultNote: 'Morning Meal' },
                  { key: 'lunch',     name: 'Lunch',     emoji: '🍛', defaultNote: 'Afternoon Meal' },
                  { key: 'snacks',    name: 'Evening Snacks', emoji: '☕', defaultNote: 'High Tea' },
                  { key: 'dinner',    name: 'Dinner',    emoji: '🍲', defaultNote: 'Night Meal' },
                ];

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {slotsMeta.map((slot) => {
                      const item = currentSchedule[slot.key] || { startHour: 0, startMinute: 0, timing: '' };
                      const hourStr = String(item.startHour ?? 0).padStart(2, '0');
                      const minStr = String(item.startMinute ?? 0).padStart(2, '0');

                      const updateSlotField = (field, val) => {
                        setMessAlertConfig((prev) => ({
                          ...prev,
                          [dayKey]: {
                            ...prev[dayKey],
                            [slot.key]: {
                              ...prev[dayKey]?.[slot.key],
                              [field]: val,
                            },
                          },
                        }));
                      };

                      return (
                        <div key={slot.key} className="sa-mess-slot-card">
                          <div className="sa-mess-slot-header">
                            <div className="sa-mess-slot-name">
                              <span style={{ fontSize: '1.15rem' }}>{slot.emoji}</span>
                              <span>{slot.name}</span>
                            </div>
                            <span className="sa-mess-slot-badge">
                              Alert Time: {hourStr}:{minStr} IST
                            </span>
                          </div>

                          <div className="sa-mess-slot-grid">
                            {/* Start Hour */}
                            <div className="sa-mess-field">
                              <label className="sa-mess-field-lbl">
                                Start Hour (0-23)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={item.startHour ?? 0}
                                onChange={(e) => updateSlotField('startHour', parseInt(e.target.value, 10) || 0)}
                                className="sa-mess-input"
                              />
                            </div>

                            {/* Start Minute */}
                            <div className="sa-mess-field">
                              <label className="sa-mess-field-lbl">
                                Start Minute (0-59)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={item.startMinute ?? 0}
                                onChange={(e) => updateSlotField('startMinute', parseInt(e.target.value, 10) || 0)}
                                className="sa-mess-input"
                              />
                            </div>

                            {/* Display Timing String */}
                            <div className="sa-mess-field sa-mess-slot-grid-span2">
                              <label className="sa-mess-field-lbl">
                                Display Timing (Banner Text)
                              </label>
                              <input
                                type="text"
                                value={item.timing || ''}
                                placeholder="e.g. 07:00 AM – 09:15 AM"
                                onChange={(e) => updateSlotField('timing', e.target.value)}
                                className="sa-mess-input"
                                style={{ fontWeight: 400 }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={savingMessAlerts}
                  onClick={() => handleSaveMessAlertConfig()}
                  style={{
                    flex: '1 1 180px',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4361ee 0%, #3451d1 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: savingMessAlerts ? 'not-allowed' : 'pointer',
                    boxShadow: 'var(--shadow-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {savingMessAlerts ? '💾 Saving Schedule...' : '💾 Save Timing Schedule'}
                </button>

                <button
                  type="button"
                  onClick={handleResetMessScheduleToOfficial}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reset to Official (08/10/2026)
                </button>
              </div>
            </div>

            {/* RIGHT: Live Test Broadcast Studio */}
            <div className="sa-mess-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  🧪 Interactive Test Broadcast Dispatcher
                </h3>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Simulate an automated notification trigger right now for any meal slot. Pulls today’s active mess menu items directly from the database and broadcasts to all active student devices.
                </p>
              </div>

              {/* Slot Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Select Meal Slot to Test:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {[
                    { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
                    { id: 'lunch',     label: 'Lunch',     emoji: '🍛' },
                    { id: 'snacks',    label: 'Snacks',    emoji: '☕' },
                    { id: 'dinner',    label: 'Dinner',    emoji: '🍲' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTestSlotKey(s.id)}
                      style={{
                        padding: '0.55rem 0.25rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: testSlotKey === s.id ? 'var(--primary)' : 'var(--border-color)',
                        background: testSlotKey === s.id ? 'rgba(67, 97, 238, 0.12)' : 'var(--bg-secondary)',
                        color: testSlotKey === s.id ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: testSlotKey === s.id ? 700 : 500,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '1rem' }}>{s.emoji}</div>
                      <div>{s.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Device Preview Card Mockup */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Live Notification Preview (Mobile & PWA Banner):
                </label>
                <div
                  style={{
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    padding: '0.85rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>🛡️</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>HostelCare Mess</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>• Just now</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'rgba(67, 97, 238, 0.15)',
                        color: 'var(--primary)',
                        fontWeight: 700,
                      }}
                    >
                      TEST DISPATCH
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {testSlotKey === 'breakfast' && '🍳 Breakfast is Ready!'}
                    {testSlotKey === 'lunch' && '🍛 Lunch is Served!'}
                    {testSlotKey === 'snacks' && '☕ Evening Snacks Ready!'}
                    {testSlotKey === 'dinner' && '🍲 Dinner is Served!'}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Today's {testSlotKey.charAt(0).toUpperCase() + testSlotKey.slice(1)} menu items will be dynamically embedded from the active mess schedule. Tap to view the full nutrition and weekly timetable.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Action: Opens /mess-menu</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>• High Priority Alert</span>
                  </div>
                </div>
              </div>

              {/* Dual Cyberpunk Action Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {/* Instant 1-Click Phone Ping */}
                <button
                  type="button"
                  disabled={testingMessAlert}
                  onClick={() => handleTestMessAlert(true)}
                  style={{
                    padding: '0.8rem',
                    borderRadius: '8px',
                    border: '1px solid #00f3ff',
                    background: 'linear-gradient(135deg, #00f3ff 0%, #0077ff 100%)',
                    color: '#051329',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: testingMessAlert ? 'not-allowed' : 'pointer',
                    boxShadow: '0 0 18px rgba(0, 243, 255, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    letterSpacing: '0.5px',
                  }}
                  title="Sends high-priority test push directly to your personal phone/session only"
                >
                  {testingMessAlert ? '⚡ Dispatching...' : `📱 PING MY PHONE NOW (${testSlotKey.toUpperCase()})`}
                </button>

                {/* Universal Broadcast Test */}
                <button
                  type="button"
                  disabled={testingMessAlert}
                  onClick={() => handleTestMessAlert(false)}
                  style={{
                    padding: '0.8rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: testingMessAlert ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                  title="Sends test broadcast to all reachable registered hardware devices"
                >
                  {testingMessAlert ? '🚀 Dispatching All...' : `🚀 BROADCAST TO ALL NODES`}
                </button>
              </div>

              {/* Result Diagnostics Card */}
              {testAlertResult && (
                <div
                  style={{
                    borderRadius: '8px',
                    border: `1px solid ${testAlertResult.success ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    background: testAlertResult.success ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: testAlertResult.success ? '#22c55e' : '#ef4444' }}>
                      {testAlertResult.success ? '✅ Test Broadcast Executed Successfully' : '❌ Test Broadcast Failed'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ color: 'var(--text-primary)' }}>
                    {testAlertResult.message || (testAlertResult.success ? 'Alert delivered to provider.' : 'Failed')}
                  </div>

                  {testAlertResult.targetSessionsCount !== undefined && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      Audience: {testAlertResult.targetSessionsCount} active push sessions targeted • Meal: {testAlertResult.mealName}
                    </div>
                  )}

                  {testAlertResult.menuItems && testAlertResult.menuItems.length > 0 && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      Dishes fetched: {testAlertResult.menuItems.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Real-time Delivery Audit Feed */}
              <div
                style={{
                  marginTop: '0.65rem',
                  borderRadius: '10px',
                  background: 'rgba(5, 19, 41, 0.7)',
                  border: '1px solid rgba(0, 243, 255, 0.2)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00f3ff', letterSpacing: '0.5px' }}>
                    📋 TODAY'S REAL-TIME DELIVERY TELEMETRY LOG
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#88a0c4' }}>
                    {todayDispatches.length} Record(s) logged
                  </span>
                </div>

                {todayDispatches.length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: '#88a0c4', textAlign: 'center', padding: '0.75rem' }}>
                    No alerts triggered today yet. Next scheduled alert will log here automatically.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {todayDispatches.map((d) => {
                      const isNoDevices = d.status === 'no_devices';
                      const isSuccess = d.status === 'dispatched';
                      return (
                        <div
                          key={d._id || d.idempotencyKey}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: isNoDevices
                              ? 'rgba(255, 170, 0, 0.08)'
                              : isSuccess
                              ? 'rgba(0, 255, 102, 0.08)'
                              : 'rgba(239, 68, 68, 0.08)',
                            border: `1px solid ${
                              isNoDevices
                                ? 'rgba(255, 170, 0, 0.3)'
                                : isSuccess
                                ? 'rgba(0, 255, 102, 0.3)'
                                : 'rgba(239, 68, 68, 0.3)'
                            }`,
                            fontSize: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, color: '#ffffff', textTransform: 'capitalize' }}>
                              {d.mealSlot} #{d.occurrence}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                background: isNoDevices
                                  ? 'rgba(255, 170, 0, 0.2)'
                                  : isSuccess
                                  ? 'rgba(0, 255, 102, 0.2)'
                                  : 'rgba(239, 68, 68, 0.2)',
                                color: isNoDevices ? '#ffaa00' : isSuccess ? '#00ff66' : '#ef4444',
                              }}
                            >
                              {isNoDevices
                                ? '⚠️ 0 DEVICES (ABORTED)'
                                : isSuccess
                                ? `✅ DISPATCHED (${d.targets} NODES)`
                                : '❌ FAILED'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: '#88a0c4' }}>
                            {d.dispatchedAt ? new Date(d.dispatchedAt).toLocaleTimeString() : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 1: 📢 Emergency / Custom Mess Announcement Command Deck */}
          <div
            className="sa-mess-card"
            style={{
              marginTop: '1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 170, 0, 0.3)',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
              padding: '1.25rem',
              boxShadow: '0 0 20px rgba(255, 170, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffaa00', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📢 1-Click Custom & Emergency Announcement Dispatcher</span>
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  Instantly broadcast custom messages, holiday updates, or sudden timetable changes to student phones.
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 170, 0, 0.15)',
                  color: '#ffaa00',
                  border: '1px solid rgba(255, 170, 0, 0.3)',
                }}
              >
                ⚡ HIGH-PRIORITY FLASH DISPATCH
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  Announcement Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Sunday Feast Tonight! 🍕"
                  value={customAnnouncementTitle}
                  onChange={(e) => setCustomAnnouncementTitle(e.target.value)}
                  className="sa-mess-input"
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', borderColor: 'rgba(255, 170, 0, 0.3)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  Target Hostel Block
                </label>
                <select
                  value={customAnnouncementTargetBlock}
                  onChange={(e) => setCustomAnnouncementTargetBlock(e.target.value)}
                  className="sa-mess-input"
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', borderColor: 'rgba(255, 170, 0, 0.3)' }}
                >
                  <option value="all">📢 Universal (All Hostel Students)</option>
                  <option value="Block A">🏢 Block A Only</option>
                  <option value="Block B">🏢 Block B Only</option>
                  <option value="Block C">🏢 Block C Only</option>
                  <option value="Block D">🏢 Block D Only</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  Announcement Body (Message details)
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Mess timing today extended by 30 mins. Hot food is now being served in both halls!"
                  value={customAnnouncementBody}
                  onChange={(e) => setCustomAnnouncementBody(e.target.value)}
                  className="sa-mess-input"
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', borderColor: 'rgba(255, 170, 0, 0.3)', resize: 'vertical' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Optional Banner Image URL (e.g. https://.../photo.jpg)"
                  value={customAnnouncementImage}
                  onChange={(e) => setCustomAnnouncementImage(e.target.value)}
                  className="sa-mess-input"
                  style={{ flex: 1, minWidth: '220px', background: 'rgba(15, 23, 42, 0.8)', color: '#ffffff', borderColor: 'rgba(255, 170, 0, 0.3)' }}
                />
                <button
                  type="button"
                  disabled={broadcastingCustomAlert}
                  onClick={handleBroadcastCustomAnnouncement}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ffaa00 0%, #ea580c 100%)',
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    cursor: broadcastingCustomAlert ? 'not-allowed' : 'pointer',
                    boxShadow: '0 0 15px rgba(255, 170, 0, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {broadcastingCustomAlert ? '⚡ Broadcasting...' : '📢 Broadcast Announcement Now'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: 📱 Single-se-Single Hardware Device Registry Directory */}
          <div
            className="sa-mess-card"
            style={{
              marginTop: '1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(0, 243, 255, 0.3)',
              background: 'linear-gradient(135deg, rgba(5, 19, 41, 0.95) 0%, rgba(10, 28, 61, 0.95) 100%)',
              padding: '1.25rem',
              boxShadow: '0 0 25px rgba(0, 243, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#00f3ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📱 Single Student Hardware Device Registry</span>
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#88a0c4', marginTop: '2px' }}>
                  Full control over every single student phone. Ping individual devices, mute alerts for students on leave, or prune uninstalled phones.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(0, 243, 255, 0.15)',
                    color: '#00f3ff',
                    border: '1px solid rgba(0, 243, 255, 0.3)',
                  }}
                >
                  {deviceRegistryPagination.total} Total Registered Hardware Nodes
                </span>

                <button
                  type="button"
                  onClick={() => loadDeviceRegistry(deviceRegistryPagination.page)}
                  disabled={loadingDeviceRegistry}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 243, 255, 0.4)',
                    background: 'rgba(0, 243, 255, 0.1)',
                    color: '#00f3ff',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  {loadingDeviceRegistry ? 'Scanning...' : '🔄 Refresh Directory'}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Search by student name, roll number, room number, or device ID..."
                value={deviceSearchQuery}
                onChange={(e) => setDeviceSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDeviceRegistry(1)}
                className="sa-mess-input"
                style={{ flex: 1, minWidth: '240px', background: 'rgba(5, 19, 41, 0.8)', color: '#ffffff', borderColor: 'rgba(0, 243, 255, 0.3)' }}
              />

              <select
                value={deviceBlockFilter}
                onChange={(e) => {
                  setDeviceBlockFilter(e.target.value);
                  setTimeout(() => loadDeviceRegistry(1), 50);
                }}
                className="sa-mess-input"
                style={{ minWidth: '150px', background: 'rgba(5, 19, 41, 0.8)', color: '#ffffff', borderColor: 'rgba(0, 243, 255, 0.3)' }}
              >
                <option value="">All Blocks</option>
                <option value="Block A">Block A</option>
                <option value="Block B">Block B</option>
                <option value="Block C">Block C</option>
                <option value="Block D">Block D</option>
              </select>

              <button
                type="button"
                onClick={() => loadDeviceRegistry(1)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #00f3ff 0%, #0084ff 100%)',
                  color: '#051329',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Search
              </button>
            </div>

            {/* Device Registry Table */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(0, 243, 255, 0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 243, 255, 0.08)', color: '#00f3ff', borderBottom: '1px solid rgba(0, 243, 255, 0.2)' }}>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Student / Reg No</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Hostel Block & Room</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Platform / Hardware</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Alert Status</th>
                    <th style={{ padding: '0.65rem 0.75rem' }}>Last Seen</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Single Device Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceRegistryList.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#88a0c4' }}>
                        {loadingDeviceRegistry ? 'Scanning hardware registry...' : 'No registered devices found matching criteria.'}
                      </td>
                    </tr>
                  ) : (
                    deviceRegistryList.map((dev) => {
                      const isMuted = dev.isMuted === true;
                      return (
                        <tr
                          key={dev.deviceId}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: isMuted ? 'rgba(255, 170, 0, 0.03)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>
                              {dev.studentName || 'Hostel Student'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#88a0c4' }}>
                              {dev.regNo || dev.deviceId.slice(0, 16)}
                            </div>
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', color: '#cbd5e1' }}>
                            <div>{dev.hostelBlock || 'Unassigned Block'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#88a0c4' }}>Room: {dev.roomNumber || 'N/A'}</div>
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: dev.platform === 'android' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(0, 243, 255, 0.15)',
                                color: dev.platform === 'android' ? '#00ff66' : '#00f3ff',
                              }}
                            >
                              {dev.platform === 'android' ? '🤖 Android Phone' : '🌐 Web Browser'}
                            </span>
                            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                              {dev.hardwareModel || 'Device'}
                            </div>
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: isMuted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 255, 102, 0.15)',
                                color: isMuted ? '#ef4444' : '#00ff66',
                              }}
                            >
                              {isMuted ? '🔕 MUTED (Skipped)' : '🟢 ACTIVE (Reachable)'}
                            </span>
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                            {dev.lastSeenAt ? new Date(dev.lastSeenAt).toLocaleDateString() : 'Active'}
                          </td>

                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {/* 1-Click Single Ping */}
                              <button
                                type="button"
                                disabled={pingingDeviceId === dev.deviceId}
                                onClick={() => handlePingSingleDevice(dev.deviceId, dev.studentName)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '5px',
                                  border: '1px solid #00f3ff',
                                  background: 'rgba(0, 243, 255, 0.15)',
                                  color: '#00f3ff',
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                  cursor: pingingDeviceId === dev.deviceId ? 'not-allowed' : 'pointer',
                                }}
                                title="Send test ping directly to this student's phone only"
                              >
                                {pingingDeviceId === dev.deviceId ? '⚡...' : '📱 Ping'}
                              </button>

                              {/* Single Mute / Unmute */}
                              <button
                                type="button"
                                disabled={mutingDeviceId === dev.deviceId}
                                onClick={() => handleToggleDeviceMute(dev.deviceId, isMuted, dev.studentName)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '5px',
                                  border: isMuted ? '1px solid #10b981' : '1px solid #f59e0b',
                                  background: isMuted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: isMuted ? '#10b981' : '#f59e0b',
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                  cursor: mutingDeviceId === dev.deviceId ? 'not-allowed' : 'pointer',
                                }}
                                title={isMuted ? 'Unmute alerts for this student' : 'Mute mess alerts for this student'}
                              >
                                {isMuted ? '🔔 Unmute' : '🔕 Mute'}
                              </button>

                              {/* Prune / Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteDeviceEntry(dev.deviceId, dev.studentName)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                }}
                                title="Prune this device from database"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {deviceRegistryPagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                {Array.from({ length: deviceRegistryPagination.totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => loadDeviceRegistry(i + 1)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: deviceRegistryPagination.page === i + 1 ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)',
                      background: deviceRegistryPagination.page === i + 1 ? '#00f3ff' : 'transparent',
                      color: deviceRegistryPagination.page === i + 1 ? '#051329' : '#88a0c4',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TAB: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Filters */}
          <div className="sa-filters-bar">
            <input
              type="text"
              placeholder="Search action summary or admin..."
              value={auditFilters.search}
              onChange={(e) => setAuditFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="sa-filter-search"
            />

            <select
              value={auditFilters.action}
              onChange={(e) => setAuditFilters((prev) => ({ ...prev, action: e.target.value }))}
              className="sa-filter-select"
            >
              <option value="all">All Actions</option>
              <option value="MAINTENANCE_MODE_UPDATED">Maintenance Mode Updated</option>
              <option value="PROFILE_UPDATE">Profile Update</option>
              <option value="ACCOUNT_ACTIVATED">Account Activated</option>
              <option value="ACCOUNT_DEACTIVATED">Account Deactivated</option>
              <option value="ACCOUNT_UNLOCKED">Account Unlocked</option>
              <option value="PASSWORD_RESET">Password Reset</option>
              <option value="SESSION_REVOKED">Session Revoked</option>
              <option value="SESSIONS_REVOKED_ALL">Force Logout All</option>
              <option value="LOGIN_LIMITS_UPDATED">Login Limits Updated</option>
              <option value="NOTIFICATION_SENT">Notification Sent</option>
              <option value="ROLE_CHANGE">Role Change</option>
            </select>

            <button
              type="button"
              onClick={() => loadAuditLogs(1)}
              className="sa-filter-btn"
            >
              Filter Logs
            </button>
          </div>

          {/* Desktop Logs Table */}
          <div className="sa-desktop-table">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Admin</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Summary</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Target</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No audit records found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.adminRegistrationNumber}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-primary)' }}>{log.summary}</td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {log.targetIdentifier || log.targetType}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)' }}>{log.ip}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="sa-mobile-cards">
            {auditLogs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No audit records found.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log._id} className="sa-audit-card">
                  <div className="sa-audit-card-head">
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'var(--primary-light, rgba(67, 97, 238, 0.1))',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    >
                      {log.action}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="sa-audit-card-summary">
                    {log.summary}
                  </div>

                  <div className="sa-audit-card-footer">
                    <span>by <strong>{log.adminRegistrationNumber}</strong></span>
                    {log.targetIdentifier && <span>Target: {log.targetIdentifier}</span>}
                    <span>IP: {log.ip}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.825rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ color: 'var(--text-muted)' }}>
              Page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.total} audit entries)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={auditPagination.page <= 1}
                onClick={() => loadAuditLogs(auditPagination.page - 1)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  cursor: auditPagination.page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: auditPagination.page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={auditPagination.page >= auditPagination.totalPages}
                onClick={() => loadAuditLogs(auditPagination.page + 1)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  cursor: auditPagination.page >= auditPagination.totalPages ? 'not-allowed' : 'pointer',
                  opacity: auditPagination.page >= auditPagination.totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. TAB: SUB-ADMIN DELEGATIONS DECK */}
      {activeTab === 'delegations' && (
        <div className="sa-delegations-deck-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Banner & Stat Cards */}
          <div
            className="sa-delegations-deck"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>👑</span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Temporary & Indefinite Sub-Admin Delegations
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Delegate elevated administrative powers to Wardens, Caretakers, or Superintendents without revealing the Master Super Admin password.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={loadDelegations}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🔄</span> Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDelegationFormData(DEFAULT_DELEGATION_FORM);
                    setDelegationUserSearch('');
                    setDelegationSearchResults([]);
                    setIsCreateDelegationModalOpen(true);
                  }}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                  }}
                >
                  <span>➕</span> Delegate Sub-Admin
                </button>
              </div>
            </div>

            {/* Quick Stat Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="sa-delegations-stat-tile" style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' }}>ACTIVE DELEGATED SUB-ADMINS</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                  {delegationsStats.active || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Currently holding live elevated rights
                </div>
              </div>

              <div className="sa-delegations-stat-tile" style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' }}>INDEFINITE (JAB TAK ADMIN CHAHE)</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                  {delegationsStats.indefinite || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Active until manually revoked by you
                </div>
              </div>

              <div className="sa-delegations-stat-tile" style={{ padding: '1rem', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="stat-label" style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' }}>TOTAL ALLOCATION HISTORY</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {delegationsStats.total || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Active, expired & revoked audit trail
                </div>
              </div>
            </div>
          </div>

          {/* Delegations Table */}
          <div
            className="sa-delegations-roster"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 750, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              📋 Delegated Sub-Admin Roster
            </div>

            {loadingDelegations ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading delegations roster...
              </div>
            ) : delegationsList.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛡️</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>No Sub-Admin Delegations Active</div>
                <p style={{ fontSize: '0.8rem', maxWidth: '420px', margin: '6px auto 16px' }}>
                  Empower trusted staff (wardens, caretakers, superintendents) to manage mess alerts, user directory, or notices during holidays or leaves.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDelegationFormData(DEFAULT_DELEGATION_FORM);
                    setDelegationUserSearch('');
                    setDelegationSearchResults([]);
                    setIsCreateDelegationModalOpen(true);
                  }}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Delegate Sub-Admin Privileges
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Sub-Admin User</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Title & Scope</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Duration & Expiry</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Granted By</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delegationsList.map((d) => (
                      <tr key={d._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 750, color: 'var(--text-primary)' }}>{d.userName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {d.userRegistrationNumber} • <span style={{ textTransform: 'capitalize' }}>{d.originalRole}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>👑</span> {d.title}
                          </div>
                          {/* Feature Scope Badges */}
                          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {!d.scopes || d.scopes.includes('all') ? (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                }}
                              >
                                🌟 All Features (Full Access)
                              </span>
                            ) : (
                              d.scopes.map((s) => (
                                <span
                                  key={s}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.68rem',
                                    fontWeight: 650,
                                  }}
                                >
                                  {DELEGATION_FEATURE_MODULES.find((m) => m.id === s)?.label.split(' ')[0] || ''} {s}
                                </span>
                              ))
                            )}
                          </div>
                          {d.notes && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>"{d.notes}"</div>}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {d.isIndefinite ? (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                fontWeight: 750,
                                fontSize: '0.72rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>♾️</span> Jab Super Admin Chahe (Until Revoked)
                            </span>
                          ) : d.expiresAt ? (
                            <div>
                              <div style={{ fontWeight: 650, color: d.isExpired ? '#ef4444' : 'var(--text-primary)' }}>
                                {new Date(d.expiresAt).toLocaleDateString()} {new Date(d.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {!d.isExpired && d.timeRemainingMinutes > 0 && (
                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 650 }}>
                                  ⏳ ~{Math.floor(d.timeRemainingMinutes / 60)}h {d.timeRemainingMinutes % 60}m left
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background:
                                d.status === 'active' && !d.isExpired
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : d.status === 'revoked'
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : 'rgba(156, 163, 175, 0.15)',
                              color:
                                d.status === 'active' && !d.isExpired
                                  ? '#10b981'
                                  : d.status === 'revoked'
                                  ? '#ef4444'
                                  : 'var(--text-muted)',
                              border: `1px solid ${
                                d.status === 'active' && !d.isExpired
                                  ? 'rgba(16, 185, 129, 0.35)'
                                  : d.status === 'revoked'
                                  ? 'rgba(239, 68, 68, 0.3)'
                                  : 'var(--border-color)'
                              }`,
                            }}
                          >
                            {d.status === 'active' && !d.isExpired ? 'ACTIVE' : d.status === 'revoked' ? 'REVOKED' : 'EXPIRED'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          by {d.delegatedByRegistrationNumber} • {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          {d.status === 'active' && !d.isExpired ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingDelegationScopes({
                                    ...d,
                                    scopes: Array.isArray(d.scopes) && d.scopes.length > 0 ? [...d.scopes] : ['all'],
                                  })
                                }
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(59, 130, 246, 0.4)',
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  color: '#60a5fa',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Edit feature permissions and scopes for this sub-admin"
                              >
                                🛡️ Permissions
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDelegationDuration(d._id, 'indefinite')}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  color: '#f59e0b',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Set duration to Until Manually Revoked (Jab Super Admin Chahe)"
                              >
                                ♾️ Make Indefinite
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeDelegation(d._id, d.userName)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ⛔ Revoke
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDelegationFormData({
                                  ...DEFAULT_DELEGATION_FORM,
                                  userId: d.userId,
                                  targetUserName: d.userName,
                                  targetUserRegNo: d.userRegistrationNumber,
                                  title: d.title || 'Acting Sub-Admin',
                                });
                                setIsCreateDelegationModalOpen(true);
                              }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.72rem',
                                fontWeight: 650,
                                cursor: 'pointer',
                              }}
                            >
                              ↺ Re-Grant
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog Before Enabling Global Maintenance */}
      {confirmGlobalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.25)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Enable Global Maintenance Mode?
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              Enabling Global Maintenance will immediately take HostelCare offline for <strong>all students, caretakers, wardens, and superintendents</strong>.
              Affected users will receive HTTP 503 and see your configured maintenance screen.
              <br /><br />
              <strong>Only Super Admins will retain access.</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmGlobalModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEnableGlobal}
                style={{
                  padding: '0.65rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                }}
              >
                Confirm & Enable Global Maintenance
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Food Items Editor Modal */}
      {isFoodEditorModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 10, 22, 0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 100000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #0f172a)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.1rem 1.4rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🍽️ Daily Mess Food Items Manager</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Add, modify, or customize dishes for any day of the week. Changes automatically expand to fit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFoodEditorModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '1.25rem 1.4rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                flex: 1,
              }}
            >
              {loadingFoodMenu ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading campus timetable...
                </div>
              ) : (
                <>
                  {/* Day Selector Pills */}
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      1. Select Day of Week
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {DAYS_ORDER.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => handleSelectFoodDaySlot(d.key, foodEditorSlot)}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: foodEditorDay === d.key ? 'var(--primary)' : 'var(--border-color)',
                            background: foodEditorDay === d.key ? 'var(--primary)' : 'var(--bg-secondary)',
                            color: foodEditorDay === d.key ? '#ffffff' : 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meal Slot Selector Pills */}
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      2. Select Meal Slot
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {MEAL_SLOTS.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => handleSelectFoodDaySlot(foodEditorDay, s.key)}
                          style={{
                            padding: '0.45rem 0.95rem',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: foodEditorSlot === s.key ? '#10b981' : 'var(--border-color)',
                            background: foodEditorSlot === s.key ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-secondary)',
                            color: foodEditorSlot === s.key ? '#10b981' : 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{s.icon}</span>
                          <span>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meal Timing Input */}
                  <div>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                      Meal Timing String (Display Banner)
                    </label>
                    <input
                      type="text"
                      value={foodTimingInput}
                      onChange={(e) => setFoodTimingInput(e.target.value)}
                      placeholder="e.g. 12:30 PM – 02:30 PM"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Food Items Editor Section */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        3. Food Items & Dishes ({foodItemsList.length} items currently)
                      </label>
                      <button
                        type="button"
                        onClick={() => setFoodBulkMode(!foodBulkMode)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {foodBulkMode ? '🏷️ Switch to Tag Chips View' : '📝 Switch to Multi-line Text Editor'}
                      </button>
                    </div>

                    {/* Mode 1: Interactive Chips & Quick Add */}
                    {!foodBulkMode && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Live Chips Container (Dynamic Auto-Wrap & Responsive Growth) */}
                        <div
                          style={{
                            minHeight: '80px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            padding: '10px',
                            borderRadius: '10px',
                            background: 'rgba(0, 0, 0, 0.22)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            alignContent: 'flex-start',
                          }}
                        >
                          {foodItemsList.length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>
                              No items added yet. Type a dish name below and tap Add Dish.
                            </span>
                          ) : (
                            foodItemsList.map((dish, idx) => (
                              <span
                                key={idx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  background: 'linear-gradient(135deg, rgba(67, 97, 238, 0.18) 0%, rgba(56, 189, 248, 0.12) 100%)',
                                  border: '1px solid rgba(67, 97, 238, 0.35)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.82rem',
                                  fontWeight: 650,
                                  maxWidth: '100%',
                                  wordBreak: 'break-word',
                                }}
                              >
                                <span>{dish}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDish(idx)}
                                  title={`Remove ${dish}`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    padding: '0 2px',
                                    lineHeight: 1,
                                  }}
                                >
                                  ✕
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Fast Add Input */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={newDishInput}
                            onChange={(e) => setNewDishInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddDish();
                              }
                            }}
                            placeholder="Type new dish name (e.g. Paneer Butter Masala, Gulab Jamun, Dal Tadka)..."
                            style={{
                              flex: 1,
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              boxSizing: 'border-box',
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAddDish}
                            style={{
                              padding: '0.65rem 1.15rem',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'var(--primary)',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ➕ Add Dish
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mode 2: Multi-line Bulk Textarea */}
                    {foodBulkMode && (
                      <textarea
                        rows={6}
                        value={foodBulkText}
                        onChange={(e) => setFoodBulkText(e.target.value)}
                        placeholder="Paste or type food items (one dish per line)&#10;Rice (Usuna / Arua)&#10;Roti&#10;Dal Tadka&#10;Paneer Butter Masala"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontFamily: 'inherit',
                          lineHeight: 1.5,
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '0.9rem 1.4rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <button
                type="button"
                onClick={handleResetFoodMenu}
                disabled={savingFoodMenu || loadingFoodMenu}
                style={{
                  padding: '0.6rem 0.95rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontWeight: 650,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                ↺ Restore 2026 Default
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsFoodEditorModalOpen(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFoodMenu}
                  disabled={savingFoodMenu || loadingFoodMenu}
                  style={{
                    padding: '0.6rem 1.35rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 750,
                    fontSize: '0.85rem',
                    cursor: savingFoodMenu ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {savingFoodMenu ? 'Saving...' : `💾 Save ${foodEditorDay.toUpperCase()} Menu`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Self-Profile Editor Modal */}
      {isMyProfileModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMyProfileModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.2)',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>👤</span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 750, color: '#c4b5fd' }}>
                    Super Admin Profile & Credentials
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Manage your personal account details, registration number, and master credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMyProfileModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {loadingMyProfile ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading admin credentials...
              </div>
            ) : (
              <form onSubmit={handleSaveMyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={myProfileData.name}
                    onChange={(e) => setMyProfileData((prev) => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Registration Number
                    </label>
                    <input
                      type="text"
                      required
                      value={myProfileData.registrationNumber}
                      onChange={(e) => setMyProfileData((prev) => ({ ...prev, registrationNumber: e.target.value.toUpperCase() }))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={myProfileData.email}
                      onChange={(e) => setMyProfileData((prev) => ({ ...prev, email: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', marginTop: '4px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c4b5fd', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔑</span> Change Password (Optional)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <input
                      type="password"
                      placeholder="New Password (min 6 characters)"
                      value={myProfileData.newPassword}
                      onChange={(e) => setMyProfileData((prev) => ({ ...prev, newPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={myProfileData.confirmPassword}
                      onChange={(e) => setMyProfileData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsMyProfileModalOpen(false)}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMyProfile}
                    style={{
                      padding: '0.6rem 1.4rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: savingMyProfile ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                    }}
                  >
                    {savingMyProfile ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create / Grant Sub-Admin Delegation Modal */}
      {isCreateDelegationModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem 0.75rem',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateDelegationModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: 'min(92vh, 850px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(245, 158, 11, 0.2)',
              color: 'var(--text-primary)',
              boxSizing: 'border-box',
              margin: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>👑</span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                    Delegate Sub-Admin Powers
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Grant elevated administrative portal rights without sharing your master password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateDelegationModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDelegation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Target User Selector */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Target User (Warden, Caretaker, Superintendent, etc.)
                </label>
                {delegationFormData.userId ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 750, color: 'var(--text-primary)' }}>
                        {delegationFormData.targetUserName}
                      </span>{' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        ({delegationFormData.targetUserRegNo})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDelegationFormData((prev) => ({
                          ...prev,
                          userId: '',
                          targetUserName: '',
                          targetUserRegNo: '',
                        }))
                      }
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                      }}
                    >
                      Change User
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Type name or reg# to search staff..."
                      value={delegationUserSearch}
                      onChange={(e) => searchUsersForDelegation(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    {searchingDelegationUsers && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Searching...</div>
                    )}
                    {delegationSearchResults.length > 0 && (
                      <div
                        style={{
                          marginTop: '6px',
                          maxHeight: '140px',
                          overflowY: 'auto',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                        }}
                      >
                        {delegationSearchResults.map((u) => (
                          <div
                            key={u._id}
                            onClick={() => {
                              setDelegationFormData((prev) => ({
                                ...prev,
                                userId: u._id,
                                targetUserName: u.name,
                                targetUserRegNo: u.registrationNumber,
                              }));
                              setDelegationSearchResults([]);
                              setDelegationUserSearch('');
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.8rem',
                            }}
                          >
                            <span style={{ fontWeight: 650 }}>{u.name} ({u.registrationNumber})</span>
                            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{u.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Title & Scope */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Delegation Title / Role Name
                </label>
                <input
                  type="text"
                  value={delegationFormData.title}
                  onChange={(e) => setDelegationFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Acting Chief Warden, Mess Incharge (Vacation)"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Duration Options */}
              <div className="sa-delegation-duration-deck">
                <label className="sa-delegation-box-title">
                  ⏱️ Delegation Duration / Expiry
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                  {[
                    { id: 'indefinite', label: '♾️ Jab Super Admin Chahe', sub: 'Until manually revoked' },
                    { id: '24h', label: '⏱️ 24 Hours', sub: '1-day temporary shift' },
                    { id: '3d', label: '📅 3 Days', sub: 'Weekend duty cover' },
                    { id: '7d', label: '🗓️ 7 Days', sub: '1-week vacation' },
                    { id: '30d', label: '🗓️ 30 Days', sub: '1-month assignment' },
                    { id: 'custom', label: '🕒 Custom Date', sub: 'Pick exact end time' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDelegationFormData((prev) => ({ ...prev, durationMode: opt.id }))}
                      className={`sa-delegation-duration-btn ${delegationFormData.durationMode === opt.id ? 'active' : ''}`}
                    >
                      <div style={{ fontWeight: 750, fontSize: '0.78rem' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.68rem', color: 'inherit', opacity: 0.8 }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {delegationFormData.durationMode === 'custom' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Select Expiry Date & Time:
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={delegationFormData.customExpiresAt}
                      onChange={(e) => setDelegationFormData((prev) => ({ ...prev, customExpiresAt: e.target.value }))}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Feature Permissions / Scopes Selector */}
              <div className="sa-delegation-permissions-deck">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="sa-delegation-box-title" style={{ margin: 0 }}>
                    🛡️ Feature Permissions (Kaun-Kaun Se Features Dena Hai?)
                  </label>
                  {delegationFormData.scopeMode === 'custom' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setDelegationFormData((prev) => ({
                            ...prev,
                            selectedScopes: DELEGATION_FEATURE_MODULES.map((m) => m.id),
                          }))
                        }
                        className="sa-delegation-select-all-btn"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelegationFormData((prev) => ({ ...prev, selectedScopes: [] }))}
                        className="sa-delegation-clear-all-btn"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                {/* Mode Toggles: All vs Custom */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setDelegationFormData((prev) => ({
                        ...prev,
                        scopeMode: 'all',
                        selectedScopes: ['all'],
                      }))
                    }
                    className={`sa-delegation-mode-btn ${delegationFormData.scopeMode === 'all' ? 'active' : ''}`}
                  >
                    <div style={{ fontWeight: 750, fontSize: '0.78rem' }}>🌟 All Features (Poore Powers)</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>Complete Super Admin Access</div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDelegationFormData((prev) => ({
                        ...prev,
                        scopeMode: 'custom',
                        selectedScopes: (prev.selectedScopes || []).includes('all')
                          ? ['messalerts', 'notifications', 'users']
                          : (prev.selectedScopes || []),
                      }))
                    }
                    className={`sa-delegation-mode-btn ${delegationFormData.scopeMode === 'custom' ? 'active' : ''}`}
                  >
                    <div style={{ fontWeight: 750, fontSize: '0.78rem' }}>🎛️ Specific Features (Custom)</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>Choose exact modules to allow</div>
                  </button>
                </div>

                {delegationFormData.scopeMode === 'all' ? (
                  <div className="sa-delegation-all-confirm-card">
                    <span>✅</span>
                    <span>
                      User will receive <strong>unrestricted access to all 11 Super Admin modules</strong> (Mess Timetable & Alerts, Push Broadcast, Users, Sessions, Notices, Limits, Maintenance, Updates, Pilot, Audit, etc.).
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: '180px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '6px',
                      paddingRight: '4px',
                    }}
                  >
                    {DELEGATION_FEATURE_MODULES.map((mod) => {
                      const isChecked = (delegationFormData.selectedScopes || []).includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            setDelegationFormData((prev) => {
                              const current = (prev.selectedScopes || []).filter((s) => s !== 'all');
                              const next = isChecked ? current.filter((s) => s !== mod.id) : [...current, mod.id];
                              return { ...prev, selectedScopes: next };
                            });
                          }}
                          className={`sa-delegation-feature-card ${isChecked ? 'checked' : ''}`}
                        >
                          <span style={{ fontSize: '0.9rem', marginTop: '1px' }}>{isChecked ? '☑️' : '⬜'}</span>
                          <div>
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'inherit' }}>
                              {mod.label}
                            </div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.75, lineHeight: '1.2' }}>
                              {mod.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Administrative Notes */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Administrative Note / Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Authorized to oversee BH-1 & mess operations while admin is travelling"
                  value={delegationFormData.notes}
                  onChange={(e) => setDelegationFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateDelegationModalOpen(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelegation || !delegationFormData.userId || (delegationFormData.scopeMode === 'custom' && (delegationFormData.selectedScopes || []).length === 0)}
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    cursor: submittingDelegation || !delegationFormData.userId || (delegationFormData.scopeMode === 'custom' && (delegationFormData.selectedScopes || []).length === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                  }}
                >
                  {submittingDelegation ? 'Granting...' : '👑 Grant Sub-Admin Privileges'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Delegation Permissions Modal */}
      {editingDelegationScopes && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem 0.75rem',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingDelegationScopes(null);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: 'min(92vh, 850px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.2)',
              color: 'var(--text-primary)',
              boxSizing: 'border-box',
              margin: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#60a5fa' }}>
                    Edit Permissions for {editingDelegationScopes.userName}
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Update which Super Admin modules {editingDelegationScopes.userName} ({editingDelegationScopes.userRegistrationNumber}) has access to.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDelegationScopes(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Mode Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    setEditingDelegationScopes((prev) => ({
                      ...prev,
                      scopes: ['all'],
                    }))
                  }
                  style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    border: (editingDelegationScopes?.scopes || []).includes('all') ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    background: (editingDelegationScopes?.scopes || []).includes('all') ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-secondary)',
                    color: (editingDelegationScopes?.scopes || []).includes('all') ? '#93c5fd' : 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 750, fontSize: '0.78rem' }}>🌟 All Features (Poore Powers)</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Complete Super Admin Access</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditingDelegationScopes((prev) => ({
                      ...prev,
                      scopes: (prev?.scopes || []).includes('all') ? ['messalerts', 'notifications', 'users'] : (prev?.scopes || []),
                    }))
                  }
                  style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    border: !(editingDelegationScopes?.scopes || []).includes('all') ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    background: !(editingDelegationScopes?.scopes || []).includes('all') ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-secondary)',
                    color: !(editingDelegationScopes?.scopes || []).includes('all') ? '#93c5fd' : 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 750, fontSize: '0.78rem' }}>🎛️ Specific Features (Custom)</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Select individual modules</div>
                </button>
              </div>

              {(editingDelegationScopes?.scopes || []).includes('all') ? (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#6ee7b7',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>✅</span>
                  <span>Full access granted to all 11 Super Admin modules without restriction.</span>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Select Features ({editingDelegationScopes.scopes.length} selected):
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDelegationScopes((prev) => ({
                            ...prev,
                            scopes: DELEGATION_FEATURE_MODULES.map((m) => m.id),
                          }))
                        }
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDelegationScopes((prev) => ({ ...prev, scopes: [] }))}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '6px',
                      paddingRight: '4px',
                    }}
                  >
                    {DELEGATION_FEATURE_MODULES.map((mod) => {
                      const isChecked = (editingDelegationScopes?.scopes || []).includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            setEditingDelegationScopes((prev) => {
                              const current = (prev?.scopes || []).filter((s) => s !== 'all');
                              const next = isChecked ? current.filter((s) => s !== mod.id) : [...current, mod.id];
                              return { ...prev, scopes: next };
                            });
                          }}
                          style={{
                            padding: '0.55rem 0.7rem',
                            borderRadius: '8px',
                            border: isChecked ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                            background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontSize: '0.9rem', marginTop: '1px' }}>{isChecked ? '☑️' : '⬜'}</span>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isChecked ? '#6ee7b7' : 'var(--text-primary)' }}>
                              {mod.label}
                            </div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                              {mod.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingDelegationScopes(null)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingDelegationScopes || editingDelegationScopes.scopes.length === 0}
                  onClick={() =>
                    handleUpdateDelegationScopes(
                      editingDelegationScopes._id,
                      editingDelegationScopes.scopes.length > 0 ? editingDelegationScopes.scopes : ['all']
                    )
                  }
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    cursor: savingDelegationScopes || editingDelegationScopes.scopes.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  {savingDelegationScopes ? 'Saving...' : '💾 Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
