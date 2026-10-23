import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidVersion,
  compareVersions,
  evaluateUpdate,
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
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
});

test('Frontend VersionComparator: Optional vs Forced Update Logic', () => {
  // Case 1: Up-to-date
  const current = evaluateUpdate({
    currentVersion: '2.0.0',
    latestVersion: '2.0.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: false,
  });
  assert.equal(current.updateAvailable, false);
  assert.equal(current.forceUpdate, false);
  assert.equal(current.updateType, 'none');

  // Case 2: Optional update (Flexible)
  const optional = evaluateUpdate({
    currentVersion: '1.5.0',
    latestVersion: '2.0.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: false,
  });
  assert.equal(optional.updateAvailable, true);
  assert.equal(optional.forceUpdate, false);
  assert.equal(optional.updateType, 'flexible');

  // Case 3: Forced update by minimum supported floor
  const forcedByFloor = evaluateUpdate({
    currentVersion: '0.9.0',
    latestVersion: '2.0.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: false,
  });
  assert.equal(forcedByFloor.updateAvailable, true);
  assert.equal(forcedByFloor.forceUpdate, true);
  assert.equal(forcedByFloor.updateType, 'immediate');

  // Case 4: Forced update by server-side flag
  const forcedByFlag = evaluateUpdate({
    currentVersion: '1.5.0',
    latestVersion: '2.0.0',
    minimumSupportedVersion: '1.0.0',
    forceUpdateFlag: true,
  });
  assert.equal(forcedByFlag.updateAvailable, true);
  assert.equal(forcedByFlag.forceUpdate, true);
  assert.equal(forcedByFlag.updateType, 'immediate');

  // Case 5: Invalid current version safely returns no update
  const invalid = evaluateUpdate({
    currentVersion: 'invalid',
    latestVersion: '2.0.0',
    minimumSupportedVersion: '1.0.0',
  });
  assert.equal(invalid.updateAvailable, false);
  assert.equal(invalid.forceUpdate, false);
  assert.equal(invalid.updateType, 'none');
});
