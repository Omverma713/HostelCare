/**
 * Official Boys' Hostel Rainy/Winter Mess Menu 2026
 * Offline-first verifiable dataset extracted from official administration records.
 * Timings: ITER Campus-1 Hostel Notice dated 08/10/2026 (Effective from 09/10/2026).
 */

export const OFFICIAL_MESS_TIMINGS = {
  noticeRef: "ITER Campus-1 Hostel Notice (Dated 08/10/2026, Effective 09/10/2026)",
  workingDays: {
    label: "Working Days (Monday – Saturday)",
    breakfast: { timing: "07:00 AM – 09:15 AM", startHour: 7, startMinute: 0, endHour: 9, endMinute: 15 },
    lunch:     { timing: "12:30 PM – 02:30 PM", startHour: 12, startMinute: 30, endHour: 14, endMinute: 30 },
    snacks:    { timing: "05:45 PM – 07:30 PM", startHour: 17, startMinute: 45, endHour: 19, endMinute: 30 },
    dinner:    { timing: "08:30 PM – 10:00 PM", startHour: 20, startMinute: 30, endHour: 22, endMinute: 0 },
  },
  sundayAndHolidays: {
    label: "Sunday and Holidays",
    breakfast: { timing: "08:00 AM – 10:00 AM", startHour: 8, startMinute: 0, endHour: 10, endMinute: 0 },
    lunch:     { timing: "12:30 PM – 02:30 PM", startHour: 12, startMinute: 30, endHour: 14, endMinute: 30 },
    snacks:    { timing: "05:30 PM – 07:00 PM", startHour: 17, startMinute: 30, endHour: 19, endMinute: 0 },
    dinner:    { timing: "08:30 PM – 10:00 PM", startHour: 20, startMinute: 30, endHour: 22, endMinute: 0 },
  }
};

export const OFFICIAL_MESS_GUIDELINES = [
  "Brand Standards: Paneer and Dahi must be exclusively sourced from Pragati, Omfed, or Milky Moo.",
  "Portion Standards: Sweet 60g, Paneer 80g, Fish 120g, Chicken 150g (2 pcs), Egg 2 pcs (Lunch/Dinner) or 1 pc (Breakfast).",
  "Rice Variety: Both Usuna (parboiled) and Arua (raw) rice will be served during Lunch and Dinner.",
  "Pickle Provision: Branded sweet pickle is mandatory during Lunch and Dinner.",
  "Official Timings (ITER Campus-1 Notice effective 09/10/2026): Working Days (Mon–Sat): Breakfast 7:00 AM–9:15 AM, Lunch 12:30 PM–2:30 PM, Snacks 5:45 PM–7:30 PM, Dinner 8:30 PM–10:00 PM. Sundays & Holidays: Breakfast 8:00 AM–10:00 AM, Lunch 12:30 PM–2:30 PM, Snacks 5:30 PM–7:00 PM, Dinner 8:30 PM–10:00 PM."
];

export const DAYS_ORDER = [
  { key: 'monday',    label: 'Monday',    short: 'Mon' },
  { key: 'tuesday',   label: 'Tuesday',   short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday',  label: 'Thursday',  short: 'Thu' },
  { key: 'friday',    label: 'Friday',    short: 'Fri' },
  { key: 'saturday',  label: 'Saturday',  short: 'Sat' },
  { key: 'sunday',    label: 'Sunday',    short: 'Sun' },
];

export const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅', workingTiming: '07:00 AM – 09:15 AM', holidayTiming: '08:00 AM – 10:00 AM' },
  { key: 'lunch',     label: 'Lunch',     icon: '☀️', workingTiming: '12:30 PM – 02:30 PM', holidayTiming: '12:30 PM – 02:30 PM' },
  { key: 'snacks',    label: 'Snacks',    icon: '☕', workingTiming: '05:45 PM – 07:30 PM', holidayTiming: '05:30 PM – 07:00 PM' },
  { key: 'dinner',    label: 'Dinner',    icon: '🌙', workingTiming: '08:30 PM – 10:00 PM', holidayTiming: '08:30 PM – 10:00 PM' },
];

