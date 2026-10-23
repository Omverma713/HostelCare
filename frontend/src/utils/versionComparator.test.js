import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidVersion,
  compareVersions,
  evaluateUpdate,
  isValidDirectApkUrl,
} from './versionComparator.js';

test('Frontend VersionComparator: Syntax Validation', () => {
  assert.equal(isValidVersion('1.0.0'), true);
  assert.equal(isValidVersion('v2.1.0'), true);
  assert.equal(isValidVersion('3.0'), true);
  assert.equal(isValidVersion('1.0.0-rc.1'), true);
  assert.equal(isValidVersion(''), false);
  assert.equal(isValidVersion(null), false);
  assert.equal(isValidVersion(undefined), false);
  assert.equal(isValidVersion('invalid.text'), false);
});

test('Frontend VersionComparator: Version Ordering & Equality', () => {
  // Newer versions
  assert.equal(compareVersions('1.1.0', '1.0.0'), 1);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1);
  assert.equal(compareVersions('v2.0.1', '2.0.0'), 1);

  // Older versions
  assert.equal(compareVersions('1.0.0', '1.1.0'), -1);
  assert.equal(compareVersions('0.9.0', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0-beta', '1.0.0'), -1);

  // Equal versions
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.1.0', '1.1.0'), 0);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
});

test('Frontend VersionComparator: Sideloaded Direct APK URL Validation', () => {
  // Valid direct HTTPS APK URLs
  assert.equal(
    isValidDirectApkUrl('https://github.com/Omverma713/HostelCare/releases/download/v1.1.0/hostelcare.apk'),
    true
  );
  assert.equal(
    isValidDirectApkUrl('https://hostelcare.s3.ap-south-1.amazonaws.com/builds/app-v1.1.0.apk'),
    true
  );

  // Invalid / placeholder URLs
  assert.equal(isValidDirectApkUrl(''), false);
  assert.equal(isValidDirectApkUrl(null), false);
  assert.equal(isValidDirectApkUrl(undefined), false);
  assert.equal(isValidDirectApkUrl('http://insecure-download.com/app.apk'), false); // Must be HTTPS
  assert.equal(
    isValidDirectApkUrl('https://play.google.com/store/apps/details?id=com.hostelcare.app'),
    false // Google Play placeholder rejected for sideloaded direct APK
  );
  assert.equal(isValidDirectApkUrl('https://example.com/app.apk'), false);
  assert.equal(isValidDirectApkUrl('https://'), false);
});

test('Frontend VersionComparator: Sideloaded Optional Update Workflow Evaluation', () => {
  // Case 1: Installed equals latest version (Up-to-date)
  const upToDate = evaluateUpdate({
    currentVersion: '1.1.0',
    latestVersion: '1.1.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: false,
  });
  assert.equal(upToDate.updateAvailable, false);
  assert.equal(upToDate.forceUpdate, false);
  assert.equal(upToDate.updateType, 'none');

  // Case 2: Installed version is newer than latest (Local developer build)
  const devAhead = evaluateUpdate({
    currentVersion: '1.2.0',
    latestVersion: '1.1.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: false,
  });
  assert.equal(devAhead.updateAvailable, false);
  assert.equal(devAhead.forceUpdate, false);
  assert.equal(devAhead.updateType, 'none');

  // Case 3: Newer version available (Optional / Flexible update)
  const updateAvailable = evaluateUpdate({
    currentVersion: '1.0.0',
    latestVersion: '1.1.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: false,
  });
  assert.equal(updateAvailable.updateAvailable, true);
  assert.equal(updateAvailable.forceUpdate, false); // Crucial: must be false for optional workflow
  assert.equal(updateAvailable.updateType, 'flexible');
});
