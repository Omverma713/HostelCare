# HostelCare Mobile App (Android APK)

This folder (`mobile-app/`) contains the isolated Android packaging workspace for **HostelCare** built with **Capacitor**.

The core frontend code stays inside `frontend/` (single source of truth). This directory builds and syncs the production bundle into `www/` and updates the native Android Studio project inside `android/`.

---

## 📱 How to Generate the APK

### Step 1: Sync Frontend and Mobile Project
Run the following command from the project root or inside `mobile-app`:

```bash
# Inside mobile-app directory:
npm run build:mobile
```
*This automatically builds `frontend/` in production mode, copies assets to `mobile-app/www`, and synchronizes Capacitor plugins and assets with `mobile-app/android`.*

---

### Step 2: Open in Android Studio

Run:
```bash
npm run open:android
```
*(Or manually open the `mobile-app/android` folder in **Android Studio**)*.

---

### Step 3: Build the Debug APK

1. In Android Studio, wait for Gradle Sync to finish.
2. Go to top menu: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Once the build completes, click **locate** in the popup notification (or find the APK at):
   ```
   mobile-app/android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. Transfer `app-debug.apk` to any Android device or run directly on an emulator!

---

## 🛠️ Mobile Configuration Details

- **App ID**: `com.hostelcare.app`
- **App Name**: `HostelCare`
- **Backend API**: `https://hostelcare-9od3.onrender.com/api/v1` (Production HTTPS)
- **Permissions**: Internet access (`android.permission.INTERNET`)
- **Hardware Back Button**: Handled to close modals/drawers or exit gracefully.
- **Safe Area**: Configured with `viewport-fit=cover`.

---

## 📜 Available NPM Scripts

| Script | Description |
| :--- | :--- |
| `npm run sync:web` | Compiles `frontend/` and syncs production build to `mobile-app/www/` |
| `npm run cap:sync` | Syncs web assets and native plugins with `android/` |
| `npm run build:mobile` | Full pipeline: frontend build -> web sync -> Capacitor sync |
| `npm run open:android` | Opens `mobile-app/android` directly in Android Studio |