export const DEFAULT_MESS_SCHEDULE = {
  monday: {
    day: "monday",
    label: "Monday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "07:00 AM – 09:15 AM",
        startHour: 7,
        startMinute: 0,
        endHour: 9,
        endMinute: 15,
        items: [
          "Dahi Bada",
          "Aludam",
          "Ghuguni",
          "Onion",
          "Sew",
          "Pudina Lanka Chetney",
          "Black Salt",
          "Coffee"
        ],
        dietary: "veg",
        options: []
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Tamato Khajuri Khata",
          "Aloo Chokha with Mustard Oil"
        ],
        dietary: "mixed",
        options: [
          { name: "Fish Kalia", type: "nonveg", portion: "120g" },
          { name: "Besan Curry (O) / Sagamooga (E)", type: "veg", portion: "Standard" }
        ],
        notes: "(O) Odd week / (E) Even week rotational alternative"
      },
      snacks: {
        name: "Snacks",
        timing: "05:45 PM – 07:30 PM",
        startHour: 17,
        startMinute: 45,
        endHour: 19,
        endMinute: 30,
        items: [
          "Paneer Patties",
          "Sauce (1 pkt)",
          "Tea"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Jeera Aloo Bhaja",
          "Salad",
          "Gaja (Sweet - 60g)"
        ],
        dietary: "mixed",
        options: [
          { name: "Egg Masala", type: "egg", portion: "2 pcs" },
          { name: "Chhole Masala", type: "veg", portion: "Standard" }
        ]
      }
    }
  },

  tuesday: {
    day: "tuesday",
    label: "Tuesday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "07:00 AM – 09:15 AM",
        startHour: 7,
        startMinute: 0,
        endHour: 9,
        endMinute: 15,
        items: [
          "Uthapam (2 pcs) / Chakuli (3 pcs)",
          "Ghuguni",
          "Coconut and Ground Nut Chutney",
          "Coffee"
        ],
        dietary: "veg",
        options: []
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Moong Dal",
          "Karela Bhaja",
          "Dahi Salad"
        ],
        dietary: "mixed",
        options: [
          { name: "Chicken Aloo Kasa", type: "nonveg", portion: "150g" },
          { name: "Paneer Butter Masala", type: "veg", portion: "80g Paneer" }
        ]
      },
      snacks: {
        name: "Snacks",
        timing: "05:45 PM – 07:30 PM",
        startHour: 17,
        startMinute: 45,
        endHour: 19,
        endMinute: 30,
        items: [
          "Cake (Britannia)",
          "Fruit Juice (200 ml, Tropicana)"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Bhendi Aloo Bhaja",
          "Sriram Papad",
          "Rasgola (Sweet - 60g)"
        ],
        dietary: "mixed",
        options: [
          { name: "Egg Do Pyaza", type: "egg", portion: "2 pcs" },
          { name: "Soyabin Curry / Butadali Aloo Kakharu Curry", type: "veg", portion: "Standard" }
        ]
      }
    }
  },

  wednesday: {
    day: "wednesday",
    label: "Wednesday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "07:00 AM – 09:15 AM",
        startHour: 7,
        startMinute: 0,
        endHour: 9,
        endMinute: 15,
        items: [
          "Brown Bread (4 pcs)",
          "Jam (2 pkt)",
          "Coffee"
        ],
        dietary: "mixed",
        options: [
          { name: "Boiled Egg (1 pc)", type: "egg", portion: "1 pc" },
          { name: "Banana (1 pc)", type: "veg", portion: "1 pc" }
        ]
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Bhendi Tamato Charu",
          "Vegetable Chips"
        ],
        dietary: "mixed",
        options: [
          { name: "Fish Home Style", type: "nonveg", portion: "120g" },
          { name: "Mushroom & Green Peas Masala", type: "veg", portion: "Standard" }
        ]
      },
      snacks: {
        name: "Snacks",
        timing: "05:45 PM – 07:30 PM",
        startHour: 17,
        startMinute: 45,
        endHour: 19,
        endMinute: 30,
        items: [
          "Biscuit",
          "Milk (200 ml Amul pkt)"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Raita",
          "Campa Cola / Spice Jeera"
        ],
        dietary: "mixed",
        options: [
          { name: "Chicken (2 pcs - 150gm) Dum Biryani", type: "nonveg", portion: "150g Chicken" },
          { name: "Veg Dum Biryani with Kadai Paneer", type: "veg", portion: "80g Paneer" }
        ]
      }
    }
  },

  thursday: {
    day: "thursday",
    label: "Thursday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "07:00 AM – 09:15 AM",
        startHour: 7,
        startMinute: 0,
        endHour: 9,
        endMinute: 15,
        items: [
          "Idli (3 pcs)",
          "Bada (2 pcs)",
          "Ghuguni",
          "Coconut and Ground Nut Chutney",
          "Tea"
        ],
        dietary: "veg",
        options: []
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dalma",
          "Aloo Tamato Bharta",
          "Dahi Kadi with Pakodi"
        ],
        dietary: "mixed",
        options: [
          { name: "Egg Curry", type: "egg", portion: "2 pcs" },
          { name: "Navaratna Khurma", type: "veg", portion: "Standard" }
        ]
      },
      snacks: {
        name: "Snacks",
        timing: "05:45 PM – 07:30 PM",
        startHour: 17,
        startMinute: 45,
        endHour: 19,
        endMinute: 30,
        items: [
          "Papdi Chat",
          "Sew",
          "Dahi Pudina Chutney",
          "Onion",
          "Tea"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Veg Chips",
          "Salad",
          "Dalia Khiri (Sweet - 60g)"
        ],
        dietary: "mixed",
        options: [
          { name: "Fish Masala", type: "nonveg", portion: "120g" },
          { name: "Aloo Cauliflower Masala", type: "veg", portion: "Standard" }
        ]
      }
    }
  },

  friday: {
    day: "friday",
    label: "Friday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "07:00 AM – 09:15 AM",
        startHour: 7,
        startMinute: 0,
        endHour: 9,
        endMinute: 15,
        items: [
          "Fruit Bread (4 pcs)",
          "Jam (2 pkt)",
          "Coffee"
        ],
        dietary: "mixed",
        options: [
          { name: "Boiled Egg (1 pc)", type: "egg", portion: "1 pc" },
          { name: "Banana (1 pc)", type: "veg", portion: "1 pc" }
        ]
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Veg Biryani",
          "Raita",
          "Sriram Papad"
        ],
        dietary: "mixed",
        options: [
          { name: "Chicken Mughlai", type: "nonveg", portion: "150g" },
          { name: "Paneer Capsicum Masala", type: "veg", portion: "80g Paneer" }
        ]
      },
      snacks: {
        name: "Snacks",
        timing: "05:45 PM – 07:30 PM",
        startHour: 17,
        startMinute: 45,
        endHour: 19,
        endMinute: 30,
        items: [
          "Aloo Samosa (3 pcs)",
          "Pudina Chutney",
          "Tea"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Chilly Soya",
          "Salad",
          "Gulab Jamun (Sweet - 60g)"
        ],
        dietary: "mixed",
        options: [
          { name: "Egg Aloo Home Style", type: "egg", portion: "2 pcs" },
          { name: "Punjabi Tadka", type: "veg", portion: "Standard" }
        ]
      }
    }
  },

  saturday: {
    day: "saturday",
    label: "Saturday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "07:00 AM – 09:15 AM",
        startHour: 7,
        startMinute: 0,
        endHour: 9,
        endMinute: 15,
        items: [
          "Vegetable Upma",
          "Ghuguni",
          "Coconut and Ground Nut Chutney",
          "Coffee"
        ],
        dietary: "veg",
        options: []
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Dahi Bundi / Dahi Bhendi / Dahi Baigana",
          "Lijjat Papad"
        ],
        dietary: "mixed",
        options: [
          { name: "Fish Besar", type: "nonveg", portion: "120g" },
          { name: "Aloo Baigana Drumstick Badi Besara", type: "veg", portion: "Standard" }
        ]
      },
      snacks: {
        name: "Snacks",
        timing: "05:45 PM – 07:30 PM",
        startHour: 17,
        startMinute: 45,
        endHour: 19,
        endMinute: 30,
        items: [
          "Suji Kakera (with Nadia Pura) 3 pcs / Kachodi 3 pcs",
          "Sauce (1 pkt)",
          "Tea"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Rice (Usuna / Arua)",
          "Roti",
          "Dal",
          "Cabbage Bhaja",
          "Lijjat Papad",
          "Semie Khiri (Sweet - 60g)"
        ],
        dietary: "mixed",
        options: [
          { name: "Hyderabadi Chicken", type: "nonveg", portion: "150g" },
          { name: "Mushroom Do Pyaaz (without aloo)", type: "veg", portion: "Standard" }
        ]
      }
    }
  },

  sunday: {
    day: "sunday",
    label: "Sunday",
    meals: {
      breakfast: {
        name: "Breakfast",
        timing: "08:00 AM – 10:00 AM",
        startHour: 8,
        startMinute: 0,
        endHour: 10,
        endMinute: 0,
        items: [
          "Onion Masala Dosa (1 pc)",
          "Sambar",
          "Coconut and Ground Nut Chutney",
          "Coffee"
        ],
        dietary: "veg",
        options: []
      },
      lunch: {
        name: "Lunch",
        timing: "12:30 PM – 02:30 PM",
        startHour: 12,
        startMinute: 30,
        endHour: 14,
        endMinute: 30,
        items: [
          "Raita",
          "Sriram Papad"
        ],
        dietary: "mixed",
        options: [
          { name: "Chicken (2 pcs - 150gm) Dum Biryani with 1pc Aloo", type: "nonveg", portion: "150g Chicken" },
          { name: "Veg Dum Biryani with 1pc Aloo, Paneer Hyderabadi", type: "veg", portion: "80g Paneer" }
        ]
      },
      snacks: {
        name: "Snacks",
        timing: "05:30 PM – 07:00 PM",
        startHour: 17,
        startMinute: 30,
        endHour: 19,
        endMinute: 0,
        items: [
          "Creambun / (Sandwich, Sauce 1 pkt)",
          "Tea"
        ],
        dietary: "veg",
        options: []
      },
      dinner: {
        name: "Dinner",
        timing: "08:30 PM – 10:00 PM",
        startHour: 20,
        startMinute: 30,
        endHour: 22,
        endMinute: 0,
        items: [
          "Rice (Usuna / Arua)",
          "Dal Fry",
          "Puri (4 pcs)",
          "Cauliflower Aloo Bhaja",
          "Salad",
          "Cone Ice Cream"
        ],
        dietary: "mixed",
        options: [
          { name: "Egg Manchurian", type: "egg", portion: "2 pcs" },
          { name: "Veg Manchurian (6 pcs)", type: "veg", portion: "6 pcs" }
        ]
      }
    }
  }
};

