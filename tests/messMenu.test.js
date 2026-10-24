/**
 * Mess Menu Integration & Role Authority Test Suite
 * 
 * Verifies:
 * 1. Public Read-Only Access:
 *    - /api/v1/public/mess-menu returns 200 without any authentication headers.
 *    - Validates all 7 days (Monday - Sunday) and 4 meal slots (Breakfast, Lunch, Snacks, Dinner).
 * 2. Role-Based Access Control:
 *    - Unauthenticated writes to PUT /api/v1/mess-menu return HTTP 401.
 *    - Student accounts are rejected with HTTP 403 Forbidden when attempting to update menu.
 *    - Authorized staff roles (Super Admin, Caretaker, Warden, Superintendent) can publish updates.
 * 3. Menu Reset & Audit Trail:
 *    - Staff can restore official 2026 default menu.
 *    - An audit log entry is recorded for updates and resets.
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
const MessMenu = require("../src/models/messMenu.model");
const AuditLog = require("../src/models/auditLog.model");
const { DEFAULT_MESS_DATA } = require("../src/constants/defaultMessMenu");

let server;
let baseUrl;

const TS = Date.now();

const TEST_STAFF_SUPERADMIN = {
  registrationNumber: `SA_MESS_${TS}`,
  password: "StaffPass123!",
  name: "Mess Super Admin",
  role: "superadmin",
  hostel: "ADMIN_HQ",
  email: `sa_mess_${TS}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_STAFF_CARETAKER = {
  registrationNumber: `CT_MESS_${TS}`,
  password: "StaffPass123!",
  name: "Mess Caretaker",
  role: "caretaker",
  hostel: "BH-1",
  email: `ct_mess_${TS}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_STAFF_WARDEN = {
  registrationNumber: `WD_MESS_${TS}`,
  password: "StaffPass123!",
  name: "Mess Warden",
  role: "warden",
  hostel: "BH-1",
  email: `wd_mess_${TS}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_STAFF_SUPERINTENDENT = {
  registrationNumber: `SI_MESS_${TS}`,
  password: "StaffPass123!",
  name: "Mess Superintendent",
  role: "superintendent",
  hostel: "ADMIN_HQ",
  email: `si_mess_${TS}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const TEST_STUDENT = {
  registrationNumber: `ST_MESS_${TS}`,
  password: "StudentPass123!",
  name: "Resident Student",
  role: "student",
  hostel: "BH-1",
  email: `st_mess_${TS}@hostelcare.local`,
  isActivated: true,
  accountStatus: "active",
};

const tokens = {};

async function request(method, path, body = null, token = null) {
  const url = new URL(path, baseUrl);
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const payload = body ? JSON.stringify(body) : null;
  if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data = {};
          try {
            data = JSON.parse(raw);
          } catch (_) {
            data = { raw };
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  await connectDB();

  // Create test users
  const users = [
    TEST_STAFF_SUPERADMIN,
    TEST_STAFF_CARETAKER,
    TEST_STAFF_WARDEN,
    TEST_STAFF_SUPERINTENDENT,
    TEST_STUDENT,
  ];

  for (const u of users) {
    const hash = await Argon.hash(u.password);
    await User.create({
      ...u,
      password: hash,
    });
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Log in users to get tokens
  for (const u of users) {
    const res = await request("POST", "/api/v1/users/login", {
      registrationNumber: u.registrationNumber,
      password: u.password,
    });
    if (res.data?.token) {
      tokens[u.role] = res.data.token;
    }
  }
});

after(async () => {
  // Cleanup test users and audit logs
  const regNumbers = [
    TEST_STAFF_SUPERADMIN.registrationNumber,
    TEST_STAFF_CARETAKER.registrationNumber,
    TEST_STAFF_WARDEN.registrationNumber,
    TEST_STAFF_SUPERINTENDENT.registrationNumber,
    TEST_STUDENT.registrationNumber,
  ];
  await User.deleteMany({ registrationNumber: { $in: regNumbers } });
  await AuditLog.deleteMany({ adminRegistrationNumber: { $in: regNumbers } });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
  setTimeout(() => process.exit(0), 100);
});

test("Public API: GET /api/v1/public/mess-menu returns 200 without auth", async () => {
  const res = await request("GET", "/api/v1/public/mess-menu");
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(res.data.menu);
  assert.ok(res.data.menu.schedule);

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of days) {
    assert.ok(res.data.menu.schedule[day], `Schedule missing ${day}`);
    const meals = res.data.menu.schedule[day].meals;
    assert.ok(meals.breakfast, `${day} missing breakfast`);
    assert.ok(meals.lunch, `${day} missing lunch`);
    assert.ok(meals.snacks, `${day} missing snacks`);
    assert.ok(meals.dinner, `${day} missing dinner`);
  }

  // Verify official revised ITER notice timings on working days (Monday-Saturday)
  const monday = res.data.menu.schedule.monday.meals;
  assert.equal(monday.breakfast.startHour, 7);
  assert.equal(monday.breakfast.endHour, 9);
  assert.equal(monday.breakfast.endMinute, 15);
  assert.equal(monday.snacks.startHour, 17);
  assert.equal(monday.snacks.startMinute, 45);
  assert.equal(monday.snacks.endHour, 19);
  assert.equal(monday.snacks.endMinute, 30);
  assert.equal(monday.dinner.startHour, 20);
  assert.equal(monday.dinner.startMinute, 30);
  assert.equal(monday.dinner.endHour, 22);

  // Verify official revised Sunday timings
  const sunday = res.data.menu.schedule.sunday.meals;
  assert.equal(sunday.breakfast.startHour, 8);
  assert.equal(sunday.breakfast.endHour, 10);
  assert.equal(sunday.snacks.startHour, 17);
  assert.equal(sunday.snacks.startMinute, 30);
  assert.equal(sunday.snacks.endHour, 19);
  assert.equal(sunday.dinner.startHour, 20);
  assert.equal(sunday.dinner.startMinute, 30);
  assert.equal(sunday.dinner.endHour, 22);

  // Verify exact corrected dish name: "Mushroom Do Pyaaz (without aloo)"
  const satDinnerOptions = res.data.menu.schedule.saturday.meals.dinner.options || [];
  const mushroomDish = satDinnerOptions.find(o => o.name && o.name.toLowerCase().includes("mushroom"));
  assert.ok(mushroomDish, "Saturday dinner must contain Mushroom dish");
  assert.equal(mushroomDish.name, "Mushroom Do Pyaaz (without aloo)");
  assert.ok(!satDinnerOptions.some(o => o.name && o.name.toLowerCase().includes("pizza")), "Must not contain 'pizza'");
});

test("Security: Unauthenticated PUT /api/v1/mess-menu is rejected with 401", async () => {
  const res = await request("PUT", "/api/v1/mess-menu", {
    schedule: DEFAULT_MESS_DATA.schedule,
  });
  assert.equal(res.status, 401);
  assert.equal(res.data.success, false);
});

test("Security: Student PUT /api/v1/mess-menu is rejected with 403 Forbidden", async () => {
  const res = await request(
    "PUT",
    "/api/v1/mess-menu",
    { schedule: DEFAULT_MESS_DATA.schedule },
    tokens.student
  );
  assert.equal(res.status, 403);
  assert.equal(res.data.success, false);
  assert.match(res.data.message, /authorized staff/i);
});

test("Role Authority: Super Admin can update and publish mess menu", async () => {
  const scheduleCopy = JSON.parse(JSON.stringify(DEFAULT_MESS_DATA.schedule));
  scheduleCopy.monday.meals.breakfast.items.push("Test Admin Dish");

  const res = await request(
    "PUT",
    "/api/v1/mess-menu",
    { schedule: scheduleCopy },
    tokens.superadmin
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.menu.lastUpdatedBy.role, "superadmin");
});

test("Role Authority: Caretaker can update and publish mess menu", async () => {
  const scheduleCopy = JSON.parse(JSON.stringify(DEFAULT_MESS_DATA.schedule));
  scheduleCopy.tuesday.meals.lunch.notes = "Special seasonal update by caretaker";

  const res = await request(
    "PUT",
    "/api/v1/mess-menu",
    { schedule: scheduleCopy },
    tokens.caretaker
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.menu.lastUpdatedBy.role, "caretaker");
});

test("Role Authority: Warden can update and publish mess menu", async () => {
  const scheduleCopy = JSON.parse(JSON.stringify(DEFAULT_MESS_DATA.schedule));
  const res = await request(
    "PUT",
    "/api/v1/mess-menu",
    { schedule: scheduleCopy },
    tokens.warden
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.menu.lastUpdatedBy.role, "warden");
});

test("Role Authority: Superintendent can update and publish mess menu", async () => {
  const scheduleCopy = JSON.parse(JSON.stringify(DEFAULT_MESS_DATA.schedule));
  const res = await request(
    "PUT",
    "/api/v1/mess-menu",
    { schedule: scheduleCopy },
    tokens.superintendent
  );
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.menu.lastUpdatedBy.role, "superintendent");
});

test("Reset Operation: Staff can reset menu back to official 2026 default", async () => {
  const res = await request("POST", "/api/v1/mess-menu/reset", {}, tokens.warden);
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.match(res.data.message, /restored to official 2026/i);

  // Confirm reset menu retains official corrected dish name and revised timings
  const satDinnerOptions = res.data.menu.schedule.saturday.meals.dinner.options || [];
  const mushroomDish = satDinnerOptions.find(o => o.name && o.name.toLowerCase().includes("mushroom"));
  assert.ok(mushroomDish, "Restored Saturday dinner must contain Mushroom dish");
  assert.equal(mushroomDish.name, "Mushroom Do Pyaaz (without aloo)");
  assert.equal(res.data.menu.schedule.monday.meals.breakfast.timing, "07:00 AM – 09:15 AM");
});

test("Migration Safety: getActiveMenu preserves custom staff edits, dishes, notes, and timings", async () => {
  // Create a customized menu record mimicking an existing modified production database
  await MessMenu.deleteMany({ key: "boys_hostel_default" });
  const customizedDoc = JSON.parse(JSON.stringify(DEFAULT_MESS_DATA));
  
  // Customizations made by staff:
  customizedDoc.title = "CUSTOM WARDEN HOSTEL MENU 2026";
  customizedDoc.version = 42;
  customizedDoc.schedule.wednesday.meals.lunch.items.push("Chef Special Rasam");
  customizedDoc.schedule.wednesday.meals.lunch.options.push({
    name: "Special Paneer Tikka (Custom)",
    type: "veg",
    portion: "200g",
    note: "Staff custom portion",
  });
  // Custom timing deliberately altered by caretaker (not matching old default)
  customizedDoc.schedule.thursday.meals.breakfast.timing = "06:45 AM – 08:45 AM";
  customizedDoc.schedule.thursday.meals.breakfast.startHour = 6;
  customizedDoc.schedule.thursday.meals.breakfast.startMinute = 45;
  customizedDoc.schedule.thursday.meals.breakfast.endHour = 8;
  customizedDoc.schedule.thursday.meals.breakfast.endMinute = 45;

  // Legacy dish name and tentative timing to migrate
  customizedDoc.schedule.saturday.meals.dinner.options = [
    { name: "Chicken Roganjosh", type: "nonveg", portion: "150g" },
    { name: "Mushroom Do Pizza", type: "veg", portion: "Standard" },
  ];
  customizedDoc.schedule.monday.meals.breakfast.timing = "07:30 AM – 09:30 AM";
  customizedDoc.schedule.monday.meals.breakfast.startHour = 7;
  customizedDoc.schedule.monday.meals.breakfast.startMinute = 30;
  customizedDoc.schedule.monday.meals.breakfast.endHour = 9;
  customizedDoc.schedule.monday.meals.breakfast.endMinute = 30;

  await MessMenu.create({
    key: "boys_hostel_default",
    ...customizedDoc,
  });

  // Execute migration via getActiveMenu()
  const migrated = await MessMenu.getActiveMenu();

  // 1. Verify ONLY intended legacy dish name was migrated
  const satOptions = migrated.schedule.saturday.meals.dinner.options;
  const mushroomOpt = satOptions.find(o => o.name.includes("Mushroom"));
  assert.equal(mushroomOpt.name, "Mushroom Do Pyaaz (without aloo)");

  // 2. Verify outdated baseline timing was migrated
  assert.equal(migrated.schedule.monday.meals.breakfast.timing, "07:00 AM – 09:15 AM");
  assert.equal(migrated.schedule.monday.meals.breakfast.endMinute, 15);

  // 3. Verify ALL custom staff edits and metadata are PRESERVED
  assert.equal(migrated.title, "CUSTOM WARDEN HOSTEL MENU 2026");
  assert.equal(migrated.version, 42);
  assert.ok(migrated.schedule.wednesday.meals.lunch.items.includes("Chef Special Rasam"));
  const customOption = migrated.schedule.wednesday.meals.lunch.options.find(o => o.name.includes("Special Paneer"));
  assert.ok(customOption);
  assert.equal(customOption.portion, "200g");
  assert.equal(customOption.note, "Staff custom portion");

  // 4. Verify custom staff timing was NOT overwritten
  assert.equal(migrated.schedule.thursday.meals.breakfast.timing, "06:45 AM – 08:45 AM");
  assert.equal(migrated.schedule.thursday.meals.breakfast.startHour, 6);
});

test("Migration Idempotency: Repeated calls to getActiveMenu do not repeatedly save or alter records", async () => {
  const doc1 = await MessMenu.getActiveMenu();
  const updatedAt1 = doc1.updatedAt.getTime();

  // Small delay to ensure timestamp would advance if an unnecessary save occurred
  await new Promise(r => setTimeout(r, 50));

  const doc2 = await MessMenu.getActiveMenu();
  const updatedAt2 = doc2.updatedAt.getTime();

  const doc3 = await MessMenu.getActiveMenu();
  const updatedAt3 = doc3.updatedAt.getTime();

  assert.equal(updatedAt1, updatedAt2, "Second call must not touch updatedAt");
  assert.equal(updatedAt2, updatedAt3, "Third call must not touch updatedAt");
});

test("Concurrency & Race Safety: Simultaneous getActiveMenu requests execute cleanly without errors", async () => {
  const parallelCalls = Array.from({ length: 10 }, () => MessMenu.getActiveMenu());
  const results = await Promise.all(parallelCalls);

  assert.equal(results.length, 10);
  for (const doc of results) {
    assert.equal(doc.key, "boys_hostel_default");
    assert.equal(doc.schedule.monday.meals.breakfast.timing, "07:00 AM – 09:15 AM");
  }
});

test("Security & Request Tampering: Student cannot bypass role check with request-body fields", async () => {
  // Student attempts privilege escalation by providing 'role: superadmin' in body
  const res = await request(
    "PUT",
    "/api/v1/mess-menu",
    {
      role: "superadmin",
      user: { role: "superadmin", id: "fake_admin_id" },
      schedule: DEFAULT_MESS_DATA.schedule,
    },
    tokens.student
  );
  assert.equal(res.status, 403, "Student must be rejected with 403 Forbidden");
  assert.equal(res.data.success, false);

  // Student attempts reset
  const resetRes = await request(
    "POST",
    "/api/v1/mess-menu/reset",
    { role: "superadmin" },
    tokens.student
  );
  assert.equal(resetRes.status, 403);
});

test("Security: Unauthenticated reset request is rejected with 401", async () => {
  const res = await request("POST", "/api/v1/mess-menu/reset", {});
  assert.equal(res.status, 401);
});

test("Audit Trail: Menu updates and resets record complete, untampered audit log entries", async () => {
  const scheduleCopy = JSON.parse(JSON.stringify(DEFAULT_MESS_DATA.schedule));
  scheduleCopy.friday.meals.lunch.notes = "Special audit test edit";

  const updateRes = await request(
    "PUT",
    "/api/v1/mess-menu",
    { schedule: scheduleCopy },
    tokens.warden
  );
  assert.equal(updateRes.status, 200);

  // Verify AuditLog for UPDATE
  const updateLog = await AuditLog.findOne({
    action: "MESS_MENU_UPDATED",
    adminRegistrationNumber: TEST_STAFF_WARDEN.registrationNumber,
  }).sort({ createdAt: -1 });

  assert.ok(updateLog, "AuditLog entry for MESS_MENU_UPDATED must exist");
  assert.equal(updateLog.targetType, "MESS_MENU");
  assert.equal(updateLog.adminRegistrationNumber, TEST_STAFF_WARDEN.registrationNumber);
  assert.ok(updateLog.summary.includes("warden"));

  // Trigger RESET by Superadmin
  const resetRes = await request("POST", "/api/v1/mess-menu/reset", {}, tokens.superadmin);
  assert.equal(resetRes.status, 200);

  // Verify AuditLog for RESET
  const resetLog = await AuditLog.findOne({
    action: "MESS_MENU_RESET",
    adminRegistrationNumber: TEST_STAFF_SUPERADMIN.registrationNumber,
  }).sort({ createdAt: -1 });

  assert.ok(resetLog, "AuditLog entry for MESS_MENU_RESET must exist");
  assert.equal(resetLog.targetType, "MESS_MENU");
  assert.equal(resetLog.adminRegistrationNumber, TEST_STAFF_SUPERADMIN.registrationNumber);
  assert.ok(resetLog.summary.includes("superadmin"));
});

test("Timing, Holiday & Countdown Telemetry Evaluator Tests", async () => {
  const { getMealStatusForDay, isCampusHoliday } = await import("../frontend/src/constants/messMenuData.js");
  const testMeals = DEFAULT_MESS_DATA.schedule.monday.meals;

  // 1. Working Day at 07:15 AM (Breakfast active: 07:00 - 09:15)
  const timeWorkingBreakfast = {
    dayOfWeek: "monday",
    hour: 7,
    minute: 15,
    totalMinutes: 7 * 60 + 15,
    isHoliday: false,
  };
  const status1 = getMealStatusForDay(testMeals, timeWorkingBreakfast, false);
  assert.equal(status1.activeSlot?.key, "breakfast");
  assert.equal(status1.activeSlot?.countdownText, "Ends in 2h 0m");
  assert.equal(status1.nextSlot?.key, "lunch");

  // 2. Working Day at 09:20 AM (Breakfast ended at 09:15, Lunch starts at 12:30)
  const timeWorkingMorningBreak = {
    dayOfWeek: "monday",
    hour: 9,
    minute: 20,
    totalMinutes: 9 * 60 + 20,
    isHoliday: false,
  };
  const status2 = getMealStatusForDay(testMeals, timeWorkingMorningBreak, false);
  assert.equal(status2.activeSlot, null);
  assert.equal(status2.nextSlot?.key, "lunch");
  assert.equal(status2.nextSlot?.countdownText, "Starts in 3h 10m");

  // 3. Sunday at 07:15 AM (Sunday breakfast starts at 08:00 AM)
  const timeSundayEarly = {
    dayOfWeek: "sunday",
    hour: 7,
    minute: 15,
    totalMinutes: 7 * 60 + 15,
    isHoliday: false,
  };
  const status3 = getMealStatusForDay(testMeals, timeSundayEarly, true);
  assert.equal(status3.activeSlot, null);
  assert.equal(status3.nextSlot?.key, "breakfast");
  assert.equal(status3.nextSlot?.timing, "08:00 AM – 10:00 AM");
  assert.equal(status3.nextSlot?.countdownText, "Starts in 45m");

  // 4. Saturday late night at 22:30 PM (Tomorrow is Sunday: breakfast starts at 08:00 AM)
  const timeSatNight = {
    dayOfWeek: "saturday",
    hour: 22,
    minute: 30,
    totalMinutes: 22 * 60 + 30,
    isHoliday: false,
  };
  const status4 = getMealStatusForDay(testMeals, timeSatNight, false);
  assert.equal(status4.activeSlot, null);
  assert.equal(status4.nextSlot?.key, "breakfast");
  assert.equal(status4.nextSlot?.isTomorrow, true);
  assert.equal(status4.nextSlot?.timing, "08:00 AM – 10:00 AM");
  assert.equal(status4.nextSlot?.countdownText, "Tomorrow at 08:00 AM");

  // 5. Sunday late night at 22:30 PM (Tomorrow is Monday: breakfast starts at 07:00 AM)
  const timeSunNight = {
    dayOfWeek: "sunday",
    hour: 22,
    minute: 30,
    totalMinutes: 22 * 60 + 30,
    isHoliday: false,
  };
  const status5 = getMealStatusForDay(testMeals, timeSunNight, true);
  assert.equal(status5.activeSlot, null);
  assert.equal(status5.nextSlot?.key, "breakfast");
  assert.equal(status5.nextSlot?.isTomorrow, true);
  assert.equal(status5.nextSlot?.timing, "07:00 AM – 09:15 AM");
  assert.equal(status5.nextSlot?.countdownText, "Tomorrow at 07:00 AM");

  // 6. Gazetted holiday detection check
  const dussehraDate = new Date("2026-10-19T10:00:00Z");
  assert.equal(isCampusHoliday(dussehraDate), true, "2026-10-19 Dussehra must be recognized as campus holiday");

  const normalDate = new Date("2026-10-21T10:00:00Z");
  assert.equal(isCampusHoliday(normalDate), false, "2026-10-21 must not be a campus holiday");
});

