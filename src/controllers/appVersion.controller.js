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
      updateType: evaluation.updateType, // 'none' | 'flexible' | 'immediate'
      updateMessage: appVersionConfig.updateMessage,
      updateUrl: appVersionConfig.updateUrl,
      releaseNotes: appVersionConfig.releaseNotes || "",
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

module.exports = {
  getAppVersionStatus,
};
