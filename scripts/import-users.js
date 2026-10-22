/**
 * HostelCare CSV User Provisioning Engine
 * 
 * Provisions Students, Caretakers, Wardens, Superintendents, and Super Admins
 * via standard CSV files with strict validation, idempotency, and Argon2 hashing.
 * 
 * Security Guardrails:
 * 1. An explicit CLI flag `--allow-superadmin` is MANDATORY to import any `superadmin` role row.
 *    Without this flag, if any row has role `superadmin`, import is rejected with a security error.
 * 2. Passwords are never logged or exposed in summaries or error messages.
 * 3. Passwords must be at least 8 characters for staff and super admins, hashed with Argon2.
 * 4. Duplicate registration numbers are safely skipped without overwriting existing accounts.
 * 5. Dry-run mode (`--dry-run`) enables safe pre-flight validation without writing to DB.
 * 
 * CLI Usage:
 *   node scripts/import-users.js --file <path-to-csv> [--dry-run] [--allow-superadmin]
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Argon = require("argon2");

const User = require("../src/models/user.model");
const connectDB = require("../src/db/db");

const VALID_ROLES = [
  "student",
  "caretaker",
  "warden",
  "superintendent",
  "chiefHostelWarden",
  "superadmin",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Robust RFC 4180 CSV parser supporting quoted cells and CRLF/LF line endings
 */
function parseCsvContent(content) {
  const lines = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++; // handle CRLF
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== "")) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = lines[0].map((h) => h.toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowObj = {};
    rawHeaders.forEach((header, idx) => {
      rowObj[header] = line[idx] !== undefined ? line[idx] : "";
    });
    rows.push({ rowIndex: i + 1, data: rowObj });
  }

  return { headers: rawHeaders, rows };
}

/**
 * Core validation and import engine
 * 
 * @param {Object} options
 * @param {string} options.filePath - Path to CSV file
 * @param {string} [options.csvString] - Optional raw CSV string (for in-memory testing)
 * @param {boolean} [options.dryRun=false] - If true, validates without saving to DB
 * @param {boolean} [options.allowSuperAdmin=false] - Required to provision superadmin rows
 * @returns {Promise<Object>} Execution summary report
 */