export const DEFAULT_MESS_DATA = {
  title: "BOY'S HOSTEL RAINY/WINTER MESS MENU-2026",
  season: "Rainy / Winter Season 2026",
  hostel: "Boys' Hostel",
  version: 1,
  isPublished: true,
  schedule: DEFAULT_MESS_SCHEDULE,
  guidelines: OFFICIAL_MESS_GUIDELINES,
  timingsConfig: OFFICIAL_MESS_TIMINGS,
  lastUpdatedBy: {
    name: "Campus Administration",
    role: "chiefHostelWarden",
    registrationNumber: "ADMIN-MESS"
  },
  publishedAt: "2026-10-09T00:00:00.000Z"
};

/**
 * Standard Gazetted / Campus holidays check (ISO date format YYYY-MM-DD or MM-DD)
 */
export const CAMPUS_HOLIDAYS_MAP = {
  '01-26': 'Republic Day',
  '08-15': 'Independence Day',
  '10-02': 'Gandhi Jayanti',
  '12-25': 'Christmas',
  '2026-03-04': 'Holi',
  '2026-10-19': 'Maha Navami / Dussehra',
  '2026-10-20': 'Vijaya Dashami',
  '2026-11-08': 'Diwali',
};

export function isCampusHoliday(dateObj = new Date()) {
  const monthDay = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(5); // 'MM-DD'
  const fullDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
  return Boolean(CAMPUS_HOLIDAYS_MAP[monthDay] || CAMPUS_HOLIDAYS_MAP[fullDate]);
}

