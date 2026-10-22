/**
 * Super Admin & Staff Pre-Provisioning & Account Activation Integration Tests
 * 
 * Verifies the Compass / CSV pre-provisioning and self-activation workflow:
 * 1. Pre-provisioned Super Admin (unactivated, no password) is blocked from login before activation
 * 2. Successful self-activation: sets Argon2 password, activates account, creates audit log
 * 3. Successful login post-activation with superadmin role
 * 4. Verification failure: Incorrect hostel returns 404
 * 5. Re-activation prevention: Already-activated accounts cannot be re-activated (returns 400)
 * 6. Password complexity: Passwords < 8 characters for Super Admin are rejected (returns 400)
 * 7. Password mismatch: Mismatched passwords return 400
 * 8. Status enforcement: Deactivated/suspended accounts cannot be activated (returns 403)
 * 9. Anti-Privilege Escalation: Passing role: "superadmin" during student activation DOES NOT alter role
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const Argon = require("argon2");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const app = require("../app");
const connectDB = require("../src/db/db");
const User = require("../src/models/user.model");
const AuditLog = require("../src/models/auditLog.model");

let server;
let baseUrl;
const createdUserIds = [];

before(async () => {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  await User.deleteMany({ registrationNumber: /^TEST_ACT_/ });
  await AuditLog.deleteMany({ targetIdentifier: /^TEST_ACT_/ });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
});

test("Pre-provisioned Super Admin Workflow: Pre-provision, block pre-activation login, activate, then login", async () => {
  const regNumber = `TEST_ACT_SA_${Date.now()}`;
  const rawPassword = "NewOwnerSecret2026!";

  // 1. Pre-provision Super Admin in database (as imported via Compass / CSV without password)
  const preProvisionedAdmin = await User.create({
    registrationNumber: regNumber,
    name: "Pre-provisioned Super Admin",
    role: "superadmin",
    hostel: "ADMIN_HQ",
    email: "pre_admin@hostelcare.local",
    password: null,
    isActivated: false,
    accountStatus: "active",
  });
  createdUserIds.push(preProvisionedAdmin._id);

  // 2. Attempt login BEFORE activation -> Must be blocked with 403
  const loginPreRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      password: rawPassword,
    }),
  });
  const loginPreData = await loginPreRes.json();
  assert.equal(loginPreRes.status, 403);
  assert.equal(loginPreData.success, false);
  assert.ok(loginPreData.message.toLowerCase().includes("activate"));

  // 3. User visits activation page and activates account
  const activateRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      hostel: "ADMIN_HQ",
      newPassword: rawPassword,
      confirmPassword: rawPassword,
    }),
  });
  const activateData = await activateRes.json();
  assert.equal(activateRes.status, 200);
  assert.equal(activateData.success, true);
  assert.equal(activateData.role, "superadmin");

  // 4. Verify MongoDB state: password must be Argon2 hashed, isActivated true
  const activatedUser = await User.findById(preProvisionedAdmin._id);
  assert.equal(activatedUser.isActivated, true);
  assert.equal(activatedUser.accountStatus, "active");
  assert.equal(activatedUser.role, "superadmin");
  assert.ok(activatedUser.password.startsWith("$argon2"));
  const passwordValid = await Argon.verify(activatedUser.password, rawPassword);
  assert.equal(passwordValid, true);

  // 5. Verify Audit Log was recorded for privileged activation
  const auditEntry = await AuditLog.findOne({
    action: "ACCOUNT_ACTIVATED",
    targetIdentifier: regNumber,
  });
  assert.ok(auditEntry);
  assert.equal(auditEntry.outcome, "SUCCESS");
  assert.equal(auditEntry.details?.role, "superadmin");

  // 6. Login AFTER activation -> Must succeed with 200 and return superadmin JWT
  const loginPostRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      password: rawPassword,
    }),
  });
  const loginPostData = await loginPostRes.json();
  assert.equal(loginPostRes.status, 200);
  assert.equal(loginPostData.success, true);
  assert.ok(loginPostData.token);
  const decoded = jwt.decode(loginPostData.token);
  assert.equal(decoded.role, "superadmin");
});

test("Verification Security: Incorrect hostel or registration number returns 404", async () => {
  const regNumber = `TEST_ACT_WRONG_${Date.now()}`;

  const preUser = await User.create({
    registrationNumber: regNumber,
    name: "Wrong Hostel Admin",
    role: "superadmin",
    hostel: "ADMIN_HQ",
    password: null,
    isActivated: false,
    accountStatus: "active",
  });
  createdUserIds.push(preUser._id);

  // Attempt activation with incorrect hostel
  const res = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      hostel: "WRONG_HOSTEL_BLOCK",
      newPassword: "ValidPassword123!",
      confirmPassword: "ValidPassword123!",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 404);
  assert.equal(data.success, false);

  // Verify account remains unactivated
  const userInDb = await User.findById(preUser._id);
  assert.equal(userInDb.isActivated, false);
});

test("Re-activation Prevention: Already-activated accounts cannot be activated again", async () => {
  const regNumber = `TEST_ACT_DUP_${Date.now()}`;

  const activeUser = await User.create({
    registrationNumber: regNumber,
    name: "Already Active",
    role: "superadmin",
    hostel: "ADMIN_HQ",
    password: await Argon.hash("ExistingPassword123!"),
    isActivated: true,
    accountStatus: "active",
  });
  createdUserIds.push(activeUser._id);

  const res = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      hostel: "ADMIN_HQ",
      newPassword: "AttackerNewPassword123!",
      confirmPassword: "AttackerNewPassword123!",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 400);
  assert.equal(data.success, false);
  assert.ok(data.message.includes("already activated"));

  // Verify password was NOT overwritten
  const verifyDb = await User.findById(activeUser._id);
  const isOriginalPass = await Argon.verify(verifyDb.password, "ExistingPassword123!");
  assert.equal(isOriginalPass, true);
});

test("Password Complexity: Short password (< 8 chars for Super Admin) and mismatch are rejected", async () => {
  const regNumber = `TEST_ACT_PASS_${Date.now()}`;

  const preUser = await User.create({
    registrationNumber: regNumber,
    name: "Password Check Admin",
    role: "superadmin",
    hostel: "ADMIN_HQ",
    password: null,
    isActivated: false,
    accountStatus: "active",
  });
  createdUserIds.push(preUser._id);

  // Short password
  const shortRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      hostel: "ADMIN_HQ",
      newPassword: "short",
      confirmPassword: "short",
    }),
  });
  const shortData = await shortRes.json();
  assert.equal(shortRes.status, 400);
  assert.ok(shortData.message.includes("at least 8 characters"));

  // Mismatched passwords
  const mismatchRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: regNumber,
      hostel: "ADMIN_HQ",
      newPassword: "LongPassword123!",
      confirmPassword: "DifferentPassword123!",
    }),
  });
  const mismatchData = await mismatchRes.json();
  assert.equal(mismatchRes.status, 400);
  assert.ok(mismatchData.message.includes("do not match"));
});

test("Privilege Escalation Protection: Activating student cannot elevate to superadmin via request payload", async () => {
  const studentReg = `TEST_ACT_STUDENT_${Date.now()}`;

  const preStudent = await User.create({
    registrationNumber: studentReg,
    name: "Regular Resident",
    role: "student",
    hostel: "BH-1",
    roomNumber: "101",
    password: null,
    isActivated: false,
    accountStatus: "active",
  });
  createdUserIds.push(preStudent._id);

  // Attempt privilege escalation by passing role: "superadmin" in request body
  const res = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: studentReg,
      hostel: "BH-1",
      role: "superadmin", // Attacker tries to make themselves superadmin
      newPassword: "StudentSecurePassword123!",
      confirmPassword: "StudentSecurePassword123!",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);

  // Check database role: MUST REMAIN 'student'
  const verifyDb = await User.findById(preStudent._id);
  assert.equal(verifyDb.role, "student");
  assert.notEqual(verifyDb.role, "superadmin");
});

test("Account Status Enforcement: Deactivated or suspended accounts cannot be activated", async () => {
  const deactReg = `TEST_ACT_DEACT_${Date.now()}`;

  const deactUser = await User.create({
    registrationNumber: deactReg,
    name: "Suspended Admin",
    role: "superadmin",
    hostel: "ADMIN_HQ",
    password: null,
    isActivated: false,
    accountStatus: "suspended",
  });
  createdUserIds.push(deactUser._id);

  const res = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: deactReg,
      hostel: "ADMIN_HQ",
      newPassword: "ValidPassword123!",
      confirmPassword: "ValidPassword123!",
    }),
  });
  const data = await res.json();
  assert.equal(res.status, 403);
  assert.equal(data.code, "ACCOUNT_SUSPENDED");
});

test("Single-Use Activation Token: Enforced when configured, rejects invalid or expired token, clears upon use", async () => {
  const tokenReg = `TEST_ACT_TOK_${Date.now()}`;
  const validToken = "secure-invite-token-xyz-123456";

  const tokenAdmin = await User.create({
    registrationNumber: tokenReg,
    name: "Token Protected Admin",
    role: "superadmin",
    hostel: "ADMIN_HQ",
    password: null,
    isActivated: false,
    accountStatus: "active",
    activationToken: validToken,
    activationTokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour
  });
  createdUserIds.push(tokenAdmin._id);

  // 1. Attempt activation without token -> 401 ACTIVATION_TOKEN_REQUIRED
  const noTokenRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: tokenReg,
      hostel: "ADMIN_HQ",
      newPassword: "SuperSecureTokenPass123!",
      confirmPassword: "SuperSecureTokenPass123!",
    }),
  });
  const noTokenData = await noTokenRes.json();
  assert.equal(noTokenRes.status, 401);
  assert.equal(noTokenData.code, "ACTIVATION_TOKEN_REQUIRED");

  // 2. Attempt activation with wrong token -> 401 INVALID_ACTIVATION_TOKEN
  const wrongTokenRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: tokenReg,
      hostel: "ADMIN_HQ",
      activationToken: "wrong-guess-token",
      newPassword: "SuperSecureTokenPass123!",
      confirmPassword: "SuperSecureTokenPass123!",
    }),
  });
  const wrongTokenData = await wrongTokenRes.json();
  assert.equal(wrongTokenRes.status, 401);
  assert.equal(wrongTokenData.code, "INVALID_ACTIVATION_TOKEN");

  // 3. Attempt activation with expired token -> 400 ACTIVATION_TOKEN_EXPIRED
  await User.updateOne({ _id: tokenAdmin._id }, { activationTokenExpiresAt: new Date(Date.now() - 1000) });
  const expiredRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: tokenReg,
      hostel: "ADMIN_HQ",
      activationToken: validToken,
      newPassword: "SuperSecureTokenPass123!",
      confirmPassword: "SuperSecureTokenPass123!",
    }),
  });
  const expiredData = await expiredRes.json();
  assert.equal(expiredRes.status, 400);
  assert.equal(expiredData.code, "ACTIVATION_TOKEN_EXPIRED");

  // Restore expiration for valid activation
  await User.updateOne({ _id: tokenAdmin._id }, { activationTokenExpiresAt: new Date(Date.now() + 3600000) });

  // 4. Activate with correct token -> 200 OK
  const validRes = await fetch(`${baseUrl}/api/v1/users/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: tokenReg,
      hostel: "ADMIN_HQ",
      activationToken: validToken,
      newPassword: "SuperSecureTokenPass123!",
      confirmPassword: "SuperSecureTokenPass123!",
    }),
  });
  const validData = await validRes.json();
  assert.equal(validRes.status, 200);
  assert.equal(validData.success, true);

  // 5. Verify in DB that activationToken is cleared and user is activated
  const dbUser = await User.findById(tokenAdmin._id).select("+activationToken");
  assert.equal(dbUser.isActivated, true);
  assert.equal(dbUser.activationToken, null);
  assert.equal(dbUser.activationTokenExpiresAt, null);
});