async function importUsersFromCsv({
  filePath,
  csvString,
  dryRun = false,
  allowSuperAdmin = false,
}) {
  let content = csvString;
  if (!content && filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found at path: ${filePath}`);
    }
    content = fs.readFileSync(filePath, "utf8");
  }

  if (!content || !content.trim()) {
    throw new Error("CSV file is empty.");
  }

  const { headers, rows } = parseCsvContent(content);

  const requiredHeaders = ["registrationnumber", "name", "role", "hostel"];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `CSV is missing required header column(s): ${missingHeaders.join(", ")}. Required format: registrationNumber,name,role,hostel,roomNumber,email,password`
    );
  }

  const report = {
    dryRun,
    allowSuperAdmin,
    totalRows: rows.length,
    validRows: [],
    skippedDuplicates: [],
    validationFailures: [],
    successfullyProvisioned: 0,
    securityErrors: [],
  };

  const seenInCsv = new Set();

  // ─── Step 1: Row-by-Row Pre-Flight Validation ─────────────────────────────
  for (const { rowIndex, data } of rows) {
    const regNum = data.registrationnumber || "";
    const name = data.name || "";
    const role = (data.role || "").toLowerCase();
    const hostel = data.hostel || (role === "superadmin" ? "ADMIN_HQ" : "");
    const roomNumber = data.roomnumber || null;
    const email = (data.email || "").toLowerCase();
    const rawPassword = data.password || "";

    const rowErrors = [];

    // 1. Mandatory Identity Fields
    if (!regNum) rowErrors.push("registrationNumber is required");
    if (!name) rowErrors.push("name is required");
    if (!hostel) rowErrors.push("hostel is required");

    // 2. Intra-CSV Duplicate check
    if (regNum) {
      if (seenInCsv.has(regNum.toUpperCase())) {
        rowErrors.push(`Duplicate registrationNumber '${regNum}' appears multiple times in this CSV`);
      } else {
        seenInCsv.add(regNum.toUpperCase());
      }
    }

    // 3. Role validation
    if (!role) {
      rowErrors.push("role is required");
    } else if (!VALID_ROLES.includes(role)) {
      rowErrors.push(`Invalid role '${role}'. Allowed roles: ${VALID_ROLES.join(", ")}`);
    }

    // 4. CRITICAL SECURITY GUARDRAIL: Super Admin Provisioning Authorization
    if (role === "superadmin" && !allowSuperAdmin) {
      const securityMsg = `SECURITY VIOLATION at Row ${rowIndex}: Row requests 'superadmin' role, but the '--allow-superadmin' CLI flag was not supplied.`;
      rowErrors.push("Super Admin provisioning is unauthorized without the explicit '--allow-superadmin' flag.");
      report.securityErrors.push({ rowIndex, registrationNumber: regNum, error: securityMsg });
    }

    // 5. Password Validation (Optional for pre-provisioned accounts awaiting activation)
    if (rawPassword) {
      if (["superadmin", "warden", "caretaker", "superintendent", "chiefhostelwarden"].includes(role)) {
        if (rawPassword.length < 8) {
          rowErrors.push(`Password for ${role} must be at least 8 characters long (never log passwords)`);
        }
      } else if (role === "student" && rawPassword.length < 6) {
        rowErrors.push("Student password, if provided, must be at least 6 characters long");
      }
    }

    // 6. Optional Email Format Validation
    if (email && !EMAIL_REGEX.test(email)) {
      rowErrors.push(`Invalid email format: '${email}'`);
    }

    if (rowErrors.length > 0) {
      report.validationFailures.push({
        rowIndex,
        registrationNumber: regNum || `[Row ${rowIndex}]`,
        role,
        errors: rowErrors,
      });
      continue;
    }

    report.validRows.push({
      rowIndex,
      registrationNumber: regNum,
      name,
      role,
      hostel,
      roomNumber: roomNumber && roomNumber !== "null" ? roomNumber : null,
      email,
      rawPassword,
    });
  }

  // If there were security violations, immediately halt to prevent unauthorized elevation
  if (report.securityErrors.length > 0) {
    return report;
  }

  // ─── Step 2: Database Duplicate Check (Idempotency & Non-Destructive) ──────
  const validCandidates = [];
  if (report.validRows.length > 0) {
    const regNumbers = report.validRows.map((r) => r.registrationNumber);
    const existingUsers = await User.find({ registrationNumber: { $in: regNumbers } })
      .select("registrationNumber role accountStatus")
      .lean();

    const existingMap = new Map();
    existingUsers.forEach((u) => existingMap.set(u.registrationNumber.toUpperCase(), u));

    for (const row of report.validRows) {
      const existing = existingMap.get(row.registrationNumber.toUpperCase());
      if (existing) {
        report.skippedDuplicates.push({
          rowIndex: row.rowIndex,
          registrationNumber: row.registrationNumber,
          existingRole: existing.role,
          reason: "Account already exists in database; skipped without modifying.",
        });
      } else {
        validCandidates.push(row);
      }
    }
  }

  // ─── Step 3: Database Insertion (Skipped in Dry-Run Mode) ───────────────────
  if (!dryRun && validCandidates.length > 0) {
    for (const candidate of validCandidates) {
      let hashedPassword = null;
      let isActivated = false;

      if (candidate.rawPassword) {
        hashedPassword = await Argon.hash(candidate.rawPassword);
        isActivated = true;
      } else {
        hashedPassword = null;
        isActivated = false;
      }

      await User.create({
        registrationNumber: candidate.registrationNumber,
        name: candidate.name,
        password: hashedPassword,
        role: candidate.role,
        hostel: candidate.hostel,
        roomNumber: candidate.roomNumber,
        email: candidate.email,
        isActivated,
        accountStatus: "active",
      });

      report.successfullyProvisioned++;
    }
  }

  return report;
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────────
async function runCli() {
  const args = process.argv.slice(2);

  let filePath = null;
  let dryRun = false;
  let allowSuperAdmin = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file" || arg === "-f") {
      filePath = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--allow-superadmin") {
      allowSuperAdmin = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
HostelCare User & Super Admin CSV Provisioning Tool

Usage:
  node scripts/import-users.js --file <path-to-csv> [options]

Options:
  --file, -f <path>     Path to the CSV file to import (Required)
  --dry-run             Validate CSV syntax, database duplicates, and constraints without writing to DB
  --allow-superadmin    Explicit authorization required to provision 'superadmin' role accounts
  --help, -h            Show this help menu

Examples:
  # 1. Dry run a staff/student CSV import safely:
  node scripts/import-users.js --file ./staff-users.csv --dry-run

  # 2. Dry run a Super Admin CSV import:
  node scripts/import-users.js --file ./superadmins.csv --dry-run --allow-superadmin

  # 3. Provision Super Admin accounts into database:
  node scripts/import-users.js --file ./superadmins.csv --allow-superadmin
`);
      process.exit(0);
    }
  }

  if (!filePath) {
    console.error("❌ Error: Missing required '--file <path>' argument. Run with '--help' for instructions.");
    process.exit(1);
  }

  console.log("================================================================================");
  console.log(`🚀 HostelCare CSV User Provisioning Engine`);
  console.log(`📁 File:               ${path.resolve(filePath)}`);
  console.log(`🧪 Mode:               ${dryRun ? "DRY-RUN (Pre-Flight Validation Only - No DB writes)" : "LIVE IMPORT (Writing to DB)"}`);
  console.log(`🛡️ Super Admin Allowed: ${allowSuperAdmin ? "YES (--allow-superadmin active)" : "NO (superadmin rows will be rejected)"}`);
  console.log("================================================================================");

  await connectDB();

  try {
    const report = await importUsersFromCsv({ filePath, dryRun, allowSuperAdmin });

    console.log(`\n📊 Import Execution Summary:`);
    console.log(`   • Total Rows in CSV:         ${report.totalRows}`);
    console.log(`   • Validation Failures:       ${report.validationFailures.length}`);
    console.log(`   • Skipped Duplicates:        ${report.skippedDuplicates.length}`);

    if (report.dryRun) {
      const readyToImport = report.validRows.length - report.skippedDuplicates.length;
      console.log(`   • Ready to Provision:        ${readyToImport} (Dry-run: DB not touched)`);
    } else {
      console.log(`   • Successfully Provisioned:  ${report.successfullyProvisioned}`);
    }

    // Detail Security Errors
    if (report.securityErrors.length > 0) {
      console.error(`\n❌ SECURITY VIOLATIONS DETECTED (${report.securityErrors.length}):`);
      report.securityErrors.forEach((e) => console.error(`   - ${e.error}`));
      console.error(`\nAction Aborted: To provision Super Admin accounts, re-run with '--allow-superadmin'.`);
      process.exit(1);
    }

    // Detail Validation Failures
    if (report.validationFailures.length > 0) {
      console.warn(`\n⚠️ VALIDATION FAILURES (${report.validationFailures.length}):`);
      report.validationFailures.forEach((f) => {
        console.warn(`   - Row ${f.rowIndex} [${f.registrationNumber}]: ${f.errors.join("; ")}`);
      });
    }

    // Detail Skipped Duplicates
    if (report.skippedDuplicates.length > 0) {
      console.log(`\nℹ️ SKIPPED EXISTING USERS (${report.skippedDuplicates.length}):`);
      report.skippedDuplicates.forEach((d) => {
        console.log(`   - Row ${d.rowIndex} [${d.registrationNumber}] (${d.existingRole}): ${d.reason}`);
      });
    }

    if (report.validationFailures.length > 0 && !dryRun) {
      console.warn(`\n⚠️ Notice: Some rows failed validation and were skipped. Valid rows were processed.`);
    } else if (report.dryRun) {
      console.log(`\n✅ Dry-run complete. Review the output above before running live import.`);
    } else {
      console.log(`\n✅ Import process completed successfully.`);
    }
  } catch (err) {
    console.error(`\n❌ Import Failed:`, err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  importUsersFromCsv,
  parseCsvContent,
  VALID_ROLES,
};
