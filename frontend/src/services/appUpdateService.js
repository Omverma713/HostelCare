import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AppUpdate } from '@capawesome/capacitor-app-update';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://hostelcare-api.duckdns.org/api/v1' : '/api/v1');

const DISMISSED_SESSION_KEY = 'hostelcare_update_dismissed_session';

class AppUpdateService {
  constructor() {
    this.updateState = {
      checking: false,
      updateAvailable: false,
      forceUpdate: false,
      updateType: 'none', // 'none' | 'flexible' | 'immediate'
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      updateMessage: '',
      updateUrl: 'https://play.google.com/store/apps/details?id=com.hostelcare.app',
      releaseNotes: '',
      isDismissed: false,
      // Google Play In-App Updates API state
      playStoreAvailable: false,
      playStoreUpdateAvailability: null,
      flexibleDownloadProgress: null, // { bytesDownloaded, totalBytesToDownload }
      flexibleUpdateDownloaded: false,
      errorMessage: null,
    };

    this.listeners = new Set();
    this.hasInitialized = false;
    this.flexibleStateListener = null;
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
    // Immediately invoke with current state
    listener({ ...this.updateState });
    return () => this.listeners.delete(listener);
  }

  async getInstalledVersion() {
    if (!Capacitor.isNativePlatform()) {
      return { version: '1.0.0', build: '1' };
    }
    try {
      const info = await App.getInfo();
      return {
        version: info.version || '1.0.0',
        build: info.build || '1',
      };
    } catch (err) {
      console.warn('[AppUpdateService] Could not retrieve native App.getInfo():', err);
      return { version: '1.0.0', build: '1' };
    }
  }

