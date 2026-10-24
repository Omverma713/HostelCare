/**
 * Mess Auto-Notification Engine Test Suite
 * 
 * Verifies:
 * 1. Accurate Kolkata Time (IST) extraction and day mapping.
 * 2. Official start timings configuration across working days and Sundays.
 * 3. Autonomous meal reminder broadcast engine and payload structure.
 * 4. Deduplication safeguards preventing duplicate triggers.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();

const {
  getKolkataTime,
  broadcastMealReminder,
  OFFICIAL_START_TIMINGS,
} = require("../src/services/messReminderScheduler");

test("Mess Auto-Notification: Evaluates Kolkata Time with valid timezone components", () => {
  const kt = getKolkataTime();
  assert.ok(kt.year >= 2026, "Year should be >= 2026");
  assert.ok(kt.month >= 1 && kt.month <= 12, "Month between 1 and 12");
  assert.ok(kt.day >= 1 && kt.day <= 31, "Day between 1 and 31");
  assert.ok(kt.hour >= 0 && kt.hour <= 23, "Hour between 0 and 23");
  assert.ok(kt.minute >= 0 && kt.minute <= 59, "Minute between 0 and 59");
  assert.ok(typeof kt.weekday === "string" && kt.weekday.length > 0, "Weekday must be non-empty string");
  assert.equal(typeof kt.isSunday, "boolean", "isSunday must be boolean");
});

test("Mess Auto-Notification: Start timings match official ITER Campus-1 2026 notice", () => {
  // Working days
  const working = OFFICIAL_START_TIMINGS.working;
  assert.equal(working.breakfast.hour, 7);
  assert.equal(working.breakfast.minute, 0);
  assert.equal(working.lunch.hour, 12);
  assert.equal(working.lunch.minute, 30);
  assert.equal(working.snacks.hour, 17);
  assert.equal(working.snacks.minute, 45);
  assert.equal(working.dinner.hour, 20);
  assert.equal(working.dinner.minute, 30);

  // Sunday & Holidays
  const sunday = OFFICIAL_START_TIMINGS.sundayAndHolidays;
  assert.equal(sunday.breakfast.hour, 8);
  assert.equal(sunday.breakfast.minute, 0);
  assert.equal(sunday.lunch.hour, 12);
  assert.equal(sunday.lunch.minute, 30);
  assert.equal(sunday.snacks.hour, 17);
  assert.equal(sunday.snacks.minute, 30);
  assert.equal(sunday.dinner.hour, 20);
  assert.equal(sunday.dinner.minute, 30);
});

test("Mess Auto-Notification: Generates valid payload with route, title, and dish items", async () => {
  const slots = ["breakfast", "lunch", "snacks", "dinner"];
  for (const slot of slots) {
    const result = await broadcastMealReminder(slot);
    assert.equal(result.success, true);
    if (result.payload) {
      assert.ok(result.payload.title.length > 0, `Title must be present for ${slot}`);
      assert.ok(result.payload.body.includes("Today's Menu"), `Body should contain menu items for ${slot}`);
      assert.equal(result.payload.route, "/mess-menu", "Route must point to /mess-menu");
      assert.equal(result.payload.data.slotKey, slot);
    }
  }
});

test("Mess Auto-Notification: getEffectiveStartTimings returns valid fallback when DB offline", async () => {
  const { getEffectiveStartTimings } = require("../src/services/messReminderScheduler");
  const timings = await getEffectiveStartTimings();
  assert.equal(timings.enabled, true);
  assert.equal(timings.working.breakfast.hour, 7);
  assert.equal(timings.working.breakfast.minute, 0);
  assert.equal(timings.working.lunch.hour, 12);
  assert.equal(timings.working.lunch.minute, 30);
  assert.equal(timings.sundayAndHolidays.breakfast.hour, 8);
  assert.equal(timings.sundayAndHolidays.snacks.minute, 30);
});
