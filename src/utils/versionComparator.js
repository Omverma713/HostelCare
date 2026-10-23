/**
 * Semver and App Version Comparison Utilities
 * 
 * Safely compares application version strings (e.g. "1.0.0", "v1.2.3", "2.0")
 * according to Semantic Versioning specifications.
 */

/**
 * Validates whether a version string matches standard semantic version formats.
 * @param {string} version 
 * @returns {boolean}
 */
function isValidVersion(version) {
  if (typeof version !== "string") return false;
  const clean = version.trim().replace(/^v/i, "");
  if (!clean) return false;
  // Allows formats like: 1, 1.0, 1.0.0, 1.0.0-beta.1, 1.0.0.1
  const semverRegex = /^\d+(\.\d+)*(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
  return semverRegex.test(clean);
}

/**
 * Splits a version string into numeric parts and optional prerelease tag.
 * @param {string} version 
 * @returns {{ numbers: number[], prerelease: string | null }}
 */
function parseVersion(version) {
  const clean = String(version || "").trim().replace(/^v/i, "");
  const [mainPart, ...rest] = clean.split("-");
  const prerelease = rest.length > 0 ? rest.join("-") : null;

  const numbers = mainPart
    .split(".")
    .map((seg) => {
      const num = parseInt(seg, 10);
      return Number.isNaN(num) ? 0 : num;
    });

  // Ensure at least 3 parts (major.minor.patch) for consistent comparison
  while (numbers.length < 3) {
    numbers.push(0);
  }

  return { numbers, prerelease };
}

/**
 * Compares two semantic version strings.
 * 
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 * 
 * @param {string} v1 
 * @param {string} v2 
 * @returns {number}
 */
function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  const maxLen = Math.max(p1.numbers.length, p2.numbers.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1.numbers[i] !== undefined ? p1.numbers[i] : 0;
    const num2 = p2.numbers[i] !== undefined ? p2.numbers[i] : 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // Same numeric version: a version with a prerelease is lower than a release without one
  // e.g. 1.0.0-beta < 1.0.0
  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

/**
 * Evaluates client version status against backend version policies.
 * 
 * @param {Object} params
 * @param {string} params.currentVersion - Client's current version
 * @param {string} params.latestVersion - Latest version on official store
 * @param {string} params.minimumSupportedVersion - Floor version required for server access
 * @param {boolean} [params.forceUpdateFlag] - Server-level forced update override flag
 * @returns {{
 *   updateAvailable: boolean,
 *   forceUpdate: boolean,
 *   updateType: 'none' | 'flexible' | 'immediate',
 *   isBelowMinimum: boolean,
 *   isBelowLatest: boolean
 * }}
 */
function evaluateUpdate({
  currentVersion,
  latestVersion = "1.0.0",
  minimumSupportedVersion = "1.0.0",
  forceUpdateFlag = false,
}) {
  if (!currentVersion || !isValidVersion(currentVersion)) {
    return {
      updateAvailable: false,
      forceUpdate: false,
      updateType: "none",
      isBelowMinimum: false,
      isBelowLatest: false,
    };
  }

  const isBelowMinimum = compareVersions(currentVersion, minimumSupportedVersion) < 0;
  const isBelowLatest = compareVersions(currentVersion, latestVersion) < 0;

  // Force update if client is below minimum supported version, or if backend has forceUpdate enabled and client is behind latest
  const forceUpdate = isBelowMinimum || (Boolean(forceUpdateFlag) && isBelowLatest);
  const updateAvailable = isBelowLatest;

  let updateType = "none";
  if (forceUpdate) {
    updateType = "immediate";
  } else if (updateAvailable) {
    updateType = "flexible";
  }

  return {
    updateAvailable,
    forceUpdate,
    updateType,
    isBelowMinimum,
    isBelowLatest,
  };
}

module.exports = {
  isValidVersion,
  compareVersions,
  evaluateUpdate,
};
