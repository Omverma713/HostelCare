const SystemConfig = require("../models/systemConfig.model");
const { isValidVersion, evaluateUpdate } = require("../utils/versionComparator");

/**
 * Public, read-only Version-Check API
 * GET /api/v1/app-version
 * 
 * Validates request parameters and returns a structured response indicating
 * whether an optional or forced update is required. Never exposes internal credentials.
 */
const getAppVersionStatus = async (req, res) => {
  try {
    const { currentVersion, platform, buildNumber } = req.query;

    if (currentVersion && !isValidVersion(currentVersion)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VERSION_FORMAT",
        message: "Invalid currentVersion format. Expected semantic version (e.g. 1.0.0 or v1.0.0).",
      });
    }

    const config = await SystemConfig.getEffectiveConfig();
    const appVersionConfig = config.appVersion || {
      latestVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
      updateMessage: "A new version of HostelCare is available. Please update to continue enjoying the latest features.",
      updateUrl: "https://play.google.com/store/apps/details?id=com.hostelcare.app",
      forceUpdate: false,
      releaseNotes: "",
    };

    const origin = String(req.headers.origin || req.headers.referer || '');
    const isWebRequest =
      platform === 'web' ||
      origin.includes('workers.dev') ||
      origin.includes('localhost:5173');

    let evaluation = {
      updateAvailable: false,
      forceUpdate: false,
      updateType: "none",
      isBelowMinimum: false,
      isBelowLatest: false,
    };

    if (currentVersion && !isWebRequest) {
      evaluation = evaluateUpdate({
        currentVersion,
        latestVersion: appVersionConfig.latestVersion,
        minimumSupportedVersion: appVersionConfig.minimumSupportedVersion,
        forceUpdateFlag: appVersionConfig.forceUpdate,
      });
    }

    return res.status(200).json({
      success: true,
      clientVersion: currentVersion || null,
      platform: platform || "android",
      buildNumber: buildNumber || null,
      latestVersion: appVersionConfig.latestVersion,
      minimumSupportedVersion: appVersionConfig.minimumSupportedVersion,
      updateAvailable: evaluation.updateAvailable,
      forceUpdate: evaluation.forceUpdate,
      updateType: evaluation.updateType, // 'none' | 'flexible' | 'immediate'
      updateMessage: appVersionConfig.updateMessage,
      updateUrl: appVersionConfig.updateUrl,
      releaseNotes: appVersionConfig.releaseNotes || "",
      apkSha256: appVersionConfig.apkSha256 || "",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve app version configuration",
      error: error.message,
    });
  }
};

/**
 * Direct APK Download Endpoint
 * GET /api/v1/app-version/download
 * 
 * Streams the latest release APK with explicit Content-Length, Content-Type,
 * and Connection: close headers to prevent mobile browsers from stalling at 100%.
 */
const fs = require("fs");
const path = require("path");

const downloadLatestApk = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const latestVersion = config?.appVersion?.latestVersion || "1.2.2.0";
    const updateUrl = config?.appVersion?.updateUrl || "";

    // Candidate local APK files
    const localCandidates = [
      path.resolve(__dirname, `../../mobile-app/dist-apk/hostelcare-v${latestVersion}.apk`),
      path.resolve(__dirname, "../../HostelCare.apk"),
      path.resolve(__dirname, "../../mobile-app/android/app/build/outputs/apk/debug/app-debug.apk"),
    ];

    let foundPath = null;
    for (const cand of localCandidates) {
      if (fs.existsSync(cand)) {
        foundPath = cand;
        break;
      }
    }

    if (foundPath) {
      const stat = fs.statSync(foundPath);
      const filename = `HostelCare-v${latestVersion}.apk`;

      res.status(200);
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Connection", "close");
      res.setHeader("Cache-Control", "public, max-age=3600, no-transform");

      const fileStream = fs.createReadStream(foundPath);
      fileStream.pipe(res);
      return;
    }

    // If not found locally, redirect cleanly to the configured direct update URL
    if (updateUrl && updateUrl.startsWith("http")) {
      return res.redirect(302, updateUrl);
    }

    return res.status(404).json({
      success: false,
      message: "Release APK file not found on server.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to serve APK download",
      error: error.message,
    });
  }
};

module.exports = {
  getAppVersionStatus,
  downloadLatestApk,
};
