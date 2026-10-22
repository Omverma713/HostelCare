# HostelCare User Provisioning CSV Templates & Security Guide

This folder contains format templates for provisioning hostel residents, operational staff, and Super Administrators.

---

## 🔒 Security Best Practices for CSV Files

1. **Never Commit Real Passwords to Version Control:**
   * Do not store actual passwords or resident credentials in git repositories.
   * Add populated CSV files to `.gitignore` or store them outside the git workspace.

2. **Restrict File System Permissions:**
   * While populated with plaintext temporary passwords before import, restrict read permissions:
     * **Linux / macOS:** `chmod 600 users.csv`
     * **Windows:** Ensure only administrator accounts have read permissions.

3. **Secure Deletion After Provisioning:**
   * Once imported into MongoDB (where passwords are permanently hashed with **Argon2**), securely delete or shred the temporary CSV file from the filesystem.

4. **Super Admin Authorization:**
   * Any CSV containing rows with `role: "superadmin"` **strictly requires** the `--allow-superadmin` flag when calling `import-users.js`.
   * Standard batch uploads without this flag will automatically reject all Super Admin rows with a security violation.

---

## 📋 CSV Format Specifications

```csv
registrationNumber,name,role,hostel,roomNumber,email,password
```

| Field | Description | Required? | Notes |
| :--- | :--- | :--- | :--- |
| `registrationNumber` | Unique university / staff / admin identifier | **Yes** | Alphanumeric (e.g. `24CSE001`, `WD001`, `SA001`). Duplicates are skipped. |
| `name` | Full legal or display name | **Yes** | String |
| `role` | Account privilege level | **Yes** | `student`, `caretaker`, `warden`, `superintendent`, `chiefHostelWarden`, `superadmin`. |
| `hostel` | Campus hostel block | **Yes** | e.g. `BH-1`, `GH-2` (For `superadmin`, defaults to `ADMIN_HQ` if omitted). |
| `roomNumber` | Assigned room number | Optional | Required for resident students, leave empty for staff/admins. |
| `email` | User contact email | Optional | Valid email format. |
| `password` | Initial temporary password | Conditional | **Required (min 8 chars)** for all staff and superadmins. Optional for students (who activate via `/activate`). |

---

## 🛠️ Execution Commands

```bash
# 1. Pre-flight check (Dry-run) - validates rows and DB duplicates without touching the database:
node scripts/import-users.js --file ./my-staff.csv --dry-run

# 2. Live import of students, caretakers, and wardens:
node scripts/import-users.js --file ./my-staff.csv

# 3. Pre-flight check (Dry-run) for Super Admin CSV:
node scripts/import-users.js --file ./my-superadmins.csv --dry-run --allow-superadmin

# 4. Live import of Super Admin accounts (requires explicit --allow-superadmin flag):
node scripts/import-users.js --file ./my-superadmins.csv --allow-superadmin
```
