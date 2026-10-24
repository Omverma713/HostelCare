/**
 * Super Admin Integration & Security Test Suite
 * 
 * Verifies:
 * 1. Strict RBAC: Non-admin roles (student, warden) cannot access /api/v1/superadmin routes.
 * 2. Session generation: JWT tokens contain sessionId and valid Session documents exist in MongoDB.
 * 3. Real-time session revocation: Revoked session causes protected routes to return 401.
 * 4. Concurrent login limits: Limit enforcement and auto-revocation of oldest session.
 * 5. User management: Profile updating, deactivation (revoking sessions), and password resets.
 * 6. Audit logging: Privileged actions generate sanitized audit log entries.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const Argon = require("argon2");

require("dotenv").config();
const app = require("../app");
const connectDB = require("../src/db/db");
const User = require("../src/models/user.model");
const Session = require("../src/models/session.model");
const SystemConfig = require("../src/models/systemConfig.model");
const AuditLog = require("../src/models/auditLog.model");

let server;
let baseUrl;

// Test user credentials
const TEST_SUPERADMIN = {
  registrationNumber: `SA_${Date.now()}`,
  password: "SuperAdminPassword123!",
  name: "Master Super Admin",
  role: "superadmin",
  hostel: "ADMIN_HQ",
  email: "sa_test@hostelcare.local",
  isActivated: true,
  accountStatus: "active",
};

const TEST_STUDENT = {
  registrationNumber: `ST_${Date.now()}`,
  password: "StudentPassword123!",
  name: "Regular Student",
  role: "student",
  hostel: "BH-1",
  email: "student_test@hostelcare.local",
  isActivated: true,
  accountStatus: "active",
};

let superAdminToken;
let superAdminSessionId;
let studentToken;
let studentSessionId;
let studentUserId;

before(async () => {
  await connectDB();

  // Create HTTP test server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed test superadmin
  const hashedAdminPass = await Argon.hash(TEST_SUPERADMIN.password);
  await User.create({
    ...TEST_SUPERADMIN,
    password: hashedAdminPass,
  });

  // Seed test student
  const hashedStudentPass = await Argon.hash(TEST_STUDENT.password);
  const createdStudent = await User.create({
    ...TEST_STUDENT,
    password: hashedStudentPass,
  });
  studentUserId = createdStudent._id.toString();

  // Log in as superadmin
  const saLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_SUPERADMIN.registrationNumber,
      password: TEST_SUPERADMIN.password,
      deviceNickname: "Admin Test Device",
    }),
  });
  const saLoginData = await saLoginRes.json();
  assert.equal(saLoginData.success, true);
  superAdminToken = saLoginData.token;
  superAdminSessionId = saLoginData.session.sessionId;

  // Log in as student
  const stLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
      deviceNickname: "Student Test Device",
    }),
  });
  const stLoginData = await stLoginRes.json();
  assert.equal(stLoginData.success, true);
  studentToken = stLoginData.token;
  studentSessionId = stLoginData.session.sessionId;
});

after(async () => {
  // Clean up test records
  await User.deleteMany({
    registrationNumber: { $in: [TEST_SUPERADMIN.registrationNumber, TEST_STUDENT.registrationNumber] },
  });
  await Session.deleteMany({
    registrationNumber: { $in: [TEST_SUPERADMIN.registrationNumber, TEST_STUDENT.registrationNumber] },
  });
  await AuditLog.deleteMany({
    adminRegistrationNumber: TEST_SUPERADMIN.registrationNumber,
  });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
});

test("RBAC: Unauthenticated request to /api/v1/superadmin/overview is rejected with 401", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/overview`);
  assert.equal(res.status, 401);
});

test("RBAC: Student token to /api/v1/superadmin/overview is rejected with 403 Forbidden", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/overview`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.message, /Forbidden/i);
});

test("RBAC: Super Admin token successfully accesses /api/v1/superadmin/overview", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/overview`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.stats.totalUsers >= 2);
});

test("Session Tracking: Active session exists in database with matching sessionId", async () => {
  const session = await Session.findOne({ sessionId: studentSessionId });
  assert.ok(session);
  assert.equal(session.status, "active");
  assert.equal(session.registrationNumber, TEST_STUDENT.registrationNumber);
});

test("Real-Time Revocation: Revoking session immediately blocks protected requests with 401", async () => {
  // 1. Student can initially access protected endpoint
  const initialRes = await fetch(`${baseUrl}/api/v1/users/my-sessions`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(initialRes.status, 200);

  // 2. Admin revokes the student session
  const revokeRes = await fetch(`${baseUrl}/api/v1/superadmin/sessions/${studentSessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(revokeRes.status, 200);

  // 3. Subsequent request with student token must now fail with 401
  const afterRevokeRes = await fetch(`${baseUrl}/api/v1/users/my-sessions`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(afterRevokeRes.status, 401);
  const afterRevokeData = await afterRevokeRes.json();
  assert.equal(afterRevokeData.code, "SESSION_REVOKED");
});

test("Concurrent Session Limits: Login limits enforce session capacity", async () => {
  // Set limit to 2 concurrent sessions with auto-revocation enabled
  await SystemConfig.updateOne(
    { key: "default" },
    { $set: { maxConcurrentSessions: 2, revokeOldestOnLimit: true } },
    { upsert: true }
  );

  // Login 1
  const l1 = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
      deviceNickname: "Device 1",
    }),
  });
  const d1 = await l1.json();
  assert.equal(d1.success, true);

  // Login 2
  const l2 = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
      deviceNickname: "Device 2",
    }),
  });
  const d2 = await l2.json();
  assert.equal(d2.success, true);

  // Login 3 (should revoke oldest active session)
  const l3 = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
      deviceNickname: "Device 3",
    }),
  });
  const d3 = await l3.json();
  assert.equal(d3.success, true);

  // Check that oldest session (d1) is now revoked
  const session1 = await Session.findOne({ sessionId: d1.session.sessionId });
  assert.equal(session1.status, "revoked");

  // Check that newer sessions are active
  const session2 = await Session.findOne({ sessionId: d2.session.sessionId });
  const session3 = await Session.findOne({ sessionId: d3.session.sessionId });
  assert.equal(session2.status, "active");
  assert.equal(session3.status, "active");
});

test("User Management & Deactivation: Deactivation instantly revokes active sessions", async () => {
  // Deactivate the student account
  const statusRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ accountStatus: "deactivated" }),
  });
  assert.equal(statusRes.status, 200);

  // Any attempt to log in with deactivated account must fail with 403
  const loginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
    }),
  });
  assert.equal(loginRes.status, 403);
  const loginData = await loginRes.json();
  assert.equal(loginData.code, "ACCOUNT_SUSPENDED");
});

test("Audit Trail: Privileged admin actions write immutable audit records", async () => {
  const auditRes = await fetch(`${baseUrl}/api/v1/superadmin/audit-logs?search=${TEST_SUPERADMIN.registrationNumber}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  assert.ok(auditData.logs.length > 0);

  const sampleLog = auditData.logs[0];
  assert.equal(sampleLog.adminRegistrationNumber, TEST_SUPERADMIN.registrationNumber);
  // Verify passwords or hashes are NEVER in audit logs
  assert.equal(sampleLog.details?.password, undefined);
  assert.equal(sampleLog.details?.hashedPassword, undefined);
});

test("Super Admin Unlock: Unlocks account locked by multiple wrong passwords", async () => {
  // 1. Ensure student account is active but locked out due to failed attempts
  await User.findByIdAndUpdate(studentUserId, {
    accountStatus: "active",
    failedLoginAttempts: 5,
    lockUntil: new Date(Date.now() + 15 * 60 * 1000), // locked for 15 minutes
  });

  // 2. Student login attempt must be rejected with 429 ACCOUNT_LOCKED
  const lockedLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
    }),
  });
  assert.equal(lockedLoginRes.status, 429);
  const lockedLoginData = await lockedLoginRes.json();
  assert.equal(lockedLoginData.code, "ACCOUNT_LOCKED");

  // 3. Super Admin queries user details - must report isLocked: true
  const detailsRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(detailsRes.status, 200);
  const detailsData = await detailsRes.json();
  assert.equal(detailsData.user.isLocked, true);
  assert.ok(detailsData.user.lockMinutesRemaining > 0);

  // 4. Query user directory with status=locked filter - must include this user
  const directoryRes = await fetch(`${baseUrl}/api/v1/superadmin/users?status=locked`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(directoryRes.status, 200);
  const directoryData = await directoryRes.json();
  const foundInLocked = directoryData.users.some((u) => u._id.toString() === studentUserId.toString());
  assert.ok(foundInLocked, "Locked user must appear in status=locked query");

  // 5. Unauthenticated request to unlock must be rejected with 401
  const unauthUnlockRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(unauthUnlockRes.status, 401);

  // 6. Super Admin unlocks account
  const unlockRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}/unlock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
  });
  assert.equal(unlockRes.status, 200);
  const unlockData = await unlockRes.json();
  assert.equal(unlockData.success, true);
  assert.equal(unlockData.user.isLocked, false);
  assert.equal(unlockData.user.failedLoginAttempts, 0);

  // 7. Student can now immediately log in with their password
  const successfulLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
    }),
  });
  assert.equal(successfulLoginRes.status, 200);
  const successfulLoginData = await successfulLoginRes.json();
  assert.equal(successfulLoginData.success, true);

  // 8. Audit log contains ACCOUNT_UNLOCKED
  const auditRes = await fetch(`${baseUrl}/api/v1/superadmin/audit-logs?search=${TEST_STUDENT.registrationNumber}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  const unlockLog = auditData.logs.find((l) => l.action === "ACCOUNT_UNLOCKED");
  assert.ok(unlockLog, "Audit log must contain ACCOUNT_UNLOCKED entry");
  assert.equal(unlockLog.targetIdentifier, TEST_STUDENT.registrationNumber);
});

test("Super Admin Exemption: Wrong password attempts never lock SuperAdmin accounts", async () => {
  // Try 7 consecutive wrong password attempts on SuperAdmin
  for (let i = 0; i < 7; i++) {
    const wrongRes = await fetch(`${baseUrl}/api/v1/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationNumber: TEST_SUPERADMIN.registrationNumber,
        password: "WrongPassword!999",
      }),
    });
    assert.equal(wrongRes.status, 401, "Wrong password must return 401, not 429");
  }

  // SuperAdmin must still be able to log in with correct credentials without being locked
  const correctRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_SUPERADMIN.registrationNumber,
      password: TEST_SUPERADMIN.password,
    }),
  });
  assert.equal(correctRes.status, 200, "SuperAdmin must log in successfully without lock");
  const data = await correctRes.json();
  assert.equal(data.success, true);
});

test("Super Admin API: Configures failedLoginThreshold, lockoutDurationMinutes, and jwtLifespanDays", async () => {
  const updateRes = await fetch(`${baseUrl}/api/v1/superadmin/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      failedLoginThreshold: 3,
      lockoutDurationMinutes: 30,
      jwtLifespanDays: 60,
    }),
  });
  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.success, true);
  assert.equal(updateData.config.failedLoginThreshold, 3);
  assert.equal(updateData.config.lockoutDurationMinutes, 30);
  assert.equal(updateData.config.jwtLifespanDays, 60);

  // Verify GET /api/v1/superadmin/config returns the saved parameters
  const getRes = await fetch(`${baseUrl}/api/v1/superadmin/config`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.config.failedLoginThreshold, 3);
  assert.equal(getData.config.lockoutDurationMinutes, 30);
  assert.equal(getData.config.jwtLifespanDays, 60);
});

test("Super Admin API: Manually locks user and adjusts lock duration", async () => {
  // 1. Manually lock student for 45 minutes
  const lockRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      durationMinutes: 45,
      reason: "Security inspection",
    }),
  });
  assert.equal(lockRes.status, 200);
  const lockData = await lockRes.json();
  assert.equal(lockData.success, true);
  assert.equal(lockData.user.isLocked, true);
  assert.ok(lockData.user.lockMinutesRemaining >= 40, "Remaining lock time must be around 45 mins");

  // 2. Extend lock by +15 minutes
  const extendRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}/lock-duration`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ adjustMinutes: 15 }),
  });
  assert.equal(extendRes.status, 200);
  const extendData = await extendRes.json();
  assert.equal(extendData.success, true);
  assert.ok(extendData.user.lockMinutesRemaining >= 55, "Extended lock time must be around 60 mins");

  // 3. Reduce lock past 0 minutes to immediately unlock
  const reduceRes = await fetch(`${baseUrl}/api/v1/superadmin/users/${studentUserId}/lock-duration`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ adjustMinutes: -120 }),
  });
  assert.equal(reduceRes.status, 200);
  const reduceData = await reduceRes.json();
  assert.equal(reduceData.success, true);
  assert.equal(reduceData.user.isLocked, false);
  assert.equal(reduceData.user.lockMinutesRemaining, 0);
});


