/**
 * Automated Test Suite for HostelCare CSV User Provisioning
 * 
 * Verifies:
 * 1. Authorized provisioning with allowSuperAdmin: true.
 * 2. Rejection of unauthorized superadmin provisioning without allowSuperAdmin flag.
 * 3. Duplicate records are skipped without modifying existing accounts.
 * 4. Validation errors: invalid roles, missing fields, short passwords, bad emails.
 * 5. Password hashing: verified with Argon2; plaintext password never stored.
 * 6. Dry-run mode: verifies zero database writes occur during dry-run.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Argon = require("argon2");

require("dotenv").config();
const connectDB = require("../src/db/db");
const User = require("../src/models/user.model");
const { importUsersFromCsv, parseCsvContent } = require("../scripts/import-users");

const PREFIX = `TEST_${Date.now()}`;

const CREATED_REG_NUMS = [];

before(async () => {
  await connectDB();
});

after(async () => {
  if (CREATED_REG_NUMS.length > 0) {
    await User.deleteMany({ registrationNumber: { $in: CREATED_REG_NUMS } });
  }
  await mongoose.connection.close();
});

test("CSV Parser: Correctly handles RFC 4180 quotes, commas, and CRLF endings", () => {
  const csv = `registrationNumber,name,role,hostel,roomNumber,email,password\r\n"REG001","Doe, John",warden,BH-1,,john.doe@example.com,Pass12345!\r\n`;
  const { headers, rows } = parseCsvContent(csv);

  assert.equal(headers[0], "registrationnumber");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].data.name, "Doe, John");
  assert.equal(rows[0].data.password, "Pass12345!");
});

test("Security Guardrail: Super Admin row without allowSuperAdmin flag is REJECTED", async () => {
  const saReg = `${PREFIX}_SA_REJECT`;
  const csv = `registrationNumber,name,role,hostel,roomNumber,email,password\n${saReg},Hacker Admin,superadmin,ADMIN_HQ,,hack@example.com,SuperSecret123!\n`;

  const report = await importUsersFromCsv({
    csvString: csv,
    allowSuperAdmin: false, // flag not provided
    dryRun: false,
  });

  assert.equal(report.securityErrors.length, 1);
  assert.match(report.securityErrors[0].error, /SECURITY VIOLATION/);
  assert.equal(report.successfullyProvisioned, 0);

  // Verify NOT created in DB
  const dbCheck = await User.findOne({ registrationNumber: saReg });
  assert.equal(dbCheck, null);
});

test("Authorized Super Admin Provisioning: Creates active superadmin with Argon2 password", async () => {
  const saReg = `${PREFIX}_SA_AUTH`;
  CREATED_REG_NUMS.push(saReg);

  const rawPassword = "ValidSuperAdminPass#2026";
  const csv = `registrationNumber,name,role,hostel,roomNumber,email,password\n${saReg},Authorized SA,superadmin,ADMIN_HQ,,auth.sa@example.com,${rawPassword}\n`;

  const report = await importUsersFromCsv({
    csvString: csv,
    allowSuperAdmin: true, // explicitly authorized
    dryRun: false,
  });

  assert.equal(report.securityErrors.length, 0);
  assert.equal(report.validationFailures.length, 0);
  assert.equal(report.successfullyProvisioned, 1);

  // Check Database Record
  const saUser = await User.findOne({ registrationNumber: saReg });
  assert.ok(saUser);
  assert.equal(saUser.role, "superadmin");
  assert.equal(saUser.isActivated, true);
  assert.equal(saUser.accountStatus, "active");

  // Verify Argon2 hash
  assert.notEqual(saUser.password, rawPassword);
  assert.ok(saUser.password.startsWith("$argon2id$"));
  const isMatch = await Argon.verify(saUser.password, rawPassword);
  assert.equal(isMatch, true);
});

test("Dry-Run Mode: Validates successfully without modifying database", async () => {
  const dryReg = `${PREFIX}_DRYRUN`;
  const csv = `registrationNumber,name,role,hostel,roomNumber,email,password\n${dryReg},DryRun User,warden,BH-2,,dryrun@example.com,WardenPass@123\n`;

  const report = await importUsersFromCsv({
    csvString: csv,
    dryRun: true, // Dry run enabled
    allowSuperAdmin: false,
  });

  assert.equal(report.validationFailures.length, 0);
  assert.equal(report.validRows.length, 1);
  assert.equal(report.successfullyProvisioned, 0); // zero writes

  // Verify NOT in DB
  const dbCheck = await User.findOne({ registrationNumber: dryReg });
  assert.equal(dbCheck, null);
});

test("Duplicate Handling & Non-Destructive Invariance: Existing users are skipped without modification", async () => {
  const existingReg = `${PREFIX}_EXISTING`;
  CREATED_REG_NUMS.push(existingReg);

  // 1. Create original user in DB
  const originalPassword = "OriginalPass@999";
  const hashedOriginal = await Argon.hash(originalPassword);
  await User.create({
    registrationNumber: existingReg,
    name: "Original Name",
    password: hashedOriginal,
    role: "caretaker",
    hostel: "BH-1",
    isActivated: true,
    accountStatus: "active",
  });

  // 2. Attempt to re-import the same registrationNumber with different data
  const csv = `registrationNumber,name,role,hostel,roomNumber,email,password\n${existingReg},Overwritten Name?,caretaker,BH-9,,different@example.com,DifferentPass@111\n`;

  const report = await importUsersFromCsv({
    csvString: csv,
    dryRun: false,
    allowSuperAdmin: false,
  });

  assert.equal(report.skippedDuplicates.length, 1);
  assert.equal(report.skippedDuplicates[0].registrationNumber, existingReg);
  assert.equal(report.successfullyProvisioned, 0);

  // 3. Verify original database record is completely intact
  const dbUser = await User.findOne({ registrationNumber: existingReg });
  assert.equal(dbUser.name, "Original Name");
  assert.equal(dbUser.hostel, "BH-1");
  const isOriginalPassValid = await Argon.verify(dbUser.password, originalPassword);
  assert.equal(isOriginalPassValid, true);
});

test("Validation Failures: Rejects invalid roles, missing fields, short passwords, bad emails", async () => {
  const csv = `registrationNumber,name,role,hostel,roomNumber,email,password\n` +
    `,No Reg User,warden,BH-1,,bad@example.com,ValidPassword#1\n` +
    `REG_BAD_ROLE,Bad Role,godmode,BH-1,,bad@example.com,ValidPassword#1\n` +
    `REG_SHORT_PASS,Short Pass,warden,BH-1,,bad@example.com,short\n` +
    `REG_BAD_EMAIL,Bad Email,caretaker,BH-1,,not-an-email,ValidPassword#1\n`;

  const report = await importUsersFromCsv({
    csvString: csv,
    dryRun: false,
    allowSuperAdmin: false,
  });

  assert.equal(report.validationFailures.length, 4);
  assert.equal(report.successfullyProvisioned, 0);

  // Verify none were written
  const check = await User.findOne({ registrationNumber: "REG_SHORT_PASS" });
  assert.equal(check, null);
});
