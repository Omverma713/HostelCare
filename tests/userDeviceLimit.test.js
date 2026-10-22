/**
 * User Device Limit & Concurrent Session Enforcement Integration Tests
 * 
 * Verifies:
 * 1. RBAC: Only Super Admins can update a user's device limit (non-superadmin returns 403)
 * 2. Dedicated API: PATCH /api/v1/superadmin/users/:userId/device-limit updates user.maxDevices
 * 3. Profile API: PATCH /api/v1/superadmin/users/:userId also supports maxDevices
 * 4. Input validation: Rejects 0, negatives, decimals, non-integers, > 50 with 400
 * 5. Reset to default: Passing null or "" resets maxDevices to system default
 * 6. Audit Trail: DEVICE_LIMIT_UPDATED audit log is recorded
 * 7. Login Enforcement: User with maxDevices: 1 has older session revoked on second login
 * 8. Multi-Device Enforcement: User with maxDevices: 2 retains 2 active sessions; 3rd login revokes oldest
 * 9. Concurrency Safety: Simultaneous login requests do not exceed the user's maxDevices limit
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

const SUPERADMIN_USER = {
  registrationNumber: `SA_DEV_LIMIT_${Date.now()}`,
  password: "MasterAdminPassword123!",
  name: "Device Admin",
  role: "superadmin",
  hostel: "ADMIN_HQ",
  email: "devadmin@hostelcare.local",
  isActivated: true,
  accountStatus: "active",
};

const STUDENT_USER = {
  registrationNumber: `ST_DEV_LIMIT_${Date.now()}`,
  password: "StudentPassword123!",
  name: "Device Student",
  role: "student",
  hostel: "BH-1",
  email: "devstudent@hostelcare.local",
  isActivated: true,
  accountStatus: "active",
};

let superAdminToken;
let studentToken;
let targetStudentId;
const createdUserIds = [];

before(async () => {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed superadmin
  const saPass = await Argon.hash(SUPERADMIN_USER.password);
  const saUser = await User.create({ ...SUPERADMIN_USER, password: saPass });
  createdUserIds.push(saUser._id);

  // Seed student
  const stPass = await Argon.hash(STUDENT_USER.password);
  const stUser = await User.create({ ...STUDENT_USER, password: stPass });
  createdUserIds.push(stUser._id);
  targetStudentId = stUser._id.toString();

  // Log in as superadmin
  const saLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: SUPERADMIN_USER.registrationNumber,
      password: SUPERADMIN_USER.password,
    }),
  });
  const saLoginData = await saLoginRes.json();
  assert.equal(saLoginData.success, true);
  superAdminToken = saLoginData.token;

  // Log in as student
  const stLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: STUDENT_USER.registrationNumber,
      password: STUDENT_USER.password,
    }),
  });
  const stLoginData = await stLoginRes.json();
  assert.equal(stLoginData.success, true);
  studentToken = stLoginData.token;
});

after(async () => {
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Session.deleteMany({ userId: { $in: createdUserIds } });
  }
  await User.deleteMany({ registrationNumber: /^TEST_DEV_/ });
  await AuditLog.deleteMany({ targetIdentifier: /^TEST_DEV_/ });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
});

test("Authorization: Non-Super-Admin (student) cannot update device limit (403)", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/users/${targetStudentId}/device-limit`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ maxDevices: 5 }),
  });
  assert.equal(res.status, 403);
});

test("Update Device Limit API: Super Admin successfully sets user maxDevices to 2", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/users/${targetStudentId}/device-limit`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ maxDevices: 2 }),
  });

  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.user.maxDevices, 2);
  assert.equal(data.user.effectiveDeviceLimit, 2);

  // Verify in MongoDB
  const dbUser = await User.findById(targetStudentId);
  assert.equal(dbUser.maxDevices, 2);

  // Verify Audit Log
  const audit = await AuditLog.findOne({
    action: "DEVICE_LIMIT_UPDATED",
    targetId: targetStudentId,
  });
  assert.ok(audit);
  assert.equal(audit.details?.newLimit, 2);
});

test("Profile Update API: updateUserProfile also accepts maxDevices", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/users/${targetStudentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ maxDevices: 4 }),
  });

  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.user.maxDevices, 4);

  const dbUser = await User.findById(targetStudentId);
  assert.equal(dbUser.maxDevices, 4);
});

test("Input Validation: Rejects invalid device limits with 400 Bad Request", async () => {
  const invalidPayloads = [
    { maxDevices: 0 },
    { maxDevices: -5 },
    { maxDevices: 2.5 },
    { maxDevices: 100 }, // > 50
    { maxDevices: "invalid_string" },
  ];

  for (const payload of invalidPayloads) {
    const res = await fetch(`${baseUrl}/api/v1/superadmin/users/${targetStudentId}/device-limit`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 400, `Expected 400 for payload: ${JSON.stringify(payload)}`);
  }
});

test("Reset to System Default: Setting maxDevices to null restores system default", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/users/${targetStudentId}/device-limit`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ maxDevices: null }),
  });

  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.user.maxDevices, null);
  assert.ok(data.user.effectiveDeviceLimit >= 1);

  const dbUser = await User.findById(targetStudentId);
  assert.equal(dbUser.maxDevices, null);
});

test("Login Enforcement (maxDevices: 1): Second login revokes first session", async () => {
  const testReg = `TEST_DEV_ST1_${Date.now()}`;
  const testPass = "SingleDevicePass123!";

  const u = await User.create({
    registrationNumber: testReg,
    password: await Argon.hash(testPass),
    name: "Single Device User",
    role: "student",
    hostel: "BH-1",
    isActivated: true,
    accountStatus: "active",
    maxDevices: 1, // STRICT 1-device limit
  });
  createdUserIds.push(u._id);

  // 1st Login
  const login1 = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: testReg,
      password: testPass,
      deviceNickname: "Phone A",
    }),
  });
  const data1 = await login1.json();
  assert.equal(login1.status, 200);
  const session1Id = data1.session.sessionId;

  // Verify exactly 1 active session
  let activeCount = await Session.countDocuments({ userId: u._id, status: "active" });
  assert.equal(activeCount, 1);

  // 2nd Login from another device
  const login2 = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: testReg,
      password: testPass,
      deviceNickname: "Phone B",
    }),
  });
  const data2 = await login2.json();
  assert.equal(login2.status, 200);
  const session2Id = data2.session.sessionId;

  // Session 1 must now be revoked
  const s1 = await Session.findOne({ sessionId: session1Id });
  assert.equal(s1.status, "revoked");
  assert.equal(s1.revokedBy, "system_limit");

  // Session 2 must be active
  const s2 = await Session.findOne({ sessionId: session2Id });
  assert.equal(s2.status, "active");

  // Total active count must still be strictly 1
  activeCount = await Session.countDocuments({ userId: u._id, status: "active" });
  assert.equal(activeCount, 1);
});

test("Login Enforcement (maxDevices: 2): Third login revokes oldest session while keeping 2 active", async () => {
  const testReg = `TEST_DEV_ST2_${Date.now()}`;
  const testPass = "DualDevicePass123!";

  const u = await User.create({
    registrationNumber: testReg,
    password: await Argon.hash(testPass),
    name: "Dual Device User",
    role: "student",
    hostel: "BH-1",
    isActivated: true,
    accountStatus: "active",
    maxDevices: 2, // 2-device limit
  });
  createdUserIds.push(u._id);

  // Login 1
  const l1 = await (await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: testReg, password: testPass, deviceNickname: "Device 1" }),
  })).json();
  assert.equal(l1.success, true);

  // Login 2
  const l2 = await (await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: testReg, password: testPass, deviceNickname: "Device 2" }),
  })).json();
  assert.equal(l2.success, true);

  // Both sessions must be active
  let active = await Session.find({ userId: u._id, status: "active" });
  assert.equal(active.length, 2);

  // Login 3 -> Exceeds limit 2 -> Oldest (Device 1) is revoked
  const l3 = await (await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: testReg, password: testPass, deviceNickname: "Device 3" }),
  })).json();
  assert.equal(l3.success, true);

  // Device 1 revoked
  const s1 = await Session.findOne({ sessionId: l1.session.sessionId });
  assert.equal(s1.status, "revoked");

  // Device 2 & 3 active
  const s2 = await Session.findOne({ sessionId: l2.session.sessionId });
  const s3 = await Session.findOne({ sessionId: l3.session.sessionId });
  assert.equal(s2.status, "active");
  assert.equal(s3.status, "active");

  active = await Session.find({ userId: u._id, status: "active" });
  assert.equal(active.length, 2);
});

test("Concurrency Safety: Concurrent login attempts for maxDevices: 1 resolve to exactly 1 active session", async () => {
  const testReg = `TEST_DEV_CONCURRENT_${Date.now()}`;
  const testPass = "ConcurrentPass123!";

  const u = await User.create({
    registrationNumber: testReg,
    password: await Argon.hash(testPass),
    name: "Concurrent Limit User",
    role: "student",
    hostel: "BH-1",
    isActivated: true,
    accountStatus: "active",
    maxDevices: 1, // 1-device limit
  });
  createdUserIds.push(u._id);

  // Execute two logins simultaneously
  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/api/v1/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: testReg, password: testPass, deviceNickname: "Simultaneous 1" }),
    }),
    fetch(`${baseUrl}/api/v1/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: testReg, password: testPass, deviceNickname: "Simultaneous 2" }),
    }),
  ]);

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);

  // Total active sessions must be strictly capped at 1
  const activeSessions = await Session.find({ userId: u._id, status: "active" });
  assert.equal(activeSessions.length, 1);
});
