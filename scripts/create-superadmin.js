/**
 * Secure Super Admin Bootstrap CLI Script
 * 
 * Usage:
 *   node scripts/create-superadmin.js <registrationNumber> <password> [name] [hostel] [email]
 * Or via environment variables:
 *   SUPERADMIN_REGISTRATION_NUMBER=... SUPERADMIN_PASSWORD=... node scripts/create-superadmin.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Argon = require("argon2");
const User = require("../src/models/user.model");
const connectDB = require("../src/db/db");

async function bootstrapSuperAdmin() {
  const args = process.argv.slice(2);
  const registrationNumber = args[0] || process.env.SUPERADMIN_REGISTRATION_NUMBER;
  const password = args[1] || process.env.SUPERADMIN_PASSWORD;
  const name = args[2] || process.env.SUPERADMIN_NAME || "System Super Admin";
  const hostel = args[3] || process.env.SUPERADMIN_HOSTEL || "ADMIN_HQ";
  const email = args[4] || process.env.SUPERADMIN_EMAIL || process.env.ADMIN_EMAIL || "superadmin@hostelcare.local";

  if (!registrationNumber || !password) {
    console.error("❌ Usage: node scripts/create-superadmin.js <registrationNumber> <password> [name] [hostel] [email]");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ Security error: Super Admin password must be at least 8 characters long.");
    process.exit(1);
  }

  await connectDB();

  try {
    const existingUser = await User.findOne({ registrationNumber });
    const hashedPassword = await Argon.hash(password);

    if (existingUser) {
      existingUser.role = "superadmin";
      existingUser.accountStatus = "active";
      existingUser.isActivated = true;
      existingUser.password = hashedPassword;
      existingUser.name = name || existingUser.name;
      existingUser.email = email || existingUser.email;
      existingUser.hostel = hostel || existingUser.hostel;
      await existingUser.save();
      console.log(`✅ Existing user '${registrationNumber}' promoted to 'superadmin' with updated credentials.`);
    } else {
      await User.create({
        registrationNumber,
        name,
        password: hashedPassword,
        role: "superadmin",
        hostel,
        email,
        isActivated: true,
        accountStatus: "active",
      });
      console.log(`✅ New Super Admin account '${registrationNumber}' created successfully.`);
    }

    console.log(`🔒 Super Admin Role: superadmin`);
    console.log(`🔒 Account Status: active`);
    console.log(`🔒 Login ready.`);
  } catch (err) {
    console.error("❌ Failed to bootstrap Super Admin:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

bootstrapSuperAdmin();
