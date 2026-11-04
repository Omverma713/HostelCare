/**
 * Mess Menu Dish Prioritization Test Suite
 *
 * Verifies that auto meal notifications place main dishes (sabjis, curries, protein options)
 * before staples (rice, roti, dal) and sides (papad, salad).
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  prioritizeMealDishes,
  formatPrioritizedMealMenu,
} = require("../src/services/messReminderScheduler");

const { DEFAULT_MESS_DATA } = require("../src/constants/defaultMessMenu");

test("Mess Dish Prioritization: Monday Lunch puts Fish Kalia / Besan Curry before Rice & Roti", () => {
  const meal = DEFAULT_MESS_DATA.schedule.monday.meals.lunch;
  const dishes = prioritizeMealDishes(meal);
  const formatted = formatPrioritizedMealMenu(meal, 4);

  // Options must be first
  assert.ok(dishes[0].includes("Fish Kalia"));
  // Rice and Roti must come after main sabjis/khata/chokha
  const riceIndex = dishes.findIndex((d) => d.toLowerCase().includes("rice"));
  const chokhaIndex = dishes.findIndex((d) => d.toLowerCase().includes("aloo chokha"));
  assert.ok(chokhaIndex < riceIndex, "Aloo Chokha should appear before Rice");
  assert.ok(formatted.startsWith("Fish Kalia"), "Formatted text starts with Fish Kalia");
});

test("Mess Dish Prioritization: Tuesday Lunch prioritizes Chicken Aloo Kasa / Paneer Butter Masala", () => {
  const meal = DEFAULT_MESS_DATA.schedule.tuesday.meals.lunch;
  const dishes = prioritizeMealDishes(meal);
  const formatted = formatPrioritizedMealMenu(meal, 4);

  assert.ok(dishes[0].includes("Chicken Aloo Kasa"));
  assert.ok(dishes[0].includes("Paneer Butter Masala"));
  assert.ok(formatted.startsWith("Chicken Aloo Kasa / Paneer Butter Masala"));

  const karelaIndex = dishes.findIndex((d) => d.toLowerCase().includes("karela"));
  const riceIndex = dishes.findIndex((d) => d.toLowerCase().includes("rice"));
  assert.ok(karelaIndex < riceIndex, "Karela Bhaja should appear before Rice");
});

test("Mess Dish Prioritization: Wednesday Dinner prioritizes Dum Biryani options over sides", () => {
  const meal = DEFAULT_MESS_DATA.schedule.wednesday.meals.dinner;
  const dishes = prioritizeMealDishes(meal);
  const formatted = formatPrioritizedMealMenu(meal, 4);

  assert.ok(dishes[0].includes("Dum Biryani"));
  assert.ok(formatted.startsWith("Chicken (2 pcs - 150gm) Dum Biryani / Veg Dum Biryani"));
});

test("Mess Dish Prioritization: Sunday Dinner places Manchurian and Cauliflower Bhaja before Rice/Dal/Puri", () => {
  const meal = DEFAULT_MESS_DATA.schedule.sunday.meals.dinner;
  const dishes = prioritizeMealDishes(meal);

  assert.ok(dishes[0].includes("Manchurian"));
  const cauliflowerIndex = dishes.findIndex((d) => d.toLowerCase().includes("cauliflower"));
  const riceIndex = dishes.findIndex((d) => d.toLowerCase().includes("rice"));
  assert.ok(cauliflowerIndex < riceIndex, "Cauliflower Bhaja should appear before Rice");
});

test("Mess Dish Prioritization: Gracefully handles empty, missing, or malformed meals", () => {
  assert.deepEqual(prioritizeMealDishes(null), []);
  assert.deepEqual(prioritizeMealDishes({}), []);
  assert.equal(formatPrioritizedMealMenu(null), "Special menu items");
  assert.equal(formatPrioritizedMealMenu({ items: [] }), "Special menu items");
});

