# HostelCare — Release Notes v1.2.2.14 (Build 19)

**Release Version**: `v1.2.2.14`  
**Date**: November 5, 2026  
**Android Build**: `versionCode 19`, `versionName 1.2.2.14`  
**Target Architecture**: Android 8.0+ (API 26–34)  
**Target APK Download**: `https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.14/hostelcare-v1.2.2.14.apk`

---

## 🌟 Executive Summary of Changes

HostelCare **v1.2.2.14 (Build 19)** brings the **Tactile Linen & Daily Living (Variation 2)** design system into production, delivers high-speed boot time optimization, eliminates duplicate notifications, and maintains 100% role-based dashboard integrity.

---

## 🚀 Key Improvements

### 1. Instant Smooth Booting Experience
- **Eliminated Splash Freeze**: Replaced the previous 2000ms static splash hang with a 400ms boot threshold and programmatic `350ms` fade-out.
- **Zero-JS Inline Breathing Shield**: Embedded an inline SVG HostelCare crest shield with gold/sage shimmer within `index.html` inside `<div id="root">`, rendering instantaneously on Android launch before React bundle loads.

### 2. Tactile Linen & Daily Living UI (Variation 2)
- **100% Dynamic Resident Suite**: Fully powered by `useAuth()` data (`displayName`, `roomNumber`, `hostelBlock`, `registrationNumber`).
- **Security Gate Courier Parcel Banner**: Live package delivery notification card with interactive pickup confirmation button.
- **Tactile Quick Actions Grid**: 4 tactile cards with micro-hover haptic lift for Night Pass Outing, Gate Courier, Room Cleaning, and Silent Hours Help.
- **Featured Meal Spotlight Card**: Automatic meal detection with smart headline dish prioritization (curries/specials before carbs), accompaniments pills, and 1-tap community dining review rating widget.
- **Live Maintenance Stepper**: Dynamic ticket progress stepper synced with active student complaints.

### 3. Smart Notification Deduplication & Lock Screen Clarity
- **Purged Duplicate Local Alarms**: Synchronized alarm IDs with 7/8-digit hashes so that obsolete notifications are cleared.
- **Single Cloud Notification per Meal**: Assigned unique collapse keys (`tag: "hostelcare_meal_" + slotKey`) to prevent double notifications.

### 4. Comprehensive Role & Section Verification
- Verified all 5 roles and their respective views:
  - **Student**: Home Sanctuary, Campus Dining, Living Space / Pass, Maintenance Pipeline, Support Chat.
  - **Caretaker**: Real-time room maintenance tickets, resolution updates, and block status.
  - **Warden**: Disciplinary oversight, gate pass approvals, and student roster.
  - **Superintendent**: Administrative management, budget reviews, and hostel operations.
  - **Super Admin**: User directory, hardware sessions, automated DB maintenance, push announcements, and app updates.
