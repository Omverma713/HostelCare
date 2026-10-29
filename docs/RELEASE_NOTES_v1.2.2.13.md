# HostelCare — Release Notes v1.2.2.13 (Build 18)

**Release Version**: `v1.2.2.13`  
**Release Date**: October 29, 2026  
**Android Build**: `versionCode 18`, `versionName 1.2.2.13`  
**Target Git Branch**: `main`  
**Target APK Download**: `https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.13/hostelcare-v1.2.2.13.apk`

---

## 📌 Executive Summary

HostelCare **v1.2.2.13 (Build 18)** completely refines the **Biometric Fingerprint Authentication** experience based on direct user feedback:
1. **Zero Web Browser Interference**: Fingerprint and biometric prompts are now strictly disabled on website/browsers (`Capacitor.isNativePlatform() === false`). No WebAuthn dialogs, no top navbar buttons, and no visibility-change interruptions on desktop or mobile web.
2. **Dedicated to Login Time (1-Touch Login)**: Fingerprint authentication now lives right where it belongs — on the Mobile App Login screen. App-resume locking while already logged in has been removed so students can multitask without screen-locking interruptions.
3. **Universal Concept Support**: The `👆 Sign In with Fingerprint` button is now active across all login themes (Default 3D Room Pod, Classic Portal, and Lamp/Velvet).
4. **Auto-Credential Onboarding**: Logging in once with your Registration Number and Password on the Android APK automatically enrolls credentials into Android Keystore, enabling immediate 1-touch fingerprint access on your next sign-in.

---

## 🚀 Key Improvements & Architecture Updates

### 1. 🌐 Complete Web Browser Separation
- `biometricService.isAvailable()` immediately returns `false` on web/desktop browsers.
- Removed biometric button from top `Navbar.jsx` to prevent confusion when already logged in.
- Removed biometric navigation entry from sidebar on desktop web.
- `BiometricLockModal` deprecated from background resume events.

### 2. 👆 1-Touch Fingerprint Login on Mobile APK
- Added `BiometricLoginButton` with clear visual feedback: `⚡ Fast 1-Touch Sign In` -> `👆 Sign In with Fingerprint (REG_NO)`.
- Available on the default 3D Room Pod login view (`concept2`) as well as `concept1` and `concept4`.
- Pre-fills saved student registration number and initiates Android `BiometricPrompt` with system PIN/Pattern fallback upon 1 tap.

### 3. 🛡️ Automatic Keystore Protection
- Seamlessly saves credentials upon standard mobile login via `NativeBiometric.setCredentials({ server: 'hostelcare_auth_vault', username, password })`.
- 100% Free, offline-capable, and encrypted at Android OS hardware level (TEE / Keystore).
