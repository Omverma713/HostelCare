/**
 * Maintenance Mode Integration & Security Test Suite
 * 
 * Verifies:
 * 1. Global Maintenance Mode (Mode 1):
 *    - Rejects normal users (student, warden, caretaker) with HTTP 503 and structured JSON.
 *    - Rejects normal user login attempts with HTTP 503.
 *    - Allows Super Admin login and full API access (no authentication bypass).
 *    - Enforces restriction on existing authenticated sessions.
 * 2. Selective / Role-Based Maintenance Mode (Mode 2):
 *    - Restricts specified roles (e.g. student) with HTTP 503.
 *    - Allows unaffected roles (e.g. warden) to operate normally with HTTP 200.
 *    - Restricts specific users by registration number.
 *    - Super Admin retains full access.
 * 3. Precedence:
 *    - When both modes are active, Global Maintenance takes precedence for non-Super-Admin users.
 * 4. Safe Recovery:
 *    - Super Admin can disable maintenance, restoring normal API access immediately.
 * 5. Security & Audit Logging:
 *    - Non-admin cannot modify maintenance configuration.
 *    - Maintenance updates produce sanitized audit log entries.
 *    - Public endpoint /api/v1/maintenance/status is accessible without credentials.
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

const TEST_TIMESTAMP = Date.now();

const TEST_SUPERADMIN = {
  registrationNumber: `SA_MAINT_${TEST_TIMESTAMP}`,
  password: "SuperAdminPass123!",
  name: "Maintenance Super Admin",
  role: "superadmin",
  hostel: "ADMIN_HQ",
  email: `sa_${TEST_TIMESTAMP}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_STUDENT = {
  registrationNumber: `ST_MAINT_${TEST_TIMESTAMP}`,
  password: "StudentPass123!",
  name: "Maintenance Student",
  role: "student",
  hostel: "BH-1",
  email: `st_${TEST_TIMESTAMP}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_WARDEN = {
  registrationNumber: `WD_MAINT_${TEST_TIMESTAMP}`,
  password: "WardenPass123!",
  name: "Maintenance Warden",
  role: "warden",
  hostel: "BH-1",
  email: `wd_${TEST_TIMESTAMP}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

let superAdminToken;
let studentToken;
let wardenToken;

before(async () => {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Reset maintenance mode to clean state
  const config = await SystemConfig.getEffectiveConfig();
  config.maintenance = {
    global: { enabled: false },
    selective: { enabled: false, affectedRoles: ["student"], affectedRegistrationNumbers: [] },
  };
  await config.save();

  // Seed test accounts
  const hashedAdmin = await Argon.hash(TEST_SUPERADMIN.password);
  await User.create({ ...TEST_SUPERADMIN, password: hashedAdmin });

  const hashedStudent = await Argon.hash(TEST_STUDENT.password);
  await User.create({ ...TEST_STUDENT, password: hashedStudent });

  const hashedWarden = await Argon.hash(TEST_WARDEN.password);
  await User.create({ ...TEST_WARDEN, password: hashedWarden });

  // Authenticate users initially to obtain active sessions
  const adminLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_SUPERADMIN.registrationNumber,
      password: TEST_SUPERADMIN.password,
    }),
  });
  const adminData = await adminLoginRes.json();
  superAdminToken = adminData.token;

  const studentLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
    }),
  });
  const studentData = await studentLoginRes.json();
  studentToken = studentData.token;

  const wardenLoginRes = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_WARDEN.registrationNumber,
      password: TEST_WARDEN.password,
    }),
  });
  const wardenData = await wardenLoginRes.json();
  wardenToken = wardenData.token;
});

after(async () => {
  // Restore default config
  const config = await SystemConfig.getEffectiveConfig();
  config.maintenance = {
    global: { enabled: false },
    selective: { enabled: false, affectedRoles: ["student"], affectedRegistrationNumbers: [] },
  };
  await config.save();

  await User.deleteMany({
    registrationNumber: {
      $in: [
        TEST_SUPERADMIN.registrationNumber,
        TEST_STUDENT.registrationNumber,
        TEST_WARDEN.registrationNumber,
      ],
    },
  });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
});

test("Public maintenance status endpoint returns 200 without authentication", async () => {
  const res = await fetch(`${baseUrl}/api/v1/maintenance/status`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.maintenance);
  assert.equal(data.maintenance.global.enabled, false);
});

test("Non-admin cannot update maintenance configuration (HTTP 401/403)", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      global: { enabled: true },
    }),
  });
  assert.equal(res.status, 403);
});

test("Mode 1: Super Admin enables Global Maintenance", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      global: {
        enabled: true,
        title: "Major Scheduled System Upgrade",
        message: "HostelCare is undergoing core database migration. Back at 10:00 PM.",
        plannedStart: new Date().toISOString(),
        plannedEnd: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.maintenance.global.enabled, true);
  assert.equal(data.maintenance.global.title, "Major Scheduled System Upgrade");
});

test("Mode 1: Existing student session receives HTTP 503 on protected routes", async () => {
  const res = await fetch(`${baseUrl}/api/v1/users/hostel-complaints`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.code, "MAINTENANCE_MODE_ACTIVE");
  assert.equal(data.maintenance.mode, "global");
  assert.equal(data.maintenance.title, "Major Scheduled System Upgrade");
});

test("Mode 1: Normal student login attempt is blocked with HTTP 503", async () => {
  const res = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_STUDENT.registrationNumber,
      password: TEST_STUDENT.password,
    }),
  });

  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.code, "MAINTENANCE_MODE_ACTIVE");
  assert.equal(data.maintenance.mode, "global");
});

test("Mode 1: Super Admin login succeeds during Global Maintenance (safe recovery path)", async () => {
  const res = await fetch(`${baseUrl}/api/v1/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationNumber: TEST_SUPERADMIN.registrationNumber,
      password: TEST_SUPERADMIN.password,
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.token);
});

test("Mode 1: Super Admin retains access to superadmin APIs during Global Maintenance", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/overview`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.stats);
});

test("Mode 2: Super Admin switches to Selective Maintenance (affecting students only)", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      global: { enabled: false },
      selective: {
        enabled: true,
        title: "Student Portal Maintenance",
        message: "Complaint submission module is being refreshed for students.",
        affectedRoles: ["student"],
        affectedRegistrationNumbers: [],
      },
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.maintenance.global.enabled, false);
  assert.equal(data.maintenance.selective.enabled, true);
  assert.deepEqual(data.maintenance.selective.affectedRoles, ["student"]);
});

test("Mode 2: Affected student is blocked with HTTP 503", async () => {
  const res = await fetch(`${baseUrl}/api/v1/users/hostel-complaints`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.code, "MAINTENANCE_MODE_ACTIVE");
  assert.equal(data.maintenance.mode, "selective");
  assert.equal(data.maintenance.title, "Student Portal Maintenance");
});

test("Mode 2: Unaffected warden continues operating normally with HTTP 200", async () => {
  const res = await fetch(`${baseUrl}/api/v1/users/warden/dashboard`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
});

test("Mode 2: Selective maintenance targeting specific registration number", async () => {
  // Update selective maintenance to target the warden's registration number
  await fetch(`${baseUrl}/api/v1/superadmin/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      selective: {
        enabled: true,
        affectedRoles: ["student"],
        affectedRegistrationNumbers: [TEST_WARDEN.registrationNumber],
      },
    }),
  });

  // Now warden should also be blocked because their registrationNumber is targeted
  const res = await fetch(`${baseUrl}/api/v1/users/warden/dashboard`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });

  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.code, "MAINTENANCE_MODE_ACTIVE");
  assert.equal(data.maintenance.mode, "selective");
});

test("Precedence: When both Global and Selective modes are enabled, Global takes precedence", async () => {
  // Enable BOTH Global and Selective
  await fetch(`${baseUrl}/api/v1/superadmin/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      global: {
        enabled: true,
        title: "Global Lockdown Precedence",
        message: "Global takes precedence over selective.",
      },
      selective: {
        enabled: true,
        title: "Selective Title",
        affectedRoles: ["student"],
        affectedRegistrationNumbers: [],
      },
    }),
  });

  // Test with warden who is NOT in selective.affectedRoles:
  // Because global is active, warden must be blocked with mode: "global"
  const res = await fetch(`${baseUrl}/api/v1/users/warden/dashboard`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });

  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.code, "MAINTENANCE_MODE_ACTIVE");
  assert.equal(data.maintenance.mode, "global");
  assert.equal(data.maintenance.title, "Global Lockdown Precedence");
});

test("Safe Recovery: Super Admin disables maintenance, restoring immediate access", async () => {
  const res = await fetch(`${baseUrl}/api/v1/superadmin/maintenance`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      global: { enabled: false },
      selective: { enabled: false, affectedRoles: [], affectedRegistrationNumbers: [] },
    }),
  });

  assert.equal(res.status, 200);

  // Normal student immediately gets 200 again
  const studentRes = await fetch(`${baseUrl}/api/v1/users/my-sessions`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(studentRes.status, 200);

  // Warden immediately gets 200 again
  const wardenRes = await fetch(`${baseUrl}/api/v1/users/my-sessions`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.equal(wardenRes.status, 200);
});

test("Audit logging: Maintenance updates recorded in AuditLog", async () => {
  const log = await AuditLog.findOne({
    action: "MAINTENANCE_MODE_UPDATED",
  }).sort({ createdAt: -1 });

  assert.ok(log);
  assert.equal(log.targetType, "SYSTEM_CONFIG");
  assert.equal(log.targetIdentifier, "maintenance");
  assert.ok(log.summary.includes("Maintenance configuration updated"));
});
