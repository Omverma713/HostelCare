const mongoose = require("mongoose");
const { DEFAULT_MESS_DATA } = require("../constants/defaultMessMenu");

const mealOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["veg", "nonveg", "egg"],
      default: "veg",
    },
    portion: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const mealSlotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    timing: { type: String, required: true },
    startHour: { type: Number, required: true, min: 0, max: 23 },
    startMinute: { type: Number, required: true, min: 0, max: 59 },
    endHour: { type: Number, required: true, min: 0, max: 23 },
    endMinute: { type: Number, required: true, min: 0, max: 59 },
    items: [{ type: String, trim: true }],
    dietary: {
      type: String,
      enum: ["veg", "nonveg", "egg", "mixed"],
      default: "veg",
    },
    options: [mealOptionSchema],
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const dayScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    label: { type: String, required: true },
    meals: {
      breakfast: mealSlotSchema,
      lunch: mealSlotSchema,
      snacks: mealSlotSchema,
      dinner: mealSlotSchema,
    },
  },
  { _id: false }
);

const messMenuSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "boys_hostel_default",
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: "BOY'S HOSTEL RAINY/WINTER MESS MENU-2026",
    },
    season: {
      type: String,
      default: "Rainy / Winter Season 2026",
    },
    hostel: {
      type: String,
      default: "Boys' Hostel",
    },
    version: {
      type: Number,
      default: 1,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    schedule: {
      monday: dayScheduleSchema,
      tuesday: dayScheduleSchema,
      wednesday: dayScheduleSchema,
      thursday: dayScheduleSchema,
      friday: dayScheduleSchema,
      saturday: dayScheduleSchema,
      sunday: dayScheduleSchema,
    },
    guidelines: [{ type: String }],
    lastUpdatedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      registrationNumber: { type: String, default: "ADMIN-MESS" },
      name: { type: String, default: "Campus Administration" },
      role: { type: String, default: "chiefHostelWarden" },
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Fetch current active published menu.
 * Auto-seeds default official 2026 menu if DB collection is uninitialized.
 */
messMenuSchema.statics.getActiveMenu = async function () {
  let doc = await this.findOne({ key: "boys_hostel_default" });
  if (!doc) {
    doc = await this.create({
      key: "boys_hostel_default",
      ...DEFAULT_MESS_DATA,
    });
    return doc;
  }

  // Non-destructive synchronization for dish-name corrections and timing sync
  let modified = false;
  if (doc.schedule?.saturday?.meals?.dinner?.options) {
    const opts = doc.schedule.saturday.meals.dinner.options;
    for (const opt of opts) {
      if (
        opt.name &&
        (opt.name.includes("Pyaza") ||
          opt.name.includes("Pizza") ||
          (opt.name.toLowerCase().includes("mushroom") &&
            !opt.name.includes("without aloo")))
      ) {
        opt.name = "Mushroom Do Pyaaz (without aloo)";
        modified = true;
      }
    }
  }

  // Non-destructive timing migration: sync legacy tentative timings to official ITER notice (08/10/2026)
  const workingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (const day of workingDays) {
    const b = doc.schedule?.[day]?.meals?.breakfast;
    if (b && b.timing === "07:30 AM – 09:30 AM") {
      b.timing = "07:00 AM – 09:15 AM";
      b.startHour = 7;
      b.startMinute = 0;
      b.endHour = 9;
      b.endMinute = 15;
      modified = true;
    }
    const snk = doc.schedule?.[day]?.meals?.snacks;
    if (snk && snk.timing === "04:30 PM – 06:00 PM") {
      snk.timing = "05:45 PM – 07:30 PM";
      snk.startHour = 17;
      snk.startMinute = 45;
      snk.endHour = 19;
      snk.endMinute = 30;
      modified = true;
    }
    const din = doc.schedule?.[day]?.meals?.dinner;
    if (din && din.timing === "07:30 PM – 09:30 PM") {
      din.timing = "08:30 PM – 10:00 PM";
      din.startHour = 20;
      din.startMinute = 30;
      din.endHour = 22;
      din.endMinute = 0;
      modified = true;
    }
  }

  const sunB = doc.schedule?.sunday?.meals?.breakfast;
  if (sunB && sunB.timing === "07:30 AM – 09:30 AM") {
    sunB.timing = "08:00 AM – 10:00 AM";
    sunB.startHour = 8;
    sunB.startMinute = 0;
    sunB.endHour = 10;
    sunB.endMinute = 0;
    modified = true;
  }
  const sunSnk = doc.schedule?.sunday?.meals?.snacks;
  if (sunSnk && sunSnk.timing === "04:30 PM – 06:00 PM") {
    sunSnk.timing = "05:30 PM – 07:00 PM";
    sunSnk.startHour = 17;
    sunSnk.startMinute = 30;
    sunSnk.endHour = 19;
    sunSnk.endMinute = 0;
    modified = true;
  }
  const sunDin = doc.schedule?.sunday?.meals?.dinner;
  if (sunDin && sunDin.timing === "07:30 PM – 09:30 PM") {
    sunDin.timing = "08:30 PM – 10:00 PM";
    sunDin.startHour = 20;
    sunDin.startMinute = 30;
    sunDin.endHour = 22;
    sunDin.endMinute = 0;
    modified = true;
  }

  if (modified) {
    doc.markModified("schedule");
    try {
      await doc.save();
    } catch (saveErr) {
      // In case of concurrent execution racing on save, reload the freshly committed document
      const freshDoc = await this.findOne({ key: "boys_hostel_default" });
      if (freshDoc) return freshDoc;
      throw saveErr;
    }
  }

  return doc;
};

module.exports = mongoose.model("MessMenu", messMenuSchema);