  async checkForUpdates({ manual = false } = {}) {
    if (this.updateState.checking) return this.updateState;

    this.updateState.checking = true;
    this.updateState.errorMessage = null;
    this.notifyListeners();

    try {
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      const { version, build } = await this.getInstalledVersion();
      this.updateState.currentVersion = version;

      // 1. Query Backend-managed App Version Configuration
      const params = new URLSearchParams({
        currentVersion: version,
        platform,
        buildNumber: build,
      });

      const response = await fetch(`${API_BASE}/app-version?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Version check server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Invalid version check response');
      }

      const updateAvailable = Boolean(data.updateAvailable);
      const forceUpdate = Boolean(data.forceUpdate);
      const updateType = data.updateType || (forceUpdate ? 'immediate' : updateAvailable ? 'flexible' : 'none');

      // Check if session previously dismissed this optional version
      const dismissed = !forceUpdate && Boolean(sessionStorage.getItem(`${DISMISSED_SESSION_KEY}_${data.latestVersion}`));

      this.updateState.updateAvailable = updateAvailable;
      this.updateState.forceUpdate = forceUpdate;
      this.updateState.updateType = updateType;
      this.updateState.latestVersion = data.latestVersion || version;
      this.updateState.minimumSupportedVersion = data.minimumSupportedVersion || version;
      this.updateState.updateMessage = data.updateMessage || 'A new version of HostelCare is available.';
      this.updateState.updateUrl = data.updateUrl || 'https://play.google.com/store/apps/details?id=com.hostelcare.app';
      this.updateState.releaseNotes = data.releaseNotes || '';
      this.updateState.isDismissed = !manual && dismissed;

      // 2. If Android native, check Google Play In-App Updates API capability
      if (isNative && platform === 'android') {
        try {
          const playInfo = await AppUpdate.getAppUpdateInfo();
          // UpdateAvailability: 0 = UNKNOWN, 1 = UPDATE_NOT_AVAILABLE, 2 = UPDATE_AVAILABLE, 3 = DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
          this.updateState.playStoreAvailable = true;
          this.updateState.playStoreUpdateAvailability = playInfo.updateAvailability;

          // If Google Play itself says update is available, register flexible download listener
          if (playInfo.updateAvailability === 2 && !this.flexibleStateListener) {
            this.setupFlexibleListener();
          }
        } catch (playErr) {
          // Expected on local debug builds, sideloaded APKs, or devices without Google Play Services
          this.updateState.playStoreAvailable = false;
          console.info('[AppUpdateService] Google Play In-App Update info check skipped or unavailable:', playErr?.message);
        }
      }
    } catch (err) {
      console.warn('[AppUpdateService] Version check failed (offline or network error):', err.message);
      this.updateState.errorMessage = err.message;
    } finally {
      this.updateState.checking = false;
      this.notifyListeners();
    }

    return this.updateState;
  }

  async setupFlexibleListener() {
    try {
      this.flexibleStateListener = await AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
        // installStatus: 1 = PENDING, 2 = DOWNLOADING, 3 = INSTALLING, 11 = DOWNLOADED, 5 = FAILED, 6 = CANCELED
        if (state.totalBytesToDownload > 0) {
          this.updateState.flexibleDownloadProgress = {
            bytesDownloaded: state.bytesDownloaded,
            totalBytesToDownload: state.totalBytesToDownload,
            percent: Math.round((state.bytesDownloaded / state.totalBytesToDownload) * 100),
          };
        }

        if (state.installStatus === 11 /* DOWNLOADED */) {
          this.updateState.flexibleUpdateDownloaded = true;
          this.updateState.flexibleDownloadProgress = null;
        }

        this.notifyListeners();
      });
    } catch (err) {
      console.warn('[AppUpdateService] Failed to attach flexible update listener:', err);
    }
  }

  /**
   * Triggers the appropriate update flow:
   * 1. Google Play In-App Updates API (if available on Android)
   * 2. Fallback to opening the official Play Store / update URL safely
   */
  async performUpdate() {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const { forceUpdate, updateUrl, playStoreAvailable, playStoreUpdateAvailability } = this.updateState;

    if (isNative && platform === 'android' && playStoreAvailable && playStoreUpdateAvailability === 2) {
      try {
        if (forceUpdate) {
          // Immediate update flow
          await AppUpdate.performImmediateUpdate();
          return;
        } else {
          // Flexible background update flow
          await AppUpdate.startFlexibleUpdate();
          return;
        }
      } catch (playUpdateErr) {
        console.warn('[AppUpdateService] Google Play In-App update failed, falling back to official update URL:', playUpdateErr);
      }
    }

    // Direct official update URL fallback
    this.openOfficialUpdateUrl(updateUrl);
  }

  async completeFlexibleUpdate() {
    try {
      await AppUpdate.completeFlexibleUpdate();
    } catch (err) {
      console.error('[AppUpdateService] Failed to complete flexible update installation:', err);
      this.openOfficialUpdateUrl(this.updateState.updateUrl);
    }
  }

  openOfficialUpdateUrl(url) {
    const targetUrl = url || this.updateState.updateUrl || 'https://play.google.com/store/apps/details?id=com.hostelcare.app';
    try {
      // Use window.open with _system so Android launches Google Play Store app directly
      window.open(targetUrl, '_system');
    } catch (err) {
      window.location.href = targetUrl;
    }
  }

  dismissUpdate() {
    if (this.updateState.forceUpdate) {
      // Security rule: forced updates cannot be dismissed
      return;
    }
    this.updateState.isDismissed = true;
    try {
      sessionStorage.setItem(`${DISMISSED_SESSION_KEY}_${this.updateState.latestVersion}`, 'true');
    } catch (e) {
      // ignore
    }
    this.notifyListeners();
  }

  initialize() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    // 1. Initial check on startup
    this.checkForUpdates();

    // 2. Setup Resume listener on native app
    if (Capacitor.isNativePlatform()) {
      try {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            // Re-evaluate version when app is brought back to foreground
            this.checkForUpdates();
          }
        });
      } catch (err) {
        console.warn('[AppUpdateService] Failed to bind appStateChange listener:', err);
      }
    }
  }
}

export const appUpdateService = new AppUpdateService();
