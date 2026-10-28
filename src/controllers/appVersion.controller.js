const jwt = require("jsonwebtoken");
const SystemConfig = require("../models/systemConfig.model");
const { isValidVersion, evaluateUpdate, compareVersions } = require("../utils/versionComparator");
const { getClientIdentityByIp, recordClientIdentity } = require("../utils/clientTracker");

/**
 * Public, read-only Version-Check API
 * GET /api/v1/app-version
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
      updateMessage: "A new version of HostelCare is available.",
      updateUrl: "https://play.google.com/store/apps/details?id=com.hostelcare.app",
      forceUpdate: false,
      isSuspended: false,
      releaseNotes: "",
      targetAudience: "all",
      targetedRegistrationNumbers: [],
      targetedRoles: [],
      targetedHostels: [],
    };

    const pilotConfig = config.pilotTesting || {
      enabled: false,
      isSuspended: false,
      version: "1.2.2.12",
      updateUrl: "https://github.com/Omverma713/HostelCare/releases/download/v1.2.2.12/hostelcare-v1.2.2.12.apk",
      updateMessage: "You have been selected for the HostelCare Pilot Beta Program! Please update to test the newest features.",
      releaseNotes: "",
      forceUpdate: false,
      targetedRegistrationNumbers: [],
    };

    // 1. Extract requester identity from query params, decoded JWT, or IP tracker
    let clientRegistrationNumber = (
      req.query.registrationNumber ||
      req.query.regNo ||
      req.query.username ||
      ""
    ).toString().trim().toUpperCase() || null;
    let clientRole = req.query.role ? String(req.query.role).trim().toLowerCase() : null;
    let clientHostel = req.query.hostel ? String(req.query.hostel).trim().toLowerCase() : null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwt.decode(token);
        if (decoded) {
          if (!clientRegistrationNumber && (decoded.registrationNumber || decoded.regNo || decoded.username)) {
            clientRegistrationNumber = String(decoded.registrationNumber || decoded.regNo || decoded.username).trim().toUpperCase();
            recordClientIdentity(req.ip, clientRegistrationNumber);
          }
          if (!clientRole && decoded.role) {
            clientRole = String(decoded.role).trim().toLowerCase();
          }
          if (!clientHostel && decoded.hostel) {
            clientHostel = String(decoded.hostel).trim().toLowerCase();
          }
        }
      } catch (e) {
        // Safe ignore token decode error
      }
    }

    // Fallback: If older APK client (like v1.2.2.0) did not send auth header/regNo, check IP tracker!
    if (!clientRegistrationNumber) {
      const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
      const detectedReg = getClientIdentityByIp(ip);
      if (detectedReg) {
        clientRegistrationNumber = detectedReg;
      }
    }

    // 2. Check Pilot Testing target registration numbers independently
    const pilotTargets = (pilotConfig.targetedRegistrationNumbers || []).map((r) => String(r).trim().toUpperCase());
    const isPilotTargetedUser = clientRegistrationNumber && pilotTargets.includes(clientRegistrationNumber);
    const isPilotRolloutActive = Boolean(pilotConfig.enabled) && Boolean(pilotConfig.version) && Boolean(pilotConfig.updateUrl);

    // ── CHANNEL A: PILOT TESTING ROLLOUT (100% INDEPENDENT FROM PRODUCTION APP UPDATE) ──
    if (isPilotTargetedUser && isPilotRolloutActive) {
      // Check if Pilot Release specifically is suspended (independent of appVersionConfig.isSuspended)
      if (pilotConfig.isSuspended) {
        return res.status(200).json({
          success: true,
          clientVersion: currentVersion || null,
          platform: platform || "android",
          buildNumber: buildNumber || null,
          latestVersion: currentVersion || pilotConfig.version || "1.2.2.12",
          minimumSupportedVersion: appVersionConfig.minimumSupportedVersion,
          updateAvailable: false,
          forceUpdate: false,
          updateType: "none",
          isSuspended: true,
          isPilot: true,
          suspendedReason: pilotConfig.suspendedReason || "Pilot release is temporarily paused by administrator.",
          targetAudience: "specific",
          isTargeted: true,
          updateMessage: "Pilot release is currently paused by administration.",
          updateUrl: pilotConfig.updateUrl,
          releaseNotes: "",
          releaseMedia: [],
          apkSha256: "",
          checkedAt: new Date().toISOString(),
        });
      }

      // Pilot is ACTIVE and NOT suspended: deliver pilot version
      const targetVersion = pilotConfig.version || appVersionConfig.latestVersion || "1.2.2.12";
      const hasNewer = currentVersion ? compareVersions(targetVersion, currentVersion) > 0 : true;
      const isForced = Boolean(pilotConfig.forceUpdate);

      return res.status(200).json({
        success: true,
        clientVersion: currentVersion || null,
        platform: platform || "android",
        buildNumber: buildNumber || null,
        latestVersion: targetVersion,
        minimumSupportedVersion: appVersionConfig.minimumSupportedVersion,
        updateAvailable: hasNewer,
        forceUpdate: isForced,
        updateType: isForced ? "immediate" : (hasNewer ? "flexible" : "none"),
        isSuspended: false,
        isPilot: true,
        targetAudience: "specific",
        isTargeted: true,
        updateMessage: pilotConfig.updateMessage || `HostelCare Beta v${targetVersion} is ready for your pilot account!`,
        updateUrl: pilotConfig.updateUrl || appVersionConfig.updateUrl,
        releaseNotes: pilotConfig.releaseNotes || appVersionConfig.releaseNotes || "",
        releaseMedia: pilotConfig.releaseMedia || appVersionConfig.releaseMedia || [],
        apkSha256: pilotConfig.apkSha256 || appVersionConfig.apkSha256 || "",
        checkedAt: new Date().toISOString(),
      });
    }

    // ── CHANNEL B: TARGET AUDIENCE IS SPECIFIC BUT USER IS NOT TARGETED ──
    const targetedRegs = (appVersionConfig.targetedRegistrationNumbers || []).map((r) => String(r).trim().toUpperCase());
    const targetedRoles = (appVersionConfig.targetedRoles || []).map((r) => String(r).trim().toLowerCase());
    const targetedHostels = (appVersionConfig.targetedHostels || []).map((h) => String(h).trim().toLowerCase());

    const isAppTargetedUser =
      (clientRegistrationNumber && targetedRegs.includes(clientRegistrationNumber)) ||
      (clientRole && targetedRoles.includes(clientRole)) ||
      (clientHostel && targetedHostels.includes(clientHostel));

    if (appVersionConfig.targetAudience === "specific" && !isAppTargetedUser) {
      return res.status(200).json({
        success: true,
        clientVersion: currentVersion || null,
        platform: platform || "android",
        buildNumber: buildNumber || null,
        latestVersion: currentVersion || appVersionConfig.latestVersion,
        minimumSupportedVersion: appVersionConfig.minimumSupportedVersion,
        updateAvailable: false,
        forceUpdate: false,
        updateType: "none",
        isSuspended: false,
        isPilot: false,
        targetAudience: "specific",
        isTargeted: false,
        updateMessage: "You are currently on the stable channel for your user account.",
        updateUrl: appVersionConfig.updateUrl,
        releaseNotes: "",
        releaseMedia: [],
        apkSha256: "",
        checkedAt: new Date().toISOString(),
      });
    }

    // ── CHANNEL C: GLOBAL ROLLOUT (ALL USERS) ──────────────────────────────────
    if (appVersionConfig.isSuspended) {
      return res.status(200).json({
        success: true,
        clientVersion: currentVersion || null,
        platform: platform || "android",
        buildNumber: buildNumber || null,
        latestVersion: currentVersion || appVersionConfig.latestVersion,
        minimumSupportedVersion: appVersionConfig.minimumSupportedVersion,
        updateAvailable: false,
        forceUpdate: false,
        updateType: "none",
        isSuspended: true,
        isPilot: false,
        suspendedReason: appVersionConfig.suspendedReason || "Release is temporarily paused by administrator.",
        targetAudience: "all",
        isTargeted: true,
        updateMessage: "Release is currently suspended by administration.",
        updateUrl: appVersionConfig.updateUrl,
        releaseNotes: "",
        releaseMedia: [],
        apkSha256: "",
        checkedAt: new Date().toISOString(),
      });
    }

    let evaluation = {
      updateAvailable: false,
      forceUpdate: false,
      updateType: "none",
      isBelowMinimum: false,
      isBelowLatest: false,
    };

    if (currentVersion) {
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
      updateType: evaluation.updateType,
      isSuspended: false,
      isPilot: false,
      targetAudience: "all",
      isTargeted: true,
      updateMessage: appVersionConfig.updateMessage,
      updateUrl: appVersionConfig.updateUrl,
      releaseNotes: appVersionConfig.releaseNotes || "",
      releaseMedia: appVersionConfig.releaseMedia || [],
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
