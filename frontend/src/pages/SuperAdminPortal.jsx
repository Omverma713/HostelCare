import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminApi } from '../services/adminApi';
import { appUpdateService } from '../services/appUpdateService';
import { triggerToast } from '../components/Toast';
import './SuperAdminPortal.css';

export default function SuperAdminPortal() {
  const navigate = useNavigate();
  const { token, user: currentUser, setDirectToken } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'sessions' | 'limits' | 'notifications' | 'audit'
  const [loading, setLoading] = useState(false);

  // Overview State
  const [overview, setOverview] = useState(null);

  // Users Directory State
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [userFilters, setUserFilters] = useState({ search: '', role: 'all', status: 'all', hostel: 'all' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [editUserData, setEditUserData] = useState({ name: '', email: '', role: '', hostel: '', roomNumber: '' });
  const [resetPasswordModal, setResetPasswordModal] = useState({ open: false, userId: null, newPassword: '', adminPassword: '' });

  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [sessionPagination, setSessionPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [sessionFilters, setSessionFilters] = useState({ status: 'active', deviceType: 'all', search: '' });

  // System Configuration State
  const [config, setConfig] = useState({
    maxConcurrentSessions: 3,
    maxRegisteredDevices: 5,
    requireDeviceApproval: false,
    revokeOldestOnLimit: true,
    sessionInactivityTimeoutMinutes: 10080,
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
    latestVersion: '1.2.2.4',
    minimumSupportedVersion: '1.0.0',
    updateMessage: '',
    updateUrl: 'https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.4/hostelcare-v1.2.2.4.apk',
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
    version: '1.2.2.4',
    updateUrl: 'https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.4/hostelcare-v1.2.2.4.apk',
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
            version: res.pilotTesting.version || '1.2.2.4',
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
            : `Added ${u.name || reg} to targeted pilot release (v${appVersionConfig.latestVersion || '1.2.2.4'})`,
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
    else if (activeTab === 'audit') loadAuditLogs(1);
  }, [activeTab, loadOverview, loadUsers, loadSessions, loadConfig, loadMaintenance, loadAppVersion, loadCampaigns, loadAuditLogs]);

  // Fetch full details for a selected user
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setEditUserData({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'student',
      hostel: user.hostel || '',
      roomNumber: user.roomNumber || '',
      maxDevices: user.maxDevices !== null && user.maxDevices !== undefined ? user.maxDevices : '',
    });
    try {
      const res = await adminApi.getUserDetails(user._id);
      if (res.success) {
        setUserDetails(res);
        if (res.user && res.user.maxDevices !== undefined) {
          setEditUserData((prev) => ({
            ...prev,
            maxDevices: res.user.maxDevices !== null ? res.user.maxDevices : '',
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
        </div>

        {/* Tab Switcher Pills */}
        <div className="sa-tab-bar">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'users', label: '👥 User Directory' },
            { id: 'sessions', label: '📱 Sessions & Devices' },
            { id: 'limits', label: '⚙️ Login Limits' },
            { id: 'maintenance', label: '🛠️ Maintenance' },
            { id: 'appversion', label: '📲 App Updates' },
            { id: 'pilottesting', label: '🧪 Pilot Testing' },
            { id: 'notifications', label: '🔔 Push Broadcast' },
            { id: 'audit', label: '📜 Audit Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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

              <button
                type="button"
                onClick={() => loadUsers(1)}
                className="sa-filter-btn"
              >
                Search
              </button>
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

          {/* User Details & Management Drawer */}
          {selectedUser && (
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--border-radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-sm)',
                height: 'fit-content',
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
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔒</span> Account Temporarily Locked
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                      Locked due to multiple wrong passwords ({selectedUser.failedLoginAttempts || '5+'} attempts). Expires in ~{selectedUser.lockMinutesRemaining || 15}m.
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
              )}

              {/* Edit Profile Form */}
              <form onSubmit={handleSaveUserProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
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

                {selectedUser.isLocked ? (
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
                ) : (selectedUser.failedLoginAttempts > 0) ? (
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
                ) : null}

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
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    ACTIVE SESSIONS ({userDetails.activeSessions.length})
                  </div>
                  {userDetails.activeSessions.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No active sessions</div>
                  ) : (
                    userDetails.activeSessions.map((s) => (
                      <div
                        key={s.sessionId}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.4rem',
                          borderRadius: '6px',
                          background: 'var(--bg-secondary)',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div>{s.deviceNickname || s.deviceType}</div>
                          <div style={{ color: 'var(--text-muted)' }}>IP: {s.ip}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(s.sessionId)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
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
                Deploy pre-release APK versions (e.g. <strong>v{pilotConfig.version || '1.2.2.4'}</strong>) strictly to selected students like <strong>24E122A11</strong> before public rollout.
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
                    <strong>Target Version:</strong> v{pilotTestResult.pilotConfig?.version || '1.2.2.4'}
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: v{pilotConfig.version || '1.2.2.4'}</span>
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
                    placeholder="e.g. 1.2.2.4"
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
                    Version delivered to pilot testers (e.g. 1.2.2.4).
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
                  placeholder="https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.4/hostelcare-v1.2.2.4.apk"
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
                    <span>Target: <strong>v{pilotConfig.version || '1.2.2.4'}</strong></span>
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
    </div>
  );
}
