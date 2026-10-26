# 🍱 Ultra High-Tech Mess Auto-Alerts & Mission Control Roadmap

> **Cost:** 100% Lifetime Free (Google FCM + Native Android Hardware Clock + Existing Stack)  
> **Guaranteed Delivery:** Works even if the app has not been opened for 10 to 60+ days.

---

## 🔍 Root Cause Analysis (Why today showed "Dispatched" but no notification arrived)

1. **Session-Coupled Tokens (Fragile Storage):**
   - Push tokens were stored on temporary `Session` documents (`Session.find({ status: "active" })`).
   - If a student logged out, closed the app, or the session JWT expired, `sessions.length === 0`.
2. **False Positive "Dispatched" Status:**
   - In `messReminderScheduler.js`, when `sessions.length === 0`, it returned `targets: 0`.
   - The scheduler still called `MessNotificationDispatch.markDispatched()`, marking it as "dispatched" in MongoDB even though **0 devices were reached**.
3. **Android Deep Sleep (Doze Mode):**
   - Aggressive Android battery optimizers (MIUI, Samsung OneUI, Realme, ColorOS) kill background apps if unopened for days unless FCM is configured with High-Priority WakeLock and hardware persistence.

---

## 🛠️ The 3-Layer Solution Architecture

```
[ Super Admin Mission Control ] ──(Individual / Auto Trigger)──┐
                                                               │
  ┌────────────────────────────────────────────────────────────┴───────────────────────────┐
  │                                   BACKEND ENGINE                                       │
  │  1. Persistent Hardware Device Vault (Tokens never expire even if app closed 30 days)  │
  │  2. FCM High-Priority WakeLock Engine (Bypasses Android Doze Mode)                     │
  │  3. Honest Delivery Audit (Real-time Accepted / Delivered / Failed stats)             │
  └────────────────────────────┬───────────────────────────────┬───────────────────────────┘
                               │                               │
                               ▼                               ▼
                 [ FCM Cloud Gateway ]             [ Android Local AlarmManager ]
             (High-Priority Heads-Up Push)          (Runs 100% offline at 8:00 AM)
                               │                               │
                               └───────────────┬───────────────┘
                                               ▼
                              📱 Student Phone (Lock Screen Alert)
```

---

## 📌 Layer 1: Hardware Device Token Vault (MongoDB)

- **Decoupled from Sessions:**
  - Create a permanent `DeviceRegistry` collection:
    ```js
    {
      deviceId: { type: String, required: true, unique: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userRole: String,
      hostelBlock: String,
      roomNumber: String,
      pushToken: String,
      platform: { type: String, enum: ['android', 'ios', 'web'] },
      pushProvider: { type: String, enum: ['fcm', 'webpush'] },
      isActive: { type: Boolean, default: true },
      lastSeenAt: Date
    }
    ```
  - Device tokens persist permanently. Even if user's login session expires after 7 days, the device hardware remains registered in the push vault.
- **FCM High-Priority WakeLock Payload:**
  - High-priority flag: `android.priority: "high"`
  - Direct boot / lock screen heads-up display: `importance: 5`, `visibility: "public"`
  - Channel: `hostelcare_custom_channel` with custom sound and vibration.

---

## 📌 Layer 2: Android Native Exact Alarm Fallback (Offline Guarantee)

- Utilizes Android's native hardware clock: `AlarmManager.setExactAndAllowWhileIdle()` and `WorkManager`.
- When app is opened, it schedules the next 14 days of meal start reminders locally on the phone's internal processor.
- **Benefit:** Even if the student has no internet, phone is in flight mode, or backend server is down, the phone rings at the exact meal time with the menu items.

---

## 📌 Layer 3: Ultra High-Tech Mission Control Center (Super Admin UI)

### 1. Live Device Radar:
- Real-time gauge of active reachable devices:
  - 🟢 **Android Hardware Registered:** `142 Devices`
  - 🌐 **Web Push Browsers:** `28 Devices`
  - 🔴 **Stale / Cleaned Tokens:** `2 Devices`

### 2. Granular Individual Push Controls:
- **Instant Test Trigger:** *"Send Test Alert to My Phone Now"* for 1-click verification.
- **Precision Targeting Dropdown:**
  - 🎯 **Single Student** (Search by Name / Reg No / Roll No)
  - 🏢 **Specific Wing / Room** (e.g. Wing B, 2nd Floor, Room 204)
  - 👥 **Role-based** (Students, Caretakers, Wardens)
  - 📢 **Universal Broadcast** (Entire Hostel)

### 3. Independent Per-Meal Automation Switches:
- Individual control toggles for each meal:
  - 🍳 **Breakfast Alert:** `[ ON / OFF ]` • Lead time: `[-15 mins]` • Start: `08:00 AM`
  - 🍛 **Lunch Alert:** `[ ON / OFF ]` • Lead time: `[-20 mins]` • Start: `12:30 PM`
  - ☕ **Evening Snacks:** `[ ON / OFF ]` • Lead time: `[-10 mins]` • Start: `05:30 PM`
  - 🍽️ **Dinner Alert:** `[ ON / OFF ]` • Lead time: `[-15 mins]` • Start: `08:00 PM`
- Real-time Menu item preview and edit button before dispatch.

### 4. Honest Real-Time Delivery Audit Log:
- Replaces fake "Dispatched" label with verified stats:
  - **Targets Targeted:** `142`
  - **FCM Accepted (Google Gateway Confirmed):** `141`
  - **Failed / Stale Removed:** `1`
  - **Warning on 0 targets:** If 0 devices are registered, display prominent amber alert: `⚠️ 0 Active Devices in Registry — Dispatch Aborted`.

---

## 📅 Implementation Phases (Ready for execution when requested)

1. **Phase 1: Backend Device Vault & FCM Payload Fix**
   - Create `DeviceRegistry` model & migration.
   - Update `pushService.js` to target permanent devices instead of ephemeral sessions.
   - Fix `messReminderScheduler.js` to prevent false positive "dispatched" status when targets = 0.
2. **Phase 2: Super Admin Mission Control Dashboard**
   - Build Cyberpunk-style Mission Control UI in Admin Dashboard.
   - Add Live Device Radar, Test Alert button, and Individual meal toggles.
3. **Phase 3: Android Native Local Alarms (Capacitor/APK)**
   - Sync 14-day offline local notifications via native Android AlarmManager.
