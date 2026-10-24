import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { compareVersions, isValidDirectApkUrl } from '../utils/versionComparator';

const ApkInstaller = registerPlugin('ApkInstallerPlugin');

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://hostelcare-api.duckdns.org/api/v1' : '/api/v1');

const DISMISSED_SESSION_KEY = 'hostelcare_update_dismissed_session';

function decodeTokenPayload(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

class AppUpdateService {
  constructor() {
    this.updateState = {
      checking: false,
      updateAvailable: false,
      forceUpdate: false,
      updateType: 'none',
      isSuspended: false,
      currentVersion: '1.2.0.1',
      latestVersion: '1.2.0.1',
      minimumSupportedVersion: '1.0.0',
      updateMessage: '',
      updateUrl: '',
      releaseNotes: '',
      releaseMedia: [],
      apkSha256: '',
      isDismissed: false,
      manualCheck: false,
      manualCheckStatus: null, // null | 'checking' | 'up_to_date' | 'update_available' | 'error'
      manualCheckMessage: '',
      apkDownloadError: null,
      errorMessage: null,

      // In-App Update State
      downloadStatus: 'idle', // 'idle' | 'downloading' | 'verifying' | 'ready_to_install' | 'permission_required' | 'installing' | 'cancelled' | 'error'
      downloadProgress: {
        percent: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
      },
      downloadedFilePath: null,
      verifiedSha256: null,
      statusMessage: '',
    };

    this.listeners = new Set();
    this.hasInitialized = false;
    this.progressListenerHandle = null;
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.updateState });
      } catch (err) {
        console.warn('[AppUpdateService] Error in listener callback:', err);
      }
    }
  }

  getState() {
    return { ...this.updateState };
  }

  addListener(listener) {
    return this.subscribe(listener);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ ...this.updateState });
    return () => this.listeners.delete(listener);
  }

  async getInstalledVersion() {
    if (Capacitor.isNativePlatform()) {
      try {
        const info = await App.getInfo();
        return {
          version: info.version || '1.2.0.1',
          build: info.build || '4',
        };
      } catch (err) {
        console.warn('[AppUpdateService] Could not retrieve native App.getInfo():', err);
      }
    }
    return { version: '1.2.0.1', build: '4' };
  }

  async checkForUpdates({ manual = false } = {}) {
    if (this.updateState.checking) return this.updateState;

    this.updateState.checking = true;
    this.updateState.errorMessage = null;
    this.updateState.apkDownloadError = null;
    if (manual) {
      this.updateState.manualCheck = true;
      this.updateState.manualCheckStatus = 'checking';
      this.updateState.manualCheckMessage = 'Checking for updates...';
    }
    this.notifyListeners();

    try {
      const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'android';
      const { version, build } = await this.getInstalledVersion();
      this.updateState.currentVersion = version;

      const params = new URLSearchParams({
        currentVersion: version,
        platform,
        buildNumber: build,
      });

      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      let userReg = '';
      let userRole = '';
      let userHostel = '';
      if (token) {
        const decoded = decodeTokenPayload(token);
        if (decoded) {
          userReg = decoded.registrationNumber || decoded.regNo || decoded.username || '';
          userRole = decoded.role || '';
          userHostel = decoded.hostel || '';
        }
      }

      if (userReg) {
        params.append('registrationNumber', userReg);
      }
      if (userRole) {
        params.append('role', userRole);
      }
      if (userHostel) {
        params.append('hostel', userHostel);
      }

      const headers = { Accept: 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/app-version?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Invalid version check response');
      }

      // 1. If release is suspended by administration, do not show or force updates
      if (data.isSuspended) {
        this.updateState.isSuspended = true;
        this.updateState.updateAvailable = false;
        this.updateState.forceUpdate = false;
        this.updateState.updateType = 'none';
        this.updateState.updateMessage = data.updateMessage || 'Release is temporarily paused by administration.';
        this.updateState.releaseNotes = '';
        this.updateState.releaseMedia = [];
        if (manual) {
          this.updateState.manualCheck = true;
          this.updateState.manualCheckStatus = 'up_to_date';
          this.updateState.manualCheckMessage = 'Updates are temporarily paused by administration.';
        }
        return this.updateState;
      }

      this.updateState.isSuspended = false;

      // 2. If user is excluded from targeted pilot rollout (or updateAvailable false), do not prompt/block
      const isEligible = data.isTargeted !== false && data.updateAvailable !== false;
      const latestVersion = data.latestVersion || version;
      const hasNewer = compareVersions(latestVersion, version) > 0;
      const isBelowMinimum = compareVersions(version, data.minimumSupportedVersion || version) < 0;
      const isForced = (isBelowMinimum || Boolean(data.forceUpdate)) && isEligible;
      const updateAvailable = (hasNewer || isForced) && isEligible;

      this.updateState.latestVersion = latestVersion;
      this.updateState.minimumSupportedVersion = data.minimumSupportedVersion || version;
      this.updateState.updateAvailable = updateAvailable;
      this.updateState.forceUpdate = isForced;
      this.updateState.updateType = isForced ? 'immediate' : (updateAvailable ? 'flexible' : 'none');
      this.updateState.updateMessage = data.updateMessage || (isForced ? 'A critical update is required to continue accessing HostelCare.' : 'A new version of HostelCare is available.');
      this.updateState.updateUrl = data.updateUrl || '';
      this.updateState.releaseNotes = data.releaseNotes || '';
      this.updateState.releaseMedia = data.releaseMedia || [];
      this.updateState.apkSha256 = data.apkSha256 || '';

      if (manual) {
        this.updateState.manualCheck = true;
        if (updateAvailable) {
          this.updateState.manualCheckStatus = 'update_available';
          this.updateState.manualCheckMessage = `New version v${latestVersion} is available!`;
          this.updateState.isDismissed = false;
        } else {
          this.updateState.manualCheckStatus = 'up_to_date';
          this.updateState.manualCheckMessage = isEligible
            ? `You're up to date! (v${version})`
            : `You are on the stable channel (v${version})`;
        }
      } else {
        const dismissed = !isForced && Boolean(sessionStorage.getItem(`${DISMISSED_SESSION_KEY}_${latestVersion}`));
        this.updateState.isDismissed = dismissed;
      }
    } catch (err) {
      console.warn('[AppUpdateService] Version check failed:', err.message);
      this.updateState.errorMessage = 'Unable to check for updates. Please check your internet connection.';
      if (manual) {
        this.updateState.manualCheckStatus = 'error';
        this.updateState.manualCheckMessage = this.updateState.errorMessage;
      }
    } finally {
      this.updateState.checking = false;
      this.notifyListeners();
    }

    return this.updateState;
  }

  /**
   * Primary In-App Update flow:
   * Downloads APK inside the app with real progress callbacks, verifies SHA-256,
   * then launches the Android Package Installer.
   */
  async startInAppDownload() {
    const { updateUrl, apkSha256 } = this.updateState;

    if (!isValidDirectApkUrl(updateUrl)) {
      this.updateState.apkDownloadError =
        'The direct APK download link has not been configured yet. Please contact your hostel administrator.';
      this.notifyListeners();
      return false;
    }

    // On standard web browsers (non-native), download file via browser
    if (!Capacitor.isNativePlatform()) {
      window.open(updateUrl, '_blank');
      return true;
    }

    this.updateState.apkDownloadError = null;
    this.updateState.downloadStatus = 'downloading';
    this.updateState.downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };
    this.updateState.statusMessage = 'Connecting to download server...';
    this.notifyListeners();

    try {
      // Remove any previous listener
      if (this.progressListenerHandle) {
        try { await this.progressListenerHandle.remove(); } catch (e) {}
        this.progressListenerHandle = null;
      }

      // Subscribe to native progress events
      this.progressListenerHandle = await ApkInstaller.addListener('downloadProgress', (progress) => {
        this.updateState.downloadProgress = {
          percent: Math.max(0, Math.min(100, progress.percent || 0)),
          bytesDownloaded: progress.bytesDownloaded || 0,
          totalBytes: progress.totalBytes || 0,
        };
        if (progress.percent >= 0) {
          this.updateState.statusMessage = `Downloading update... ${progress.percent}%`;
        } else {
          this.updateState.statusMessage = 'Downloading update...';
        }
        this.notifyListeners();
      });

      // Start the native background download
      const result = await ApkInstaller.downloadApk({
        url: updateUrl,
        expectedSha256: apkSha256 || '',
      });

      if (this.progressListenerHandle) {
        try { await this.progressListenerHandle.remove(); } catch (e) {}
        this.progressListenerHandle = null;
      }

      if (result.cancelled) {
        this.updateState.downloadStatus = 'cancelled';
        this.updateState.statusMessage = 'Download was cancelled.';
        this.notifyListeners();
        return false;
      }

      if (result.error === 'CHECKSUM_MISMATCH') {
        this.updateState.downloadStatus = 'error';
        this.updateState.errorMessage =
          result.message || 'Security verification failed: Downloaded package checksum does not match official release.';
        this.notifyListeners();
        return false;
      }

      if (!result.success || !result.filePath) {
        throw new Error(result.message || 'Download did not complete successfully.');
      }

      // Download complete & verified!
      this.updateState.downloadStatus = 'ready_to_install';
      this.updateState.downloadedFilePath = result.filePath;
      this.updateState.verifiedSha256 = result.sha256 || null;
      this.updateState.statusMessage = 'Package verified. Ready to install.';
      this.notifyListeners();

      // Automatically check permission & trigger installer
      await this.installDownloadedApk();
      return true;

    } catch (err) {
      if (this.progressListenerHandle) {
        try { await this.progressListenerHandle.remove(); } catch (e) {}
        this.progressListenerHandle = null;
      }

      console.error('[AppUpdateService] Download failed:', err);
      this.updateState.downloadStatus = 'error';
      this.updateState.errorMessage = err.message || 'Failed to download update. Please check your connection and retry.';
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Cancel the current download.
   */
  async cancelDownload() {
    try {
      if (Capacitor.isNativePlatform()) {
        await ApkInstaller.cancelDownload();
      }
    } catch (err) {
      console.warn('[AppUpdateService] Error cancelling download:', err);
    }
    this.updateState.downloadStatus = 'cancelled';
    this.updateState.statusMessage = 'Download cancelled.';
    this.updateState.downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };
    this.notifyListeners();
  }

  /**
   * Checks permission and opens the system PackageInstaller.
   */
  async installDownloadedApk() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const permCheck = await ApkInstaller.checkInstallPermission();
      if (!permCheck.granted) {
        this.updateState.downloadStatus = 'permission_required';
        this.updateState.statusMessage =
          'HostelCare needs permission to install updates. Please enable "Allow from this source" in Android settings.';
        this.notifyListeners();
        return;
      }

      this.updateState.downloadStatus = 'installing';
      this.updateState.statusMessage =
        'System installer opened. Please tap "Update" on your screen to complete the installation.';
      this.notifyListeners();

      const result = await ApkInstaller.installApk({
        filePath: this.updateState.downloadedFilePath,
      });

      if (result.needsPermission) {
        this.updateState.downloadStatus = 'permission_required';
        this.updateState.statusMessage =
          'HostelCare needs permission to install updates. Please enable "Allow from this source" in Android settings.';
        this.notifyListeners();
      }
    } catch (err) {
      console.error('[AppUpdateService] Error launching installer:', err);
      this.updateState.downloadStatus = 'error';
      this.updateState.errorMessage = err.message || 'Failed to launch Android package installer.';
      this.notifyListeners();
    }
  }

  /**
   * Opens Android Unknown Apps Settings so user can toggle the switch.
   */
  async openInstallPermissionSettings() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await ApkInstaller.openInstallPermissionSettings();
    } catch (err) {
      console.warn('[AppUpdateService] Failed to open permission settings:', err);
    }
  }

  /**
   * Resets download UI state to idle so user can retry
   */
  resetDownloadState() {
    this.updateState.downloadStatus = 'idle';
    this.updateState.downloadProgress = { percent: 0, bytesDownloaded: 0, totalBytes: 0 };
    this.updateState.errorMessage = null;
    this.updateState.apkDownloadError = null;
    this.updateState.statusMessage = '';
    this.notifyListeners();
  }

  performUpdate() {
    return this.startInAppDownload();
  }

  dismissUpdate() {
    if (this.updateState.forceUpdate) {
      return;
    }
    // Cancel download if one was active
    if (this.updateState.downloadStatus === 'downloading') {
      this.cancelDownload();
    }

    this.updateState.isDismissed = true;
    this.updateState.manualCheck = false;
    this.updateState.manualCheckStatus = null;
    this.updateState.apkDownloadError = null;
    this.updateState.downloadStatus = 'idle';

    try {
      sessionStorage.setItem(`${DISMISSED_SESSION_KEY}_${this.updateState.latestVersion}`, 'true');
    } catch (e) {
      // Ignore sessionStorage errors
    }

    this.notifyListeners();
  }

  initialize() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. Initial non-blocking check on app startup
    this.checkForUpdates();

    // 2. Non-blocking check on app resume
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // If we were waiting for permission to be granted in settings and user returned:
          if (this.updateState.downloadStatus === 'permission_required' && this.updateState.downloadedFilePath) {
            this.installDownloadedApk();
          } else {
            this.checkForUpdates();
          }
        }
      });
    } catch (err) {
      console.warn('[AppUpdateService] Failed to bind appStateChange listener:', err);
    }
  }
}

export const appUpdateService = new AppUpdateService();
