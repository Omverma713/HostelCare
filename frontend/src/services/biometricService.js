/**
 * biometricService.js
 * 
 * Hardware-level Biometric Authentication Engine for HostelCare.
 * 
 * STRICT RULES:
 * 1. ONLY active on Native Mobile APK (Capacitor Android).
 * 2. 100% DISABLED on web browsers / desktop website (no modals, no prompts, no WebAuthn noise).
 * 3. Designed specifically for LOGIN TIME (1-Touch Fast Fingerprint Login).
 * 4. Zero screen interruption when already logged in.
 */

import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { api } from './api';

const BIOMETRIC_ENABLED_KEY = 'hostelcare_biometric_enabled';
const BIOMETRIC_VAULT_KEY = 'hostelcare_biometric_vault';
const BIOMETRIC_SERVER_ID = 'hostelcare_auth_vault';

let cachedAvailability = null;

export const biometricService = {
  /**
   * Check if biometric hardware (Fingerprint) is supported on this device.
   * STRICT: Returns false on web/desktop browsers so website is never disturbed.
   */
  async isAvailable() {
    // 1. Only available inside Native Android APK
    if (!Capacitor.isNativePlatform()) {
      return {
        available: false,
        biometryType: 'none',
        platform: 'web',
        label: 'Unavailable on Web',
      };
    }

    if (cachedAvailability !== null) {
      return cachedAvailability;
    }

    try {
      const result = await NativeBiometric.isAvailable({ useFallback: true });
      cachedAvailability = {
        available: Boolean(result.isAvailable),
        biometryType: result.biometryType || 'fingerprint',
        platform: 'native_android',
        label: 'Fingerprint & Screen Lock',
      };
      return cachedAvailability;
    } catch (err) {
      console.warn('[BiometricService] Native hardware check:', err.message);
      cachedAvailability = {
        available: false,
        biometryType: 'none',
        platform: 'native_android_unavailable',
        label: 'Unavailable',
      };
      return cachedAvailability;
    }
  },

  /**
   * Check if user has enabled biometric lock in their mobile app
   */
  isEnabled() {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Check if stored biometric login credentials exist on this device
   */
  hasStoredCredentials() {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const data = localStorage.getItem(BIOMETRIC_VAULT_KEY);
      return Boolean(data);
    } catch {
      return false;
    }
  },

  /**
   * Get metadata for the saved user account (for display on login screen)
   */
  getSavedUser() {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      const raw = localStorage.getItem(BIOMETRIC_VAULT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      return null;
    }
    return null;
  },

  /**
   * Automatically save credentials to native Keystore upon successful mobile login
   */
  async saveCredentials(regNum, password, user = {}) {
    if (!Capacitor.isNativePlatform()) return false;
    if (!regNum || !password) return false;

    try {
      await NativeBiometric.setCredentials({
        server: BIOMETRIC_SERVER_ID,
        username: String(regNum).trim().toUpperCase(),
        password: String(password),
      });

      const vaultPayload = {
        regNum: String(regNum).trim().toUpperCase(),
        userName: user?.name || regNum,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(BIOMETRIC_VAULT_KEY, JSON.stringify(vaultPayload));
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      return true;
    } catch (err) {
      console.warn('[BiometricService] Failed storing native credentials:', err.message);
      return false;
    }
  },

  /**
   * Enable Biometric explicitly with password verification
   */
  async enableBiometric({ password, currentUser }) {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Biometric lock is only supported in the Android Mobile App.');
    }
    if (!password) {
      throw new Error('Account password is required to enable Biometric Lock.');
    }

    // 1. Verify user password against backend
    const verifyRes = await api.verifyPassword(password);
    if (!verifyRes || !verifyRes.success) {
      throw new Error(verifyRes?.message || 'Incorrect account password.');
    }

    // 2. Hardware biometric prompt test
    const authResult = await this.authenticate({
      title: 'Setup Fingerprint Login',
      subtitle: 'Touch the fingerprint sensor to confirm',
      description: 'Your biometric data is kept securely inside Android Keystore.',
    });

    if (!authResult || !authResult.success) {
      throw new Error('Fingerprint scan failed. Please try again.');
    }

    const regNum = currentUser?.registrationNumber || currentUser?.regNo || '';
    await this.saveCredentials(regNum, password, currentUser);

    return {
      success: true,
      message: 'Fingerprint Login enabled successfully!',
    };
  },

  /**
   * Disable Biometric Lock & clear credentials
   */
  async disableBiometric() {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_ID });
      } catch (_) {}
    }

    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_VAULT_KEY);

    return {
      success: true,
      message: 'Fingerprint Login has been disabled on this device.',
    };
  },

  /**
   * Prompt Android Native BiometricPrompt Dialog
   */
  async authenticate({
    title = 'HostelCare Fingerprint Verification',
    subtitle = 'Touch the fingerprint sensor to proceed',
    description = 'Verify your identity',
    negativeButtonText = 'Cancel',
  } = {}) {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'Biometrics unavailable on web' };
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: description || subtitle,
        title,
        subtitle,
        description,
        negativeButtonText,
        maxAttempts: 5,
        useFallback: true,
      });
      return { success: true };
    } catch (err) {
      console.warn('[BiometricService] Authentication cancelled or failed:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Authentication cancelled by user',
      };
    }
  },

  /**
   * 1-Touch Fast Login using Fingerprint at Login screen
   */
  async loginWithBiometric() {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Biometric login is only available in the Android Mobile App.');
    }

    const saved = this.getSavedUser();
    const displayName = saved?.regNum || 'HostelCare';

    const authResult = await this.authenticate({
      title: 'HostelCare Fingerprint Login',
      subtitle: `Touch fingerprint sensor to sign in as ${displayName}`,
      description: 'Quick & secure 1-touch login',
      negativeButtonText: 'Use Password',
    });

    if (!authResult.success) {
      throw new Error(authResult.error || 'Biometric authentication was cancelled.');
    }

    // Retrieve stored credentials from Android secure Keystore
    let regNum = '';
    let password = '';

    try {
      const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_ID });
      if (creds && creds.username && creds.password) {
        regNum = creds.username;
        password = creds.password;
      }
    } catch (err) {
      console.warn('[BiometricService] Native credential read error:', err.message);
    }

    if (!regNum || !password) {
      throw new Error('No saved biometric credentials found. Please log in with password once to set up fingerprint.');
    }

    return {
      success: true,
      regNum,
      password,
    };
  },
};
