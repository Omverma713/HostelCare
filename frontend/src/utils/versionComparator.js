/**
 * Semver and App Version Comparison Utilities (Frontend)
 */

export function isValidVersion(version) {
  if (typeof version !== 'string') return false;
  const clean = version.trim().replace(/^v/i, '');
  if (!clean) return false;
  const semverRegex = /^\d+(\.\d+)*(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
  return semverRegex.test(clean);
}

export function parseVersion(version) {
  const clean = String(version || '').trim().replace(/^v/i, '');
  const [mainPart, ...rest] = clean.split('-');
  const prerelease = rest.length > 0 ? rest.join('-') : null;

  const numbers = mainPart
    .split('.')
    .map((seg) => {
      const num = parseInt(seg, 10);
      return Number.isNaN(num) ? 0 : num;
    });

  while (numbers.length < 3) {
    numbers.push(0);
  }

  return { numbers, prerelease };
}

export function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  const maxLen = Math.max(p1.numbers.length, p2.numbers.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1.numbers[i] !== undefined ? p1.numbers[i] : 0;
    const num2 = p2.numbers[i] !== undefined ? p2.numbers[i] : 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

export function evaluateUpdate({
  currentVersion,
  latestVersion = '1.0.0',
  minimumSupportedVersion = '1.0.0',
  forceUpdateFlag = false,
}) {
  if (!currentVersion || !isValidVersion(currentVersion)) {
    return {
      updateAvailable: false,
      forceUpdate: false,
      updateType: 'none',
      isBelowMinimum: false,
      isBelowLatest: false,
    };
  }

  const isBelowMinimum = compareVersions(currentVersion, minimumSupportedVersion) < 0;
  const isBelowLatest = compareVersions(currentVersion, latestVersion) < 0;

  const forceUpdate = isBelowMinimum || (Boolean(forceUpdateFlag) && isBelowLatest);
  const updateAvailable = isBelowLatest;

  let updateType = 'none';
  if (forceUpdate) {
    updateType = 'immediate';
  } else if (updateAvailable) {
    updateType = 'flexible';
  }

  return {
    updateAvailable,
    forceUpdate,
    updateType,
    isBelowMinimum,
    isBelowLatest,
  };
}

/**
 * Validates whether an update URL is a valid, direct HTTPS download link for sideloaded distribution.
 * Rejects non-HTTPS links, empty URLs, and placeholder Google Play links.
 */
export function isValidDirectApkUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;
  if (
    trimmed.includes('play.google.com') ||
    trimmed.includes('example.com') ||
    trimmed === 'https://'
  ) {
    return false;
  }
  return true;
}
