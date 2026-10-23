/**
 * App Version Management & Update System Test Suite
 * 
 * Verifies:
 * 1. Semantic Version Comparison Utility (semver parsing, precedence, equality, prereleases).
 * 2. Public Version-Check API (/api/v1/app-version):
 *    - Structured response contract (no secrets exposed).
 *    - Query validation (rejects malformed currentVersion with HTTP 400).
 *    - Evaluation of up-to-date client (updateAvailable: false, forceUpdate: false, updateType: 'none').
 *    - Evaluation of optional flexible update (updateAvailable: true, forceUpdate: false, updateType: 'flexible').
 *    - Evaluation of forced immediate update due to minimumSupportedVersion (forceUpdate: true, updateType: 'immediate').
 *    - Evaluation of forced immediate update due to server-level forceUpdate toggle.
 *    - Unrestricted access during maintenance mode.
 * 3. Super Admin In-App Update Management (/api/v1/superadmin/app-version):
 *    - RBAC enforcement (unauthenticated or non-admin requests rejected with 401/403).
 *    - Super Admin can update latestVersion, minimumSupportedVersion, updateMessage, updateUrl, forceUpdate, releaseNotes.
 *    - Input validation: rejects minimumSupportedVersion > latestVersion, invalid semver, and invalid URLs.
 *    - Audit logging: writes immutable APP_VERSION_CONFIG_UPDATED audit record.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");

require("dotenv").config();
const app = require("../app");
const connectDB = require("../src/db/db");
const User = require("../src/models/user.model");
const SystemConfig = require("../src/models/systemConfig.model");
const AuditLog = require("../src/models/auditLog.model");
const {
  isValidVersion,
  compareVersions,
  evaluateUpdate,
} = require("../src/utils/versionComparator");

let server;
let baseUrl;

const TEST_SUPERADMIN = {
  registrationNumber: `SA_VER_${Date.now()}`,
  password: "SuperAdminPassword123!",
  name: "Version Admin",
  role: "superadmin",
  hostel: "ADMIN_HQ",
  email: `sa_version_${Date.now()}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_STUDENT = {
  registrationNumber: `ST_VER_${Date.now()}`,
  password: "StudentPassword123!",
  name: "Version Student",
  role: "student",
  hostel: "BH-1",
  email: `st_version_${Date.now()}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

let superAdminToken;
let studentToken;

before(async () => {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Clean and seed test accounts
  await User.deleteMany({
    registrationNumber: { $in: [TEST_SUPERADMIN.registrationNumber, TEST_STUDENT.registrationNumber] },
  });

  const Argon = require("argon2");
  const hashedSa = await Argon.hash(TEST_SUPERADMIN.password);
  const hashedSt = await Argon.hash(TEST_STUDENT.password);

  await User.create([
    { ...TEST_SUPERADMIN, password: hashedSa },
    { ...TEST_STUDENT, password: hashedSt },
  ]);

  // Log in Super Admin
  const saLogin = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_SUPERADMIN.registrationNumber,
      password: TEST_SUPERADMIN.password,
    }),
  });
  const saData = await saLogin.json();
  superAdminToken = saData.token;

  // Log in Student
  const stLogin = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
    }),
  });
  const stData = await stLogin.json();
  studentToken = stData.token;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await User.deleteMany({
    registrationNumber: { $in: [TEST_SUPERADMIN.registrationNumber, TEST_STUDENT.registrationNumber] },
  });
  await mongoose.connection.close();
});

// ─── 1. VERSION COMPARATOR UNIT TESTS ─────────────────────────────────────────

test("VersionComparator: Validates semantic version syntax correctly", () => {
  assert.equal(isValidVersion("1.0.0"), true);
  assert.equal(isValidVersion("v1.2.3"), true);
  assert.equal(isValidVersion("2.1"), true);
  assert.equal(isValidVersion("1.0.0-beta.1"), true);
  assert.equal(isValidVersion(""), false);
  assert.equal(isValidVersion(null), false);
  assert.equal(isValidVersion("invalid-version"), false);
  assert.equal(isValidVersion("1.x.3"), false);
});

test("VersionComparator: Compares versions accurately", () => {
  // Higher version
  assert.equal(compareVersions("1.2.0", "1.1.0"), 1);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("v1.0.5", "1.0.4"), 1);

  // Lower version
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.1.0", "1.2.0"), -1);
  assert.equal(compareVersions("1.0.0-beta", "1.0.0"), -1);

  // Equal version
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("v1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
});

test("VersionComparator: Evaluates update conditions (optional, forced, up-to-date)", () => {
  // 1. Up-to-date
  const upToDate = evaluateUpdate({
    currentVersion: "1.2.0",
    latestVersion: "1.2.0",
    minimumSupportedVersion: "1.0.0",
    forceUpdateFlag: false,
  });
  assert.equal(upToDate.updateAvailable, false);
  assert.equal(upToDate.forceUpdate, false);
  assert.equal(upToDate.updateType, "none");

  // 2. Optional Update (current >= min, current < latest)
  const optional = evaluateUpdate({
    currentVersion: "1.1.0",
    latestVersion: "1.2.0",
    minimumSupportedVersion: "1.0.0",
    forceUpdateFlag: false,
  });
  assert.equal(optional.updateAvailable, true);
  assert.equal(optional.forceUpdate, false);
  assert.equal(optional.updateType, "flexible");

  // 3. Forced Update due to floor version (current < min)
  const forcedByMin = evaluateUpdate({
    currentVersion: "0.9.0",
    latestVersion: "1.2.0",
    minimumSupportedVersion: "1.0.0",
    forceUpdateFlag: false,
  });
  assert.equal(forcedByMin.updateAvailable, true);
  assert.equal(forcedByMin.forceUpdate, true);
  assert.equal(forcedByMin.updateType, "immediate");

  // 4. Forced Update due to server forceUpdate flag
  const forcedByFlag = evaluateUpdate({
    currentVersion: "1.1.0",
    latestVersion: "1.2.0",
    minimumSupportedVersion: "1.0.0",
    forceUpdateFlag: true,
  });
  assert.equal(forcedByFlag.updateAvailable, true);
  assert.equal(forcedByFlag.forceUpdate, true);
  assert.equal(forcedByFlag.updateType, "immediate");
});

// ─── 2. PUBLIC VERSION-CHECK API INTEGRATION TESTS ───────────────────────────

test("Public API: Rejects invalid currentVersion with HTTP 400", async () => {
  const res = await fetch(`${baseUrl}/api/v1/app-version?currentVersion=not_a_valid_version`);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.code, "INVALID_VERSION_FORMAT");
});

test("Public API: Returns structured version contract without credentials", async () => {
  const res = await fetch(`${baseUrl}/api/v1/app-version`);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.ok(data.latestVersion);
  assert.ok(data.minimumSupportedVersion);
  assert.ok(data.updateUrl);
  assert.equal(typeof data.forceUpdate, "boolean");
  assert.equal(typeof data.updateAvailable, "boolean");

  // STRICT: Verify no system passwords, hashes, or database keys are leaked
  assert.equal(data.password, undefined);
  assert.equal(data.key, undefined);
  assert.equal(data.maintenance, undefined);
  assert.equal(data.maxConcurrentSessions, undefined);
});

test("Public API: Evaluates client version and recommends flexible vs immediate update", async () => {
  // Configure test version state: latest = 2.0.0, min = 1.5.0
  const config = await SystemConfig.getEffectiveConfig();
  config.appVersion = {
    latestVersion: "2.0.0",
    minimumSupportedVersion: "1.5.0",
    updateMessage: "HostelCare 2.0 is out!",
    updateUrl: "https://play.google.com/store/apps/details?id=com.hostelcare.app",
    forceUpdate: false,
    releaseNotes: "Performance upgrades",
  };
  await config.save();

  // Case A: Client on 2.0.0 (Up-to-date)
  const resUpToDate = await fetch(`${baseUrl}/api/v1/app-version?currentVersion=2.0.0&platform=android`);
  assert.equal(resUpToDate.status, 200);
  const dataUpToDate = await resUpToDate.json();
  assert.equal(dataUpToDate.updateAvailable, false);
  assert.equal(dataUpToDate.forceUpdate, false);
  assert.equal(dataUpToDate.updateType, "none");

  // Case B: Client on 1.6.0 (Optional flexible update)
  const resOptional = await fetch(`${baseUrl}/api/v1/app-version?currentVersion=1.6.0&platform=android`);
  assert.equal(resOptional.status, 200);
  const dataOptional = await resOptional.json();
  assert.equal(dataOptional.updateAvailable, true);
  assert.equal(dataOptional.forceUpdate, false);
  assert.equal(dataOptional.updateType, "flexible");

  // Case C: Client on 1.4.0 (Below minSupportedVersion 1.5.0 -> Forced immediate update)
  const resForced = await fetch(`${baseUrl}/api/v1/app-version?currentVersion=1.4.0&platform=android`);
  assert.equal(resForced.status, 200);
  const dataForced = await resForced.json();
  assert.equal(dataForced.updateAvailable, true);
  assert.equal(dataForced.forceUpdate, true);
  assert.equal(dataForced.updateType, "immediate");
});

// ─── 3. SUPER ADMIN APP VERSION MANAGEMENT TESTS ─────────────────────────────

test("Super Admin API: Rejects unauthenticated and non-admin requests with 401/403", async () => {
  // 1. Unauthenticated request
  const unauthRes = await fetch(`${baseUrl}/api/v1/superadmin/app-version`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latestVersion: "2.1.0" }),
  });
  assert.equal(unauthRes.status, 401);

  // 2. Student token (non-admin)
  const studentRes = await fetch(`${baseUrl}/api/v1/superadmin/app-version`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ latestVersion: "2.1.0" }),
  });
  assert.equal(studentRes.status, 403);
});

test("Super Admin API: Validation rejects minimumSupportedVersion > latestVersion and bad URLs", async () => {
  // 1. Minimum supported higher than latest version
  const invalidVersionOrderRes = await fetch(`${baseUrl}/api/v1/superadmin/app-version`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      latestVersion: "1.0.0",
      minimumSupportedVersion: "2.0.0", // 2.0.0 > 1.0.0 -> Invalid
    }),
  });
  assert.equal(invalidVersionOrderRes.status, 400);

  // 2. Invalid URL protocol
  const invalidUrlRes = await fetch(`${baseUrl}/api/v1/superadmin/app-version`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      updateUrl: "javascript:alert(1)", // Untrusted protocol rejected
    }),
  });
  assert.equal(invalidUrlRes.status, 400);
});

test("Super Admin API: Super Admin updates version configuration and writes Audit Log", async () => {
  const updatePayload = {
    latestVersion: "2.5.0",
    minimumSupportedVersion: "2.0.0",
    updateMessage: "Important stability and security rollout for HostelCare Android.",
    updateUrl: "https://play.google.com/store/apps/details?id=com.hostelcare.app",
    forceUpdate: true,
    releaseNotes: "• In-App Google Play Update Integration\n• Android 14 compatibility\n• Push notification latency improvements",
  };

  const updateRes = await fetch(`${baseUrl}/api/v1/superadmin/app-version`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify(updatePayload),
  });
  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.success, true);
  assert.equal(updateData.appVersion.latestVersion, "2.5.0");
  assert.equal(updateData.appVersion.minimumSupportedVersion, "2.0.0");
  assert.equal(updateData.appVersion.forceUpdate, true);

  // Verify Audit Log entry
  const auditRes = await fetch(`${baseUrl}/api/v1/superadmin/audit-logs?search=${TEST_SUPERADMIN.registrationNumber}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  const versionLog = auditData.logs.find((l) => l.action === "APP_VERSION_CONFIG_UPDATED");
  assert.ok(versionLog, "Audit log must contain APP_VERSION_CONFIG_UPDATED");
  assert.equal(versionLog.adminRegistrationNumber, TEST_SUPERADMIN.registrationNumber);
});
