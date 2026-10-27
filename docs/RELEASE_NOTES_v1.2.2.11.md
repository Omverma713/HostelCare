# HostelCare — Release Notes v1.2.2.11

**Release Version**: `v1.2.2.11`  
**Release Date**: October 26, 2026  
**Android Build**: `versionCode 16`, `versionName 1.2.2.11`  
**Git Tag**: `v1.2.2.11`  
**Target Git Commits**: `7ae5663` & `cde123d` on `main`  
**Production APK**: [hostelcare-v1.2.2.11.apk](file:///c:/Users/omv71/OneDrive/Desktop/hostelcare/mobile-app/dist-apk/hostelcare-v1.2.2.11.apk) (5.98 MB)

---

## 📌 Executive Summary

HostelCare **v1.2.2.11** introduces key administrative and user-experience upgrades across the web portal and mobile app:
1. **Collapsible 3-Line Sidebar**: Desktop and mobile sidebar toggle for a clutter-free, full-screen viewing experience.
2. **Warm-Toned Delegation Modal**: Enhanced light-theme aesthetics and fine-tuned padding for Sub-Admin delegations and feature scoping.
3. **Granular Feature Access Scoping**: Fine-grained permissions allowing Super Admins to delegate specific functional areas (Complaints, Rooms, Mess Alerts, Notices, Gate Passes, Fees) independently.
4. **Light Theme Contrast & UI Enhancements**: Elimination of dark-card contrast issues in Global Notices, invisible tab scrollbar track, and polished profile controls.
5. **Real-time Dev Chat Polish**: WhatsApp-style message delivery indicators (double ticks, clock status) and support ticket locking.
6. **Mobile App Synchronization**: Android bundle updated with new web assets, signed keystore verification, and version parity across the full stack.

---

## 🚀 What's New & Key Highlights

### 1. 🗂️ 3-Line Hamburger Collapsible Sidebar (Desktop & Mobile)
- **Compact Desktop Rail**: Super Admins can now collapse the full sidebar into a minimal icon rail with a single click on the new 3-line hamburger button.
- **Full-Screen Data Immersion**: Expanding tables and analytics charts across the full screen width without distraction.
- **Persistent Header Placement**: Positioned cleanly inside the sidebar brand header with zero text clipping or overlapping across all standard desktop resolutions (1080p, 1440p, 4K).
- **Responsive Drawer Sync**: Unified behavior across mobile screens (overlay slide-out drawer) and desktop screens (docked collapsible rail).

### 2. 🎨 Warm-Toned Sub-Admin Delegation UI
- **Aesthetic Refinement in Light Theme**:
  - Replaced cold gray boxes with soft warm amber gradients (`bg-amber-500/10`, `border-amber-400/30`, `text-amber-800`).
  - Warm badges and pill highlights for delegation status and duration tags.
- **Redesigned Feature Scope Box**:
  - Distinct visual separation between **"All Features (Full Access)"** and **"Custom Scope Selection"**.
  - Interactive multi-select checkboxes for granular permissions with subtle hover micro-animations.
- **Padding & Form Alignment**:
  - Cleaned up vertical and horizontal padding across all input fields, admin dropdown selectors, and date pickers.

### 3. 🛡️ Granular Delegation Engine & Defensive Safety
- **Granular Scoping**: Delegate individual modules:
  - `complaints` — View, assign, and resolve student tickets.
  - `rooms` — Manage room inventory and allocations.
  - `mess` — Modify menus and dispatch live meal notifications.
  - `notices` — Broadcast urgent and regular hostel notices.
  - `gatepass` — Approve or reject student leaves and gate passes.
  - `fees` — Access payment statuses and dues ledger.
- **Temporary & Indefinite Durations**: Configure time-bound delegation with automatic expiration or indefinite authority with 1-click revoke buttons.
- **Defensive Data Handling**: Added default form fallbacks (`DEFAULT_DELEGATION_FORM`) and null-safe array guards to eliminate white-screen crashes from uninitialized scope arrays.

### 4. ☀️ Light Theme Contrast & Portal Navigation Fixes
- **Global Notices Contrast Bug Fixed**: Fixed an issue where emergency global notice cards retained dark-theme background colors in light mode, causing poor text legibility.
- **Scrollbar Elimination**: Cleaned the horizontal tabs bar in SuperAdminPortal by hiding the scrollbar track (`scrollbar-none`) while preserving smooth horizontal drag and trackpad scrolling.
- **Profile Action Button**: Elevated the "My Profile" button styling with improved border accents and hover states.

### 5. 💬 WhatsApp-Style Real-time Developer Chat Polish
- **Dynamic Delivery Ticks**: Single gray tick (sent), double gray tick (delivered to server), and double blue tick (read by recipient), complemented by a pending clock icon during offline or queued states.
- **Ticket Locking**: Prevents overlapping admin responses by locking active chats when an admin is actively composing a reply.
- **Flush Input Bar**: Optimized keyboard handling on mobile web and Capacitor Android views.

### 6. 🛠️ Critical APK & User Directory Fixes
- **Super Admin Self-Profile Resolution**: Fixed `"Admin profile not found"` error when opening "My Profile" by correctly matching `req.user.id || req.user._id` across JWT auth middleware and the `getSuperAdminSelfProfile` endpoint.
- **User Directory Direct Navigation**: Removed erroneous `&action=create` URL parameter from the Sidebar navigation link (`Sidebar.jsx`), preventing the "Create User Account" modal from automatically popping up upon entering the User Directory.
- **Centered User Details Modal Popup**: Converted the inline user details view into a centered, full-featured popup modal with backdrop blur overlay, smooth slide-up animation, click-outside dismissal, and Escape key listener, resolving the mobile issue where user details appeared at the bottom of the long list.
- **Argon2 Password Update Integrity**: Replaced invalid nested require imports (`../utils/argon`) with root-level `argon2` module across `updateUserProfile` and `updateSuperAdminSelfProfile`.

### 7. 📱 Android APK & Full-Stack Version Parity
- **Production APK Build**:
  - Target: Android 8.0+ (API 26 to 34).
  - File: `mobile-app/dist-apk/hostelcare-v1.2.2.11.apk`.
  - Package Size: **6.05 MB**.
  - Signature: Verified via release keystore (`SHA-256: 1B:78:F1:1D:05:56:2B:38:...`).
- **Synchronized Versioning**:
  - `package.json` -> `1.2.2.11`
  - `frontend/package.json` -> `1.2.2.11`
  - `src/models/systemConfig.model.js` -> `1.2.2.11`
  - `src/controllers/appVersion.controller.js` -> `1.2.2.11`
  - `src/controllers/superAdmin.controllers.js` -> `1.2.2.11`
  - `frontend/src/pages/SuperAdminPortal.jsx` -> `1.2.2.11`
  - `frontend/src/pages/DevChatPage.jsx` -> `1.2.2.11`
  - `mobile-app/android/app/build.gradle` -> `versionCode 16`, `versionName 1.2.2.11`

---

## 🛠️ Verification & Quality Assurance

| Test Scenario | Platform / View | Result | Status |
| :--- | :--- | :--- | :--- |
| **Super Admin Self-Profile Modal** | Android APK / Web | Profile loads with user credentials, no 404 error | ✅ PASS |
| **User Directory Sidebar Link** | Android APK / Web | Clean navigation to directory without auto-opening create modal | ✅ PASS |
| **User Details Dialog Popup** | Mobile APK / Desktop | Manage Details opens centered modal overlay above content | ✅ PASS |
| **Desktop 3-Line Sidebar Toggle** | Chrome / Edge | Smooth collapse to icon rail, zero layout shift | ✅ PASS |
| **Delegation Modal Light Theme** | Light Mode Portal | Warm amber styling, legible contrast, no dark card bugs | ✅ PASS |
| **Granular Scope Selection** | Delegation Modal | Custom multi-select scopes save and render properly | ✅ PASS |
| **Global Notices Light Theme** | SuperAdmin Notices Tab | Crisp contrast, legible dark typography on soft background | ✅ PASS |
| **Chat WhatsApp Ticks** | Dev Chat Page | Correct icon states (clock, single, double ticks) | ✅ PASS |
| **Android APK Compilation** | Gradle Release Build | Clean build in 31s, verified key signature | ✅ PASS |
| **Frontend Production Bundle** | Vite Build (`npm run build`) | Zero syntax errors, bundled clean | ✅ PASS |
| **Backend API Health Check** | Node.js / Express | Route syntax clean, 13/13 Super Admin tests pass | ✅ PASS |


---

## 📦 Deployment Instructions

1. **Frontend (Cloudflare Workers / Pages)**:
   - Changes are pushed to `origin main`.
   - Clear browser cache (`Ctrl + Shift + R` or `Ctrl + F5`) or use Incognito to view the updated bundle immediately.
2. **Backend (AWS EC2)**:
   - Deployed automatically via GitHub Actions `.github/workflows/deploy-aws.yml`.
3. **Android App**:
   - Install or distribute [hostelcare-v1.2.2.11.apk](file:///c:/Users/omv71/OneDrive/Desktop/hostelcare/mobile-app/dist-apk/hostelcare-v1.2.2.11.apk) to devices.
