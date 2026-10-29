# HostelCare — Release Notes v1.2.2.12 (Build 17)

**Release Version**: `v1.2.2.12`  
**Release Date**: October 28, 2026  
**Android Build**: `versionCode 17`, `versionName 1.2.2.12`  
**Target Git Branch**: `main`  
**Target APK Download**: `https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.12/hostelcare-v1.2.2.12.apk`

---

## 📌 Executive Summary

HostelCare **v1.2.2.12 (Build 17)** is the official production rollout bringing **Biometric Fingerprint App Lock & 1-Touch Sign-In**, **Mobile Header Direct Access**, **Mess Auto-Alerts 2.0 Catch-Up Engine**, and total synchronization across the web platform and native Android mobile application.

Every student on mobile and web now gets bank-grade biometric hardware protection, 1-touch fingerprint access from the top navbar, guaranteed mess alert dispatches, and an automatic in-app update prompt for instant installation.

---

## 🚀 Key Highlights & What's New

### 1. 👆 Mobile Top Navigation Shortcut for Fingerprint Setup
- **Direct Header Access (`Navbar.jsx`)**: Added a dedicated `👆 Fingerprint Lock` button directly in the mobile top navigation bar next to the notifications and theme toggle. No need to scroll through sidebar menus or search settings!
- **Sidebar Integration (`Sidebar.jsx`)**: Also featured inside the mobile drawer and desktop sidebar navigation under Security.
- **Instant Enrollment Modal (`BiometricSettingsModal.jsx`)**: Students can enroll or disable biometric authentication with real-time hardware detection and status toggles.

### 2. 🔐 Bank-Grade Biometric Fingerprint Lock & 1-Touch Sign-In
- **Password-First Protection (`POST /api/users/verify-password`)**: Biometric security cannot be toggled on without verifying the user's current account password first. Even if an unlocked phone is temporarily held by a friend, biometric cannot be enabled or changed without the password.
- **1-Touch Sign-In on Login Screen (`Login.jsx`)**: When biometric is enabled, the login screen displays a prominent `👆 Sign in with Fingerprint / Biometric` button, allowing students to authenticate in under 1 second without typing registration numbers or passwords.
- **App-Resume Privacy Lock Shield (`BiometricLockModal.jsx`)**: Returning to HostelCare from multitasking, backgrounding, or phone unlock displays a frosted glass security shield until fingerprint verification completes.
- **Fail-Safe & Biometric Mismatch Handling**: If the finger is damp or sensor misreads, students can retry immediately or fall back to device PIN/Pattern, or enter their account password to unlock.
- **100% Free & Native**: Powered by Android native `BiometricPrompt` via `@capgo/capacitor-native-biometric@6.0.4` and WebAuthn for web browsers.

### 3. 🍱 Mess Auto-Alerts 2.0 (Catch-Up Grace Engine & Offline Alarms)
- **30-Minute Resilient Catch-Up Window**: Fixes the issue where dinner alerts failed during server restart/Docker deployment downtime at 8:30 PM. If the server is restarting at meal time, it automatically claims and delivers the alert upon booting up within a 30-minute grace window.
- **Dual-Engine Android Offline Alarms (`messNotificationService.js`)**: Schedules the upcoming 7 days of breakfast, lunch, snacks, and dinner directly in Android OS `AlarmManager` with `allowWhileIdle: true`. Alerts fire on time even without internet or in airplane mode.
- **Zero Duplicate Guarantees**: MongoDB atomic claiming (`lastTriggeredAt` locks) ensures zero duplicate pushes across any number of cluster restarts.

### 4. 📲 Seamless In-App APK Auto-Update Notification
- **Automatic Version Detection**: Running app versions below `1.2.2.12` instantly detect Build 17 and display the in-app update banner with release highlights and a 1-click download button.
- **Pre-Configured SuperAdmin Rollout**: App version controller, system configuration, CBT application defaults, and pilot channels are fully aligned to `1.2.2.12`.

---

## 🛠️ Build & Verification Matrix

| Component | Target Version | Verification Status |
| :--- | :--- | :--- |
| **Backend Core** | `1.2.2.12` | ✅ All APIs & Version Controllers Verified |
| **Frontend Web** | `1.2.2.12` | ✅ Vite Production Build Clean |
| **Android Native** | `versionCode 17` (`1.2.2.12`) | ✅ Capacitor 6 Native Biometrics Synced |
| **Mess Notification Tests** | Automated Suite | ✅ 14/14 Unit & Integration Tests Passed |

---

## 📱 How to Access Fingerprint Lock on Mobile

1. **Top Header**: Tap the `👆` icon located on the top right bar of the app screen.
2. **Main Menu**: Open the sidebar navigation menu (3 horizontal lines) and tap `👆 Biometric Lock`.
3. **Setup**: Enter your account password once to authorize, then touch the fingerprint sensor to enroll.
4. **Login**: From then on, tap `👆 Sign in with Fingerprint` on the login page for instant 1-touch sign-in!

