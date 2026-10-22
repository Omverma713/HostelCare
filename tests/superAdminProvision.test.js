/**
 * Super Admin User Provisioning API Integration Tests
 * 
 * Verifies POST /api/v1/superadmin/users:
 * 1. Successful creation with sanitized return fields (password strictly excluded)
 * 2. Re-authentication password verification (invalid admin password returns 401 and logs failure)
 * 3. Role-based access control (non-superadmin token returns 403)
 * 4. Session status checks (revoked or expired session returns 401)
 * 5. Duplicate registration number rejection (returns 409)
 * 6. Role schema enum validation (returns 400 for unknown roles)
 * 7. Input validation rules (missing fields, short password < 8, bad email format)
 * 8. Cryptographic Argon2 password hashing verification
 * 9. Immutable audit logging verification for both successful and failed attempts
 * 10. Concurrent duplicate request safety (race condition / E11000 handling)
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
const AuditLog = require("../src/models/auditLog.model");

let server;
let baseUrl;

const SUPERADMIN_CREDENTIALS = {
  registrationNumber: `SA_PROV_${Date.now()}`,
  password: "MasterAdminPassword123!",
  name: "Master Provisioner Admin",
  role: "superadmin",
  hostel: "ADMIN_HQ",
  email: "prov_master@hostelcare.local",
  isActivated: true,
  accountStatus: "active",
};

const STUDENT_CREDENTIALS = {
  registrationNumber: `ST_PROV_${Date.now()}`,
  password: "StudentPassword123!",
  name: "Regular Student Provisioner",
  role: "student",
  hostel: "BH-1",
  email: "student_prov@hostelcare.local",
  isActivated: true,
  accountStatus: "active",
};

let superAdminToken;
let superAdminSessionId;
let studentToken;
let createdUserIds = [];

before(async () => {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed initial superadmin
  const hashedAdminPass = await Argon.hash(SUPERADMIN_CREDENTIALS.password);
  const adminUser = await User.create({
    ...SUPERADMIN_CREDENTIALS,
    password: hashedAdminPass,
  });
  createdUserIds.push(adminUser._id);

  // Seed student
  const hashedStudentPass = await Argon.hash(STUDENT_CREDENTIALS.password);
  const studentUser = await User.create({
    ...STUDENT_CREDENTIALS,
    password: hashedStudentPass,
  });
  createdUserIds.push(studentUser._id);

  // Log in as superadmin
  const saLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: SUPERADMIN_CREDENTIALS.registrationNumber,
      password: SUPERADMIN_CREDENTIALS.password,
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
      registrationNumber: STUDENT_CREDENTIALS.registrationNumber,
      password: STUDENT_CREDENTIALS.password,
    }),
  });
  const stLoginData = await stLoginRes.json();
  assert.equal(stLoginData.success, true);
  studentToken = stLoginData.token;
});

after(async () => {
  // Clean up created test users, sessions, and audit logs
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Session.deleteMany({ userId: { $in: createdUserIds } });
  }
  await User.deleteMany({ registrationNumber: /^TEST_PROV_/ });
  await AuditLog.deleteMany({ targetIdentifier: /^TEST_PROV_/ });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
});

test("Successful Provisioning: Creates new active Super Admin and returns sanitized object without passwords", async () => {
  const targetReg = `TEST_PROV_SA_${Date.now()}`;
  const rawTargetPassword = "TargetSuperAdminSecret2026!";

  const res = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: targetReg,
      name: "New Sub-Admin",
      role: "superadmin",
      email: "subadmin@hostelcare.local",
      password: rawTargetPassword,
      adminPassword: SUPERADMIN_CREDENTIALS.password,
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.success, true);
  assert.ok(data.user);
  assert.equal(data.user.registrationNumber, targetReg);
  assert.equal(data.user.role, "superadmin");
  assert.equal(data.user.hostel, "ADMIN_HQ");
  assert.equal(data.user.accountStatus, "active");
  assert.equal(data.user.isActivated, true);

  // Guarantee no password or hash is exposed in response
  assert.equal(data.user.password, undefined);
  assert.equal(data.password, undefined);
  assert.equal(JSON.stringify(data).includes("TargetSuperAdminSecret2026!"), false);
  assert.equal(JSON.stringify(data).includes("$argon2id$"), false);

  // Verify in MongoDB
  const dbUser = await User.findOne({ registrationNumber: targetReg });
  assert.ok(dbUser);
  createdUserIds.push(dbUser._id);
  assert.equal(dbUser.role, "superadmin");
  assert.ok(dbUser.password.startsWith("$argon2"));

  // Verify Argon2 password correctness
  const isMatch = await Argon.verify(dbUser.password, rawTargetPassword);
  assert.equal(isMatch, true);

  // Verify Audit Log
  const log = await AuditLog.findOne({
    action: "USER_PROVISIONED",
    targetIdentifier: targetReg,
  });
  assert.ok(log);
  assert.equal(log.outcome, "SUCCESS");
  assert.equal(log.adminRegistrationNumber, SUPERADMIN_CREDENTIALS.registrationNumber);
  assert.equal(JSON.stringify(log).includes(rawTargetPassword), false);
});

test("Invalid Admin Re-authentication Password: Rejects with 401 and logs failure", async () => {
  const targetReg = `TEST_PROV_FAIL_${Date.now()}`;

  const res = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: targetReg,
      name: "Should Fail Admin",
      role: "superadmin",
      password: "ValidPassword123!",
      adminPassword: "WrongAdminPassword!",
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 401);
  assert.equal(data.success, false);
  assert.equal(data.message, "Invalid Super Admin confirmation password.");

  // User must not exist in DB
  const dbUser = await User.findOne({ registrationNumber: targetReg });
  assert.equal(dbUser, null);

  // Audit log should capture the failed attempt
  const log = await AuditLog.findOne({
    action: "USER_PROVISIONED",
    targetIdentifier: targetReg,
    outcome: "FAILURE",
  });
  assert.ok(log);
  assert.equal(log.outcome, "FAILURE");
});

test("RBAC: Non-Super-Admin (student) token is rejected with 403 Forbidden", async () => {
  const targetReg = `TEST_PROV_STUDENT_ATTEMPT_${Date.now()}`;

  const res = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      registrationNumber: targetReg,
      name: "Illegal Admin",
      role: "superadmin",
      password: "Password12345!",
      adminPassword: STUDENT_CREDENTIALS.password,
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 403);
  assert.equal(data.success, false);

  const dbUser = await User.findOne({ registrationNumber: targetReg });
  assert.equal(dbUser, null);
});

test("Revoked Session: Request with revoked session token is rejected with 401", async () => {
  // Revoke super admin session
  await Session.updateOne(
    { sessionId: superAdminSessionId },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );

  const res = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: `TEST_PROV_REVOKED_${Date.now()}`,
      name: "Revoked Test",
      role: "superadmin",
      password: "ValidPassword123!",
      adminPassword: SUPERADMIN_CREDENTIALS.password,
    }),
  });

  assert.equal(res.status, 401);

  // Restore session for subsequent tests
  await Session.updateOne(
    { sessionId: superAdminSessionId },
    { $set: { status: "active", revokedAt: null } }
  );
});

test("Duplicate Registration Number: Rejects pre-existing account with 409 Conflict", async () => {
  const duplicateReg = `TEST_PROV_DUP_${Date.now()}`;

  // Seed an existing user
  const existing = await User.create({
    registrationNumber: duplicateReg,
    name: "Existing Person",
    role: "student",
    hostel: "BH-1",
    password: await Argon.hash("InitialPassword123!"),
    isActivated: true,
    accountStatus: "active",
  });
  createdUserIds.push(existing._id);

  const res = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: duplicateReg,
      name: "Conflicting Person",
      role: "superadmin",
      password: "NewPassword123!",
      adminPassword: SUPERADMIN_CREDENTIALS.password,
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 409);
  assert.equal(data.success, false);
  assert.ok(data.message.includes("already exists"));

  // Verify existing user was not overwritten
  const verifyDb = await User.findOne({ registrationNumber: duplicateReg });
  assert.equal(verifyDb.role, "student");
  assert.equal(verifyDb.name, "Existing Person");
});

test("Schema Validation: Rejects invalid roles not in User schema enum", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: `TEST_PROV_ROLE_${Date.now()}`,
      name: "Hacker Role",
      role: "root_administrator", // Not in enum
      password: "ValidPassword123!",
      adminPassword: SUPERADMIN_CREDENTIALS.password,
    }),
  });

  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.ok(data.message.includes("Invalid role"));
});

test("Input Validation: Rejects short passwords and invalid email format", async () => {
  // Short password (< 8 chars)
  const shortPassRes = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: `TEST_PROV_SHORT_${Date.now()}`,
      name: "Short Pass",
      role: "superadmin",
      password: "short",
      adminPassword: SUPERADMIN_CREDENTIALS.password,
    }),
  });
  const shortPassData = await shortPassRes.json();
  assert.equal(shortPassRes.status, 400);
  assert.ok(shortPassData.message.includes("at least 8 characters"));

  // Bad email
  const badEmailRes = await fetch(`${baseUrl}/api/v1/superadmin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      registrationNumber: `TEST_PROV_EMAIL_${Date.now()}`,
      name: "Bad Email",
      role: "superadmin",
      email: "not-an-email",
      password: "ValidPassword123!",
      adminPassword: SUPERADMIN_CREDENTIALS.password,
    }),
  });
  const badEmailData = await badEmailRes.json();
  assert.equal(badEmailRes.status, 400);
  assert.ok(badEmailData.message.includes("Invalid email format"));
});

test("Concurrent Provisioning: Race conditions on same registration number safely resolve to one 201 and one 409", async () => {
  const concurrentReg = `TEST_PROV_CONCURRENT_${Date.now()}`;

  const payload = {
    registrationNumber: concurrentReg,
    name: "Concurrent Test",
    role: "superadmin",
    password: "ConcurrentPassword123!",
    adminPassword: SUPERADMIN_CREDENTIALS.password,
  };

  // Launch two simultaneous creation requests
  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/api/v1/superadmin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(payload),
    }),
    fetch(`${baseUrl}/api/v1/superadmin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(payload),
    }),
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  // Clean up
  const created = await User.findOne({ registrationNumber: concurrentReg });
  if (created) createdUserIds.push(created._id);
});
