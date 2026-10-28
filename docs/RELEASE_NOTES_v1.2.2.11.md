# HostelCare — Release Notes v1.2.2.11 (Build 16)

**Release Version**: `v1.2.2.11`  
**Release Date**: October 28, 2026  
**Android Build**: `versionCode 16`, `versionName 1.2.2.11`  
**Target Git Branch**: `main` (Latest Commit: `42f76bd`)  
**Production APK**: [hostelcare-v1.2.2.11.apk](file:///c:/Users/omv71/OneDrive/Desktop/hostelcare/mobile-app/dist-apk/hostelcare-v1.2.2.11.apk) (6.05 MB)

---

## 📌 Executive Summary

HostelCare **v1.2.2.11** is our most resilient and security-hardened release to date. It unifies high-security native hardware features, zero-miss autonomous notifications, a cozy warm-tone design system, and administrative control suites across the web platform and native Android APK:

1. **🔐 Biometric Fingerprint Lock**: Bank-grade biometric authentication powered by native Android `BiometricPrompt` and W3C WebAuthn with password-first authorization, 1-touch login, and app-resume privacy shield.
2. **🍱 Mess Auto-Alerts 2.0 (Catch-Up Engine & Offline Alarms)**: Introduces a 30-minute resilient server catch-up window preventing missed meals during container restarts or deployments, backed by Android OS AlarmManager offline scheduling.
3. **🎨 Deep Warm Almond & Ivory Theme**: Replaced washed-out pale cream with a rich, eye-soothing Warm Almond (`#efe7da`), clean warm ivory cards (`#fbf7f0`), warm amber borders, and harmonized warm parchment sidebar dock.
4. **🧪 Closed Beta Testing (CBT) Module**: Full end-to-end beta recruitment channel for students with SuperAdmin application review, status filters, and 1-click promotion.
5. **🖱️ Independent Desktop Viewport Scrolling**: Decoupled background page scrolling from the sidebar dock for comfortable desktop navigation.
6. **🪟 Centered User Details Modal**: Migrated user details from inline page insertion to a centered popup modal mounted directly to document body via React Portal.
7. **🍔 Collapsible 3-Line Sidebar**: Minimalist icon rail toggle for desktop and responsive drawer sync for mobile devices.

---

## 🚀 What's New & Key Highlights

### 1. 🔐 Biometric Fingerprint App Lock & 1-Touch Login
- **Password-First Security Requirement**: Biometric lock cannot be toggled on without first verifying the user's live account password via `POST /api/users/verify-password`, protecting users if their phone is briefly in someone else's hands.
- **1-Touch Quick Sign-In (`Login.jsx`)**: Enrolled users can log in with a single touch on the fingerprint sensor without typing their registration number and password.
- **App-Resume Privacy Shield (`BiometricLockModal.jsx`)**: When returning to HostelCare from background or phone unlock, a sleek frosted glass lock overlay intercepts the screen until fingerprint verification succeeds.
- **Hardware Fallback Protection**: If the fingerprint sensor fails or hands are damp, Android automatically provides device PIN/Pattern fallback, alongside standard account password login.
- **100% Free & Native**: Built on native Android KeyStore and OS biometrics with zero paid third-party dependencies.

### 2. 🍱 Mess Auto-Alerts 2.0 (Resilient Delivery Architecture)
- **30-Minute Catch-Up Grace Engine**: Solves the rigid zero-tolerance minute-matching bug. If the server is restarting, rebuilding Docker, or experiencing deploy downtime at 8:30 PM, it automatically claims and dispatches the meal alert as soon as it boots within the 30-minute window.
- **Dual-Engine Offline Fallback (`messNotificationService.js`)**: Schedules the next 7 days of meal reminders into Android OS `AlarmManager` with `allowWhileIdle: true`. Works 100% offline even if the student is in airplane mode or the cloud server is unreachable.
- **Atomic Idempotency**: Guarantees zero duplicate notifications across multiple cluster ticks or container restarts.

### 3. 🎨 Deep Warm Almond & Cozy Ivory Light Theme
- **Page Canvas (`--bg-primary`)**: Rich Warm Almond (`#efe7da`), eliminating glare and eye strain.
- **Cards & Containers (`--bg-card`)**: Crisp Warm Ivory (`#fbf7f0`), offering clean elevation against the canvas.
- **Sidebar Dock Harmonization**: Replaced cold blue gradients (`#dce4f7`) with matching warm parchment tones (`#ede4d5 ➔ #ded2be`) and warm amber borders.
- **Typography & Shadows**: Deep Warm Espresso Charcoal (`#1c1917`) for crisp WCAG AAA contrast, paired with warm ambient bronze shadows.

### 4. 🧪 Closed Beta Testing (CBT) Channel
- **Student Dashboard Channel Card**: Displays dynamic status (Available, Applied, Active Tester, Rejected) with an interactive modal to submit technical feedback, phone models, and testing motivation.
- **SuperAdmin CBT Command Center**: Real-time tabular radar showing applicant registration numbers, device models, submission dates, and 1-click status actions (Approve, Reject, Revoke).

### 5. 🖱️ Independent Desktop Background & Sidebar Scrolling
- **Hover-Aware Scroll Capture**: Desktop cursor hovering over the main content scrolls the page freely; moving the cursor over the sidebar scrolls only the sidebar navigation list.
- **Mobile Touch Preservation**: Native drawer gestures on phones retain standard touch-lock to prevent background scrolling while the drawer is open.

### 6. 🪟 User Directory Popup Modal Refinement
- **React Portal Mounting**: Modals mount directly to `document.body`, neutralizing parent stacking contexts (`transform: translateZ(0)`).
- **Upper-Center Viewport Positioning**: Configured with `align-items: flex-start` and top padding `max(24px, 4.5vh)` so user details are immediately visible without scrolling down.

---

## 🛠️ Verification & Quality Assurance

| Test Scenario | Platform / View | Result | Status |
| :--- | :--- | :--- | :--- |
| **Mess Catch-Up Engine** | Node.js Test Runner | 14/14 automated timing and idempotency tests pass | ✅ PASS |
| **Biometric Availability Check** | Android APK / Web | Detects native sensor and WebAuthn platform authenticator | ✅ PASS |
| **Password-Guarded Biometric Setup** | Frontend / API | Rejects invalid passwords, activates upon hardware scan | ✅ PASS |
| **1-Touch Biometric Login** | Login View | Authenticates stored credential and routes to dashboard | ✅ PASS |
| **Warm Theme Legibility** | Desktop & Mobile | Exceeds WCAG AAA contrast standard (> 12:1) | ✅ PASS |
| **Independent Desktop Scrolling** | Chrome / Edge | Main content and sidebar scroll independently | ✅ PASS |
| **User Details Dialog Popup** | Mobile APK / Desktop | Manage Details opens centered modal overlay above content | ✅ PASS |
| **Desktop 3-Line Sidebar Toggle** | Chrome / Edge | Smooth collapse to icon rail, zero layout shift | ✅ PASS |
| **Android APK Compilation** | Gradle Release Build | Clean build, verified key signature (versionCode 16) | ✅ PASS |
| **Frontend Production Bundle** | Vite Build (`npm run build`) | Zero syntax errors, bundled clean in 748ms | ✅ PASS |

---

## 📦 Deployment Instructions

1. **Frontend (Production Web)**:
   - Built and deployed automatically via Git push to `origin main`.
   - Clear browser cache (`Ctrl + Shift + R`) or open in Incognito to view the updated warm theme and biometric features immediately.
2. **Backend (AWS EC2)**:
   - Deployed automatically via GitHub Actions `.github/workflows/deploy-aws.yml`.
   - Docker container runs with the new 30-minute Catch-Up Engine and Password Verification API.
3. **Android App (APK v1.2.2.11)**:
   - Generated via GitHub Actions `build-apk.yml`.
   - Direct download and install of `hostelcare-v1.2.2.11.apk`.
