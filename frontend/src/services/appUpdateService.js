import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { compareVersions, isValidDirectApkUrl } from '../utils/versionComparator';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://hostelcare-api.duckdns.org/api/v1' : '/api/v1');

const DISMISSED_SESSION_KEY = 'hostelcare_update_dismissed_session';

class AppUpdateService {
  constructor() {
    this.updateState = {
      checking: false,
      updateAvailable: false,
      forceUpdate: false, // Never force update in this sideloaded workflow
      updateType: 'none',
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      updateMessage: '',
      updateUrl: '',
      releaseNotes: '',
      isDismissed: false,
      manualCheck: false,
      manualCheckStatus: null, // null | 'checking' | 'up_to_date' | 'update_available' | 'error'
      manualCheckMessage: '',
      apkDownloadError: null,
      errorMessage: null,
    };

    this.listeners = new Set();
    this.hasInitialized = false;
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
          version: info.version || '1.0.0',
          build: info.build || '1',
        };
      } catch (err) {
        console.warn('[AppUpdateService] Could not retrieve native App.getInfo():', err);
      }
    }
    return { version: '1.1.0', build: '2' };
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

      const response = await fetch(`${API_BASE}/app-version?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Invalid version check response');
      }

      const latestVersion = data.latestVersion || version;
      // Newer version is strictly when latestVersion > installed version
      const hasNewer = compareVersions(latestVersion, version) > 0;
      const isBelowMinimum = compareVersions(version, data.minimumSupportedVersion || version) < 0;
      const isForced = isBelowMinimum || Boolean(data.forceUpdate);

      this.updateState.latestVersion = latestVersion;
      this.updateState.minimumSupportedVersion = data.minimumSupportedVersion || version;
      this.updateState.updateAvailable = hasNewer || isForced;
      this.updateState.forceUpdate = isForced;
      this.updateState.updateType = isForced ? 'immediate' : (hasNewer ? 'flexible' : 'none');
      this.updateState.updateMessage = data.updateMessage || (isForced ? 'A critical update is required to continue accessing HostelCare.' : 'A new version of HostelCare is available.');
      this.updateState.updateUrl = data.updateUrl || '';
      this.updateState.releaseNotes = data.releaseNotes || '';

      if (manual) {
        this.updateState.manualCheck = true;
        if (hasNewer || isForced) {
          this.updateState.manualCheckStatus = 'update_available';
          this.updateState.manualCheckMessage = `New version v${latestVersion} is available!`;
          this.updateState.isDismissed = false; // Show modal on explicit manual check
        } else {
          this.updateState.manualCheckStatus = 'up_to_date';
          this.updateState.manualCheckMessage = `You're up to date! (v${version})`;
        }
      } else {
        // Startup/resume: respect session dismissal ONLY for optional updates
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

  performUpdate() {
    const { updateUrl } = this.updateState;

    if (!isValidDirectApkUrl(updateUrl)) {
      this.updateState.apkDownloadError =
        'The direct APK download link has not been configured yet. Please contact your hostel administrator.';
      this.notifyListeners();
      return false;
    }

    this.updateState.apkDownloadError = null;
    this.notifyListeners();

    try {
      window.open(updateUrl, '_system');
    } catch (e) {
      window.location.href = updateUrl;
    }
    return true;
  }

  dismissUpdate() {
    if (this.updateState.forceUpdate) {
      // Force update cannot be dismissed
      return;
    }
    this.updateState.isDismissed = true;
    this.updateState.manualCheck = false;
    this.updateState.manualCheckStatus = null;
    this.updateState.apkDownloadError = null;

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

    // App updates only apply to native mobile APK clients, not standard website browsers
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. Initial non-blocking check on app startup
    this.checkForUpdates();

    // 2. Non-blocking check on app resume
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          this.checkForUpdates();
        }
      });
    } catch (err) {
      console.warn('[AppUpdateService] Failed to bind appStateChange listener:', err);
    }
  }
}

export const appUpdateService = new AppUpdateService();
