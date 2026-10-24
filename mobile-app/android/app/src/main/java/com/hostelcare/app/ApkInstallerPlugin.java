package com.hostelcare.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "ApkInstallerPlugin")
public class ApkInstallerPlugin extends Plugin {

    private final AtomicBoolean isCancelled = new AtomicBoolean(false);
    private Thread currentDownloadThread = null;
    private File lastDownloadedApk = null;

    /**
     * Check if the app has permission to install unknown APK packages (Android 8.0+).
     */
    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                boolean granted = getContext().getPackageManager().canRequestPackageInstalls();
                ret.put("granted", granted);
            } else {
                ret.put("granted", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check install permission: " + e.getMessage(), e);
        }
    }

    /**
     * Open system settings to allow installing apps from this source.
     */
    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("opened", false);
                ret.put("message", "Not required on Android < 8.0");
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Could not open install permission settings: " + e.getMessage(), e);
        }
    }

    /**
     * Download the APK inside the app with real-time progress callbacks and SHA-256 verification.
     */
    @PluginMethod
    public void downloadApk(PluginCall call) {
        String downloadUrl = call.getString("url");
        String expectedSha256 = call.getString("expectedSha256");

        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("Download URL is required");
            return;
        }

        isCancelled.set(false);

        currentDownloadThread = new Thread(() -> {
            HttpURLConnection connection = null;
            InputStream inputStream = null;
            FileOutputStream outputStream = null;
            File tempFile = null;

            try {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir();
                if (cacheDir == null) {
                    cacheDir = context.getCacheDir();
                }
                File updatesDir = new File(cacheDir, "updates");
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new Exception("Could not create updates directory: " + updatesDir.getAbsolutePath());
                }

                tempFile = new File(updatesDir, "hostelcare-update.apk.tmp");
                File finalFile = new File(updatesDir, "hostelcare-update.apk");

                if (tempFile.exists()) {
                    tempFile.delete();
                }
                if (finalFile.exists()) {
                    finalFile.delete();
                }

                // Follow redirects manually if needed (GitHub Releases redirect across domains)
                String currentUrl = downloadUrl.trim();
                int redirects = 0;
                while (redirects < 10) {
                    URL u = new URL(currentUrl);
                    connection = (HttpURLConnection) u.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setConnectTimeout(30000);
                    connection.setReadTimeout(60000);
                    connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android " + Build.VERSION.RELEASE + "; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 HostelCare-Updater");
                    connection.setRequestProperty("Accept", "*/*");
                    connection.setRequestProperty("Accept-Encoding", "identity");
                    connection.setRequestProperty("Connection", "keep-alive");
                    connection.connect();

                    int responseCode = connection.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                        responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                        responseCode == HttpURLConnection.HTTP_SEE_OTHER ||
                        responseCode == 307 || responseCode == 308) {
                        String newUrl = connection.getHeaderField("Location");
                        if (newUrl != null) {
                            currentUrl = newUrl;
                            redirects++;
                            connection.disconnect();
                            continue;
                        }
                    }
                    if (responseCode != HttpURLConnection.HTTP_OK) {
                        throw new Exception("Server returned HTTP " + responseCode + ": " + connection.getResponseMessage());
                    }
                    break;
                }

                long totalBytes = connection.getContentLengthLong();
                inputStream = new BufferedInputStream(connection.getInputStream(), 65536);
                outputStream = new FileOutputStream(tempFile);

                MessageDigest digest = MessageDigest.getInstance("SHA-256");

                byte[] buffer = new byte[65536];
                long bytesDownloaded = 0;
                int bytesRead;
                long lastProgressEmitTime = 0;
                int lastReportedPercent = -1;

                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    if (isCancelled.get()) {
                        try { outputStream.close(); } catch (Exception ignored) {}
                        if (tempFile.exists()) { tempFile.delete(); }
                        JSObject cancelRet = new JSObject();
                        cancelRet.put("cancelled", true);
                        call.resolve(cancelRet);
                        return;
                    }

                    outputStream.write(buffer, 0, bytesRead);
                    digest.update(buffer, 0, bytesRead);
                    bytesDownloaded += bytesRead;

                    long now = System.currentTimeMillis();
                    int percent = totalBytes > 0 ? (int) ((bytesDownloaded * 100) / totalBytes) : -1;

                    // Emit progress throttled to max once every 100ms or on each percentage change
                    if (now - lastProgressEmitTime >= 100 || percent != lastReportedPercent) {
                        lastProgressEmitTime = now;
                        lastReportedPercent = percent;

                        JSObject progressObj = new JSObject();
                        progressObj.put("bytesDownloaded", bytesDownloaded);
                        progressObj.put("totalBytes", totalBytes);
                        progressObj.put("percent", percent);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                outputStream.flush();
                outputStream.close();
                outputStream = null;
                inputStream.close();
                inputStream = null;

                // Rename temp file to final .apk
                if (finalFile.exists()) {
                    finalFile.delete();
                }
                if (!tempFile.renameTo(finalFile)) {
                    throw new Exception("Failed to rename temporary download file to " + finalFile.getAbsolutePath());
                }

                lastDownloadedApk = finalFile;

                // Calculate actual SHA-256
                byte[] hashBytes = digest.digest();
                StringBuilder sb = new StringBuilder();
                for (byte b : hashBytes) {
                    sb.append(String.format("%02x", b));
                }
                String computedSha256 = sb.toString();

                // Verify checksum if an expected checksum was supplied
                if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
                    String cleanExpected = expectedSha256.trim().replaceAll("[:\\s-]", "").toLowerCase();
                    String cleanComputed = computedSha256.toLowerCase();

                    if (!cleanExpected.equals(cleanComputed)) {
                        if (finalFile.exists()) {
                            finalFile.delete();
                        }
                        lastDownloadedApk = null;

                        JSObject mismatchRet = new JSObject();
                        mismatchRet.put("success", false);
                        mismatchRet.put("error", "CHECKSUM_MISMATCH");
                        mismatchRet.put("expectedSha256", expectedSha256);
                        mismatchRet.put("computedSha256", computedSha256);
                        mismatchRet.put("message", "Security verification failed: APK SHA-256 checksum mismatch.");
                        call.resolve(mismatchRet);
                        return;
                    }
                }

                // Final 100% progress notification
                JSObject finalProgress = new JSObject();
                finalProgress.put("bytesDownloaded", bytesDownloaded);
                finalProgress.put("totalBytes", totalBytes > 0 ? totalBytes : bytesDownloaded);
                finalProgress.put("percent", 100);
                notifyListeners("downloadProgress", finalProgress);

                JSObject successRet = new JSObject();
                successRet.put("success", true);
                successRet.put("filePath", finalFile.getAbsolutePath());
                successRet.put("sha256", computedSha256);
                successRet.put("sizeBytes", bytesDownloaded);
                call.resolve(successRet);

            } catch (Exception e) {
                if (tempFile != null && tempFile.exists()) {
                    tempFile.delete();
                }
                call.reject("APK download failed: " + e.getMessage(), e);
            } finally {
                if (outputStream != null) {
                    try { outputStream.close(); } catch (Exception ignored) {}
                }
                if (inputStream != null) {
                    try { inputStream.close(); } catch (Exception ignored) {}
                }
                if (connection != null) {
                    try { connection.disconnect(); } catch (Exception ignored) {}
                }
            }
        });

        currentDownloadThread.start();
    }

    /**
     * Cancel any active download in progress.
     */
    @PluginMethod
    public void cancelDownload(PluginCall call) {
        isCancelled.set(true);
        if (currentDownloadThread != null && currentDownloadThread.isAlive()) {
            currentDownloadThread.interrupt();
        }
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        call.resolve(ret);
    }

    /**
     * Launch Android's official PackageInstaller for the downloaded APK using FileProvider.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        try {
            Context context = getContext();
            String customPath = call.getString("filePath");
            File apkFile = customPath != null ? new File(customPath) : lastDownloadedApk;

            if (apkFile == null || !apkFile.exists() || apkFile.length() == 0) {
                call.reject("No valid APK file found to install.");
                return;
            }

            // Check if Android 8.0+ has REQUEST_INSTALL_PACKAGES permission granted
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    JSObject permRet = new JSObject();
                    permRet.put("success", false);
                    permRet.put("needsPermission", true);
                    permRet.put("message", "Permission to install unknown apps is required.");
                    call.resolve(permRet);
                    return;
                }
            }

            Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(installIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("launched", true);
            ret.put("message", "Android PackageInstaller launched successfully.");
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to launch APK installation: " + e.getMessage(), e);
        }
    }
}