/**
 * Returns date components adjusted to the Asia/Kolkata timezone.
 */
export function getKolkataTime(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const dayOfWeek = (partMap.weekday || 'Monday').toLowerCase();
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const fullDate = `${partMap.year}-${partMap.month}-${partMap.day}`;

  return {
    dayOfWeek, // 'monday', 'tuesday', etc.
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
    isHoliday: isCampusHoliday(now),
    fullDate,
    formattedTime: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Determine currently active meal and next upcoming meal based on Asia/Kolkata clock.
 * Strictly applies Working Day vs Sunday & Holiday official windows.
 */
export function getMealStatusForDay(dayMeals, kolkataTime = getKolkataTime(), forceHoliday = null) {
  if (!dayMeals) return { activeSlot: null, nextSlot: null, statusText: 'Schedule unavailable' };

  const { totalMinutes, dayOfWeek } = kolkataTime;
  const isHolidayTiming = forceHoliday !== null ? forceHoliday : (kolkataTime.isHoliday || dayOfWeek === 'sunday');

  // Official revised timings:
  // Working days (Monday–Saturday):
  //   Breakfast: 07:00 (420) to 09:15 (555)
  //   Lunch:     12:30 (750) to 14:30 (870)
  //   Snacks:    17:45 (1065) to 19:30 (1170)
  //   Dinner:    20:30 (1230) to 22:00 (1320)
  // Sunday and Holidays:
  //   Breakfast: 08:00 (480) to 10:00 (600)
  //   Lunch:     12:30 (750) to 14:30 (870)
  //   Snacks:    17:30 (1050) to 19:00 (1140)
  //   Dinner:    20:30 (1230) to 22:00 (1320)

  const slots = isHolidayTiming
    ? [
        { key: 'breakfast', start: 8 * 60 + 0,   end: 10 * 60 + 0,  name: 'Breakfast', timing: '08:00 AM – 10:00 AM' },
        { key: 'lunch',     start: 12 * 60 + 30, end: 14 * 60 + 30, name: 'Lunch',     timing: '12:30 PM – 02:30 PM' },
        { key: 'snacks',    start: 17 * 60 + 30, end: 19 * 60 + 0,  name: 'Snacks',    timing: '05:30 PM – 07:00 PM' },
        { key: 'dinner',    start: 20 * 60 + 30, end: 22 * 60 + 0,  name: 'Dinner',    timing: '08:30 PM – 10:00 PM' },
      ]
    : [
        { key: 'breakfast', start: 7 * 60 + 0,   end: 9 * 60 + 15,  name: 'Breakfast', timing: '07:00 AM – 09:15 AM' },
        { key: 'lunch',     start: 12 * 60 + 30, end: 14 * 60 + 30, name: 'Lunch',     timing: '12:30 PM – 02:30 PM' },
        { key: 'snacks',    start: 17 * 60 + 45, end: 19 * 60 + 30, name: 'Snacks',    timing: '05:45 PM – 07:30 PM' },
        { key: 'dinner',    start: 20 * 60 + 30, end: 22 * 60 + 0,  name: 'Dinner',    timing: '08:30 PM – 10:00 PM' },
      ];

  let activeSlot = null;
  let nextSlot = null;

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (totalMinutes >= s.start && totalMinutes <= s.end) {
      activeSlot = { ...s, data: dayMeals[s.key] };
      nextSlot = (i + 1 < slots.length) ? { ...slots[i + 1], data: dayMeals[slots[i + 1].key] } : null;
      break;
    }
    if (totalMinutes < s.start) {
      nextSlot = { ...s, data: dayMeals[s.key] };
      break;
    }
  }

  // If after dinner, next meal is tomorrow's breakfast with tomorrow's proper timing
  if (!activeSlot && !nextSlot) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const curIdx = days.indexOf(dayOfWeek);
    const tomorrowDay = days[(curIdx + 1) % 7];
    let isTomorrowHoliday = tomorrowDay === 'sunday';
    if (kolkataTime.fullDate) {
      const todayDate = new Date(`${kolkataTime.fullDate}T12:00:00`);
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      if (isCampusHoliday(tomorrowDate)) isTomorrowHoliday = true;
    }

    const tomorrowBreakfast = isTomorrowHoliday
      ? { key: 'breakfast', start: 8 * 60 + 0, end: 10 * 60 + 0, name: 'Breakfast', timing: '08:00 AM – 10:00 AM' }
      : { key: 'breakfast', start: 7 * 60 + 0, end: 9 * 60 + 15, name: 'Breakfast', timing: '07:00 AM – 09:15 AM' };

    nextSlot = { ...tomorrowBreakfast, isTomorrow: true, data: dayMeals?.breakfast };
  }

  if (activeSlot) {
    const minsLeft = activeSlot.end - totalMinutes;
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    activeSlot.countdownText = h > 0 ? `Ends in ${h}h ${m}m` : `Ends in ${m}m`;
  }

  if (nextSlot) {
    if (nextSlot.isTomorrow) {
      nextSlot.countdownText = `Tomorrow at ${nextSlot.timing.split(' – ')[0]}`;
    } else {
      const minsUntil = nextSlot.start - totalMinutes;
      const h = Math.floor(minsUntil / 60);
      const m = minsUntil % 60;
      nextSlot.countdownText = h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${m}m`;
    }
  }

  return { activeSlot, nextSlot, isHolidayTiming };
}
