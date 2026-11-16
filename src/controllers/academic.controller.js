const { AcademicConfig, UserTimetable, defaultAcademicCalendar, defaultHolidays, defaultCurriculum, defaultWeeklyTimetable } = require("../models/academic.model");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

/**
 * Helper to optionally extract logged-in user from Authorization header
 */
async function getOptionalUser(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const user = await User.findById(decoded.id).select("_id role registrationNumber name");
    return user;
  } catch (err) {
    return null;
  }
}

/**
 * GET /api/v1/academics/overview
 */
const getAcademicOverview = async (req, res) => {
  try {
    const config = await AcademicConfig.getEffectiveConfig();
    const user = await getOptionalUser(req);

    let userTimetable = null;
    if (user) {
      userTimetable = await UserTimetable.findOne({ userId: user._id });
      if (userTimetable && Array.isArray(userTimetable.days)) {
        const cleanedDays = sanitizeAndMergeDays(userTimetable.days, userTimetable.classroom);
        const prevJson = JSON.stringify(userTimetable.days);
        const nextJson = JSON.stringify(cleanedDays);
        if (prevJson !== nextJson) {
          userTimetable.days = cleanedDays;
          await userTimetable.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        institution: config.institution || "ITER | SIKSHA 'O' ANUSANDHAN",
        academicYear: config.academicYear || "2026-27",
        calendar: config.academicCalendar || defaultAcademicCalendar,
        holidays: config.holidays2026 || defaultHolidays,
        curriculum: config.curriculum || defaultCurriculum,
        examRadar: config.examRadar || {},
        defaultTimetable: config.defaultTimetable || {
          section: "CSE Section 5A",
          classroom: "Room 304 (C-Block)",
          days: defaultWeeklyTimetable,
        },
        userTimetable: userTimetable || null,
        activeTimetable: userTimetable || config.defaultTimetable,
      },
    });
  } catch (error) {
    console.error("[ACADEMIC_GET_OVERVIEW_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load academic schedule and curriculum",
      error: error.message,
    });
  }
};

/**
 * GET /api/v1/academics/timetable
 */
const getUserTimetable = async (req, res) => {
  try {
    const userId = req.user._id;
    let timetable = await UserTimetable.findOne({ userId });

    if (!timetable) {
      const config = await AcademicConfig.getEffectiveConfig();
      return res.status(200).json({
        success: true,
        isCustom: false,
        timetable: config.defaultTimetable,
      });
    }

    if (timetable && Array.isArray(timetable.days)) {
      const cleanedDays = sanitizeAndMergeDays(timetable.days, timetable.classroom);
      const prevJson = JSON.stringify(timetable.days);
      const nextJson = JSON.stringify(cleanedDays);
      if (prevJson !== nextJson) {
        timetable.days = cleanedDays;
        await timetable.save();
      }
    }

    return res.status(200).json({
      success: true,
      isCustom: true,
      timetable,
    });
  } catch (error) {
    console.error("[ACADEMIC_GET_TIMETABLE_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load timetable",
      error: error.message,
    });
  }
};

/**
 * PUT /api/v1/academics/timetable
 */
const saveUserTimetable = async (req, res) => {
  try {
    const userId = req.user._id;
    const { section, classroom, days } = req.body;

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable: days array with slots is required",
      });
    }

    const targetRoom = classroom || "Room 304";
    const cleanedDays = sanitizeAndMergeDays(days, targetRoom);

    const updated = await UserTimetable.findOneAndUpdate(
      { userId },
      {
        userId,
        registrationNumber: req.user.registrationNumber || "",
        section: section || "CSE Section 5A",
        classroom: targetRoom,
        days: cleanedDays,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Timetable updated successfully",
      timetable: updated,
    });
  } catch (error) {
    console.error("[ACADEMIC_SAVE_TIMETABLE_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save personalized timetable",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/v1/academics/timetable
 */
const resetUserTimetable = async (req, res) => {
  try {
    const userId = req.user._id;
    await UserTimetable.findOneAndDelete({ userId });
    const config = await AcademicConfig.getEffectiveConfig();

    return res.status(200).json({
      success: true,
      message: "Personalized timetable reset to institute default",
      timetable: config.defaultTimetable,
    });
  } catch (error) {
    console.error("[ACADEMIC_RESET_TIMETABLE_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset timetable",
      error: error.message,
    });
  }
};

/**
 * PUT /api/v1/academics/exam-radar
 */
const updateExamRadar = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only SuperAdmins can update Exam Radar configuration.",
      });
    }

    const {
      title,
      status,
      statusBadgeText,
      tentativeDateRange,
      notice,
      publishedDatesheet,
      subjectSyllabus,
    } = req.body;

    const config = await AcademicConfig.getEffectiveConfig();

    if (title !== undefined) config.examRadar.title = title;
    if (status !== undefined) {
      config.examRadar.status = status;
      if (status === "yet_to_be_decided") {
        config.examRadar.statusBadgeText = statusBadgeText || "Yet to be Decided";
      } else if (status === "announced") {
        config.examRadar.statusBadgeText = statusBadgeText || "Datesheet Announced";
      } else if (status === "active") {
        config.examRadar.statusBadgeText = statusBadgeText || "Exams Ongoing";
      } else if (status === "completed") {
        config.examRadar.statusBadgeText = statusBadgeText || "Exams Completed";
      }
    }
    if (statusBadgeText !== undefined) config.examRadar.statusBadgeText = statusBadgeText;
    if (tentativeDateRange !== undefined) config.examRadar.tentativeDateRange = tentativeDateRange;
    if (notice !== undefined) config.examRadar.notice = notice;
    if (Array.isArray(publishedDatesheet)) config.examRadar.publishedDatesheet = publishedDatesheet;
    if (Array.isArray(subjectSyllabus)) {
      config.examRadar.subjectSyllabus = subjectSyllabus.map((s) => ({
        ...s,
        lastUpdatedBy: user.name || "SuperAdmin",
        updatedAt: new Date(),
      }));
    }

    await config.save();

    return res.status(200).json({
      success: true,
      message: "Exam Radar settings updated successfully",
      examRadar: config.examRadar,
    });
  } catch (error) {
    console.error("[ACADEMIC_UPDATE_EXAM_RADAR_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Exam Radar settings",
      error: error.message,
    });
  }
};

// ─── TIMETABLE OPTIMIZATION & SANITIZATION HELPERS ─────────────────────────

/**
 * Converts formatted 12-hour or natural time strings to minutes from midnight
 * Examples: "09:00 AM" -> 540, "12:00 NOON" -> 720, "12:00 PM" -> 720, "01:00 PM" -> 780
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim().toUpperCase();
  const clean = str.replace(/NOON/i, "PM").replace(/MIDNIGHT/i, "AM");
  const m = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || "0", 10);
  let meridiem = m[3] ? m[3].toUpperCase() : null;
  if (!meridiem) {
    if (h >= 8 && h <= 11) meridiem = "AM";
    else if (h === 12 || (h >= 1 && h <= 7)) meridiem = "PM";
    else meridiem = "AM";
  }
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

/**
 * Checks if a slot represents an empty / dummy / free period
 * (e.g. 'X', 'XX', '-', 'NIL', 'FREE', 'NO CLASS', 'RECESS', 'BREAK', 'LUNCH', etc.)
 */
function isDummySlot(slot) {
  if (!slot) return true;
  const name = String(slot.subjectName || "").trim().toLowerCase();
  const code = String(slot.subjectCode || "").trim().toLowerCase();
  const start = String(slot.startTime || "").trim().toUpperCase();
  const end = String(slot.endTime || "").trim().toUpperCase();

  // 1. Invalid time slots (e.g. 50:00 PM or 00:00 AM or 00:00 PM)
  if (/^(5\d|6\d|7\d|8\d|9\d|00):/i.test(start) || /^(5\d|6\d|7\d|8\d|9\d):/i.test(end)) {
    return true;
  }

  // 2. Day names appearing as lecture subjects (e.g. "TUESDAY WEDNESDAY THURSDAY SATURDAY", "DAY FRIDAY")
  const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const containsMultipleDays = dayNames.filter((d) => name.includes(d)).length >= 2;
  if (containsMultipleDays || /^day\s+(monday|tuesday|wednesday|thursday|friday|saturday)/i.test(name)) {
    return true;
  }

  // 3. Raw OCR junk markers
  if (/time\s*slots?/i.test(name) || /room\s*no/i.test(name) || /faculty/i.test(name)) {
    return true;
  }

  // 4. Dummy Words
  const dummyWords = [
    "x", "xx", "xxx", "xxxx", "-", "--", "---", ".", "nil", "na", "n/a", "none", "null", "undefined",
    "free", "free period", "off", "no class", "noclass", "empty", "vacant", "recess", "break",
    "lunch", "lunch break", "tea break", "recess break", "interval", "leisure", "library", "self study"
  ];

  if (!name || name === "x" || name === "-" || name === "." || name === "_" || name === "nil") return true;
  if (dummyWords.includes(name)) return true;
  if (dummyWords.includes(code) && (name === "academic lecture" || name === "subject class" || dummyWords.includes(name))) return true;
  if (/^x+$/i.test(name) || /^[-_.]+$/.test(name)) return true;
  if (/^x+$/i.test(code) && (name.length <= 2 || dummyWords.includes(name))) return true;

  // 5. Raw OCR lines starting with time digits like "11..00noon", "9..00am", "8..00am" or containing multiple x's
  if (/^\d{1,2}\.?\.\d{2}\s*(am|pm|noon)/i.test(name)) return true;
  if (/\b(x\s*){2,}\b/i.test(name)) return true;

  return false;
}

/**
 * Checks if two slots represent the same course/subject
 */
function areSlotsSameSubject(s1, s2) {
  if (!s1 || !s2) return false;
  const code1 = String(s1.subjectCode || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const code2 = String(s2.subjectCode || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const name1 = String(s1.subjectName || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const name2 = String(s2.subjectName || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. If both slots have meaningful course codes (at least 3 characters), they MUST match exactly
  if (code1.length >= 3 && code2.length >= 3) {
    return code1 === code2;
  }

  // 2. Otherwise, require exact match on normalized subject names
  if (name1.length >= 3 && name2.length >= 3) {
    return name1 === name2;
  }

  return false;
}

// ─── FACULTY NAME FORMATTER (ZERO DUPLICATE PREFIXES) ────────────────────────
function formatFacultyName(faculty) {
  if (!faculty) return "";
  let clean = String(faculty).trim();
  if (!clean || /^(faculty\s*member|tba|n\/a|-|null|undefined)$/i.test(clean)) {
    return "";
  }

  // Preserve Dr. if present in original text
  const isDoctor = /\bdr\.?\b/i.test(clean);

  // Common OCR typo corrections
  clean = clean
    .replace(/SKUIT/i, "Srijit")
    .replace(/SRUIT/i, "Srijit");

  // Strip ALL repeated occurrences of "Prof.", "Professor", "Dr.", "Dr", spaces, dots
  clean = clean.replace(/^(?:prof(?:essor)?\.?|dr\.?|\s+)+/gi, "").trim();
  clean = clean.replace(/\b(?:prof(?:essor)?\.?|dr\.?)\b/gi, "").trim();
  clean = clean.replace(/\s+/g, " ").trim();

  if (!clean || clean.length < 2) return "";

  // Title Case if all uppercase or all lowercase
  if (/^[A-Z\s.-]+$/.test(clean) || /^[a-z\s.-]+$/.test(clean)) {
    clean = clean
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // Prepend honorific EXACTLY ONCE
  return isDoctor ? `Dr. ${clean}` : `Prof. ${clean}`;
}

// ─── ZERO-HARDCODING SLOT ENRICHMENT ─────────────────────────────────────────
// Respects the user's custom schedule 100%: no forced catalogs or foreign teachers.
function enrichSlotDetails(slot) {
  if (!slot) return slot;
  const sName = String(slot.subjectName || "").trim();
  const sCode = String(slot.subjectCode || "").trim();
  const isLab = slot.type === "lab" || /LAB/i.test(sName) || /LAB/i.test(sCode);
  if (isLab) slot.type = "lab";

  // Clean faculty name without duplicate prefixes; preserve user's own data
  slot.faculty = formatFacultyName(slot.faculty);

  return slot;
}

/**
 * Cleans timetable slots:
 * 1. Discards empty/free slots ('X', 'NIL', 'BREAK', etc.)
 * 2. Enriches subject full names and teacher assignments from curriculum catalog
 * 3. Merges contiguous slots of the same subject/lab (e.g. 2-hr or 3-hr lab practicals)
 * 4. Normalizes IDs
 */
function sanitizeAndMergeDays(daysList, defaultRoom = "Campus Hall") {
  if (!Array.isArray(daysList)) return [];

  return daysList.map((dayObj) => {
    const day = dayObj.day;
    const rawSlots = Array.isArray(dayObj.slots) ? dayObj.slots : [];

    // 1. Filter out all dummy slots (X, free periods, etc.)
    const realSlots = rawSlots.filter((s) => !isDummySlot(s));

    // 2. Sort slots chronologically if times are parseable
    realSlots.sort((a, b) => {
      const tA = timeToMinutes(a.startTime);
      const tB = timeToMinutes(b.startTime);
      if (tA !== null && tB !== null) return tA - tB;
      return 0;
    });

    // 3. Intelligently merge contiguous slots (e.g. 2-hour labs or consecutive lectures) & enrich
    const merged = [];
    for (let i = 0; i < realSlots.length; i++) {
      const current = enrichSlotDetails({
        id: realSlots[i].id,
        startTime: realSlots[i].startTime,
        endTime: realSlots[i].endTime,
        subjectCode: realSlots[i].subjectCode || "",
        subjectName: realSlots[i].subjectName || "Academic Lecture",
        type: realSlots[i].type === "lab" ? "lab" : "theory",
        room: realSlots[i].room || defaultRoom,
        faculty: realSlots[i].faculty || "Faculty Member",
      });

      if (merged.length > 0) {
        const prev = merged[merged.length - 1];
        const prevEndMin = timeToMinutes(prev.endTime);
        const currStartMin = timeToMinutes(current.startTime);

        const isContiguous =
          prevEndMin !== null &&
          currStartMin !== null &&
          Math.abs(currStartMin - prevEndMin) <= 15;

        const isSame = areSlotsSameSubject(prev, current);

        if (isContiguous && isSame) {
          prev.endTime = current.endTime;
          if (current.type === "lab" || prev.type === "lab") prev.type = "lab";
          if (!prev.faculty || prev.faculty === "Faculty Member") prev.faculty = current.faculty;
          if (!prev.room || prev.room === "Campus Hall" || prev.room === defaultRoom) prev.room = current.room;
          if (!prev.subjectCode) prev.subjectCode = current.subjectCode;
          continue;
        }
      }

      merged.push(current);
    }

    // 4. Re-assign sequential IDs
    const dayPrefix = String(day || "day").toLowerCase().slice(0, 3);
    const finalSlots = merged.map((s, idx) => ({
      ...s,
      id: `${dayPrefix}-${idx + 1}`,
      type: s.type === "lab" ? "lab" : "theory",
      room: s.room || defaultRoom,
    }));

    return {
      day,
      slots: finalSlots,
    };
  });
}

// ─── GEMINI MULTIMODAL VISION TIMETABLE PARSER ─────────────────────────────
async function parseTimetableWithGemini({ text, fileData, fileType, defaultSection, defaultRoom }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an expert college academic timetable analyzer.
Extract the complete weekly class schedule from the provided timetable (image or text).
Analyze the days of the week, time intervals, subject names, course codes, room numbers, and faculty names.

CRITICAL EXTRACTION & OPTIMIZATION RULES:
1. EXCLUDE EMPTY / FREE / BREAK SLOTS:
   - College timetables frequently print 'X', 'XX', '-', 'NIL', 'FREE', 'NO CLASS', 'LUNCH', 'RECESS', 'BREAK', 'LIBRARY', or blank cells for periods with no scheduled lecture.
   - You MUST completely SKIP and EXCLUDE all such slots.
   - ONLY include REAL academic subjects and lectures. NEVER output a slot with subject "X", "-", "NIL", "Break", or "Free".

2. MERGE MULTI-HOUR LAB PRACTICALS & EXTENDED LECTURES:
   - University practicals and laboratories typically run for 2 or 3 continuous hours (e.g. 11:00 AM to 01:00 PM, or 02:00 PM to 04:00 PM, or 02:00 PM to 05:00 PM), even when drawn across multiple adjacent 1-hour columns in the grid.
   - Whenever a Lab/Practical or lecture spans consecutive periods with the same subject, merge it into ONE single continuous slot covering the full start and end time (e.g. startTime: "11:00 AM", endTime: "01:00 PM").
   - Do NOT split continuous labs into duplicate 1-hour entries.

3. FULL SUBJECT NAMES & OFFICIAL COURSE CODES:
   - College timetables frequently use abbreviations in the grid (e.g. "CN", "DPOS", "PPWC", "PPWC LAB", "FMI 1", "ITC", "IPS1", "MLC 1").
   - Timetable documents always include a Subject/Faculty legend or footer table, or standard course curriculum.
   - Always expand abbreviations to the full subject name:
     * "CN" -> "Computer Networking : Concepts" (subjectCode: "CSE 3751")
     * "CN LAB" -> "Computer Networking Lab" (subjectCode: "CSE 3751", type: "lab")
     * "DPOS" -> "Design Principles of Operating Systems" (subjectCode: "CSE 3249")
     * "DPOS LAB" -> "Operating Systems (Unix Shell Lab)" (subjectCode: "CSE 3249", type: "lab")
     * "PPWC" -> "Practical Programming with C" (subjectCode: "CSE 3544")
     * "PPWC LAB" -> "Practical Programming with C (Lab)" (subjectCode: "CSE 3544", type: "lab")
     * "ITC" -> "Introduction to the Theory of Computation" (subjectCode: "CSE 3731")
     * "FMI 1" / "FMI" -> "Fundamentals of Machine Intelligence 1" (subjectCode: "MTH 3647")
     * "IPS 1" / "IPS1" -> "Intermediate Problem Solving — 1" (subjectCode: "GET 2024")
     * "MLC 1" / "ML-LAB" -> "Machine Learning Concepts 1" (subjectCode: "CSE 3967", type: "lab")
   - If the timetable image has a course name legend or course code column, use the full name and code from that legend.

4. FACULTY / TEACHER EXTRACTION:
   - Thoroughly inspect the timetable for the faculty/instructor name for each course (often found in the cell under the subject acronym, or in the bottom legend/footer table next to the course name).
   - If a teacher's name is listed (e.g. "Prof. Srijit Chowdhury", "Dr. A. K. Nayak", "Prof. Anmol Pattanaik", "Prof. Pankaj Prusty", "Prof. Tapan Kumar Patra", "Prof. Bhupendra Kumar Gupta", "Prof. Kuldip Mohanty"), set "faculty" to their full name with proper honorific.
   - Do NOT leave faculty blank or "Faculty Member" if a faculty name or code is present in the schedule or legend.

5. LAB VS THEORY TYPE:
   - If a slot is a Laboratory, Lab, Practical or Workshop, set "type": "lab", otherwise "type": "theory".

Return ONLY valid JSON matching this exact structure:
{
  "section": "string representing section or branch, e.g. Section 24E122A11, CSE 5A",
  "classroom": "string representing default lecture hall or room e.g. Room C-024, Room 304",
  "days": [
    {
      "day": "Monday",
      "slots": [
        {
          "startTime": "09:00 AM",
          "endTime": "10:00 AM",
          "subjectCode": "CN",
          "subjectName": "Computer Networks",
          "type": "theory",
          "room": "C-024",
          "faculty": "Faculty Name"
        }
      ]
    }
  ]
}

Ensure all 6 days (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday) are included in "days".
If a day has no scheduled classes, its "slots" array must be [].
Extract EXACTLY what is present in the provided schedule. Do NOT substitute with another department's subjects.`;

  const parts = [{ text: prompt }];

  if (fileData) {
    const cleanBase64 = fileData.replace(/^data:.*?;base64,/, "");
    parts.push({
      inlineData: {
        mimeType: fileType || "image/png",
        data: cleanBase64,
      },
    });
  } else if (text) {
    parts.push({ text: `Timetable Text / Content to parse:\n${text}` });
  }

  const modelCandidates = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3-flash-preview"];
  for (const model of modelCandidates) {
    try {
      const abortCtrl = new AbortController();
      const timer = setTimeout(() => abortCtrl.abort(), 35000);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        signal: abortCtrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          let cleanStr = candidateText.trim();
          if (cleanStr.startsWith("```")) {
            cleanStr = cleanStr.replace(/^```[a-z]*\r?\n?/i, "").replace(/\r?\n?```$/i, "");
          }
          let parsed = JSON.parse(cleanStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed = parsed[0];
          } else if (parsed && !parsed.days && (parsed.timetable || parsed.schedule || parsed.data)) {
            parsed = parsed.timetable || parsed.schedule || parsed.data;
          }

          if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
            parsed.section = parsed.section || defaultSection || "My Section";
            parsed.classroom = parsed.classroom || defaultRoom || "Campus Hall";
            parsed.days = sanitizeAndMergeDays(
              parsed.days.map((d) => ({
                day: d.day,
                slots: (d.slots || []).map((s, sIdx) => ({
                  id: `${d.day.toLowerCase().slice(0, 3)}-${sIdx + 1}`,
                  startTime: s.startTime || "08:00 AM",
                  endTime: s.endTime || "09:00 AM",
                  subjectCode: s.subjectCode || "",
                  subjectName: s.subjectName || "Subject Class",
                  type: s.type === "lab" ? "lab" : "theory",
                  room: s.room || parsed.classroom,
                  faculty: s.faculty || "Faculty Member",
                })),
              })),
              parsed.classroom
            );
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn(`[GEMINI_TIMETABLE_PARSER] Notice with ${model}:`, err.message);
    }
  }
  return null;
}

/**
 * Universal Dynamic Parser Engine Helper (Zero Hardcoding)
 */
function parseScheduleTextInternal(text, defaultSection, defaultRoom) {
  const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const parsedDaysMap = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  };

  const dayAliases = {
    mon: "Monday", monday: "Monday",
    tue: "Tuesday", tues: "Tuesday", tuesday: "Tuesday",
    wed: "Wednesday", wednesday: "Wednesday",
    thu: "Thursday", thur: "Thursday", thurs: "Thursday", thursday: "Thursday",
    fri: "Friday", friday: "Friday",
    sat: "Saturday", saturday: "Saturday",
  };

  function normalizeTimeSlot(tRaw, defaultMeridiem = "AM") {
    let str = String(tRaw || "").trim().toUpperCase();
    const m = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!m) return str;
    let h = parseInt(m[1], 10);
    let min = m[2] || "00";
    let meridiem = m[3] ? m[3].toUpperCase() : null;
    if (!meridiem) {
      if (h >= 8 && h <= 11) meridiem = "AM";
      else if (h === 12) meridiem = "PM";
      else if (h >= 1 && h <= 7) meridiem = "PM";
      else meridiem = defaultMeridiem;
    }
    const hPad = h < 10 ? "0" + h : "" + h;
    return `${hPad}:${min} ${meridiem}`;
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let currentDay = "Monday";
  let section = defaultSection || "My Section";
  let classroom = defaultRoom || "Campus Hall";

  for (const line of lines) {
    const secMatch = line.match(/SECTION\s*[-:]?\s*([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9]+)?)/i);
    if (secMatch) section = `Section ${secMatch[1].toUpperCase()}`;
    const rmMatch = line.match(/ROOM\s*(?:NO)?[:\s\-]+([A-Za-z0-9]+-[A-Za-z0-9]+|\d+)/i);
    if (rmMatch) classroom = `Room ${rmMatch[1].toUpperCase()}`;
  }

  const timeRegex = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i;
  const roomRegex = /(?:room|rm|hall|lh|lab|lt|sl|unix)\s*[-:]?\s*([A-Za-z0-9\-]+)/i;
  const facultyRegex = /(?:prof\.|dr\.|mr\.|ms\.|mrs\.)\s*([A-Za-z\s.]+)/i;

  let totalParsedSlots = 0;

  for (const rawLine of lines) {
    let line = rawLine;

    // Check if line declares or starts with a day name (e.g. "Mon:", "Monday -", "[Tuesday]")
    const dayPrefixMatch = line.match(/^\[?(mon|tue|wed|thu|fri|sat)[a-z]*\]?[:\s\-—]*/i);
    if (dayPrefixMatch) {
      const dayKey = dayPrefixMatch[1].toLowerCase();
      if (dayAliases[dayKey]) {
        currentDay = dayAliases[dayKey];
        line = line.slice(dayPrefixMatch[0].length).trim();
      }
    }

    if (!line) continue;

    // Split line into multiple classes if separated by commas or semicolons
    const subParts = line.includes(";") ? line.split(";") : (line.match(new RegExp(timeRegex.source, "gi"))?.length > 1 ? line.split(",") : [line]);

    for (const part of subParts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      const timeMatch = trimmedPart.match(timeRegex);
      let startTime = "08:00 AM";
      let endTime = "09:00 AM";

      if (timeMatch) {
        startTime = normalizeTimeSlot(timeMatch[1], "AM");
        endTime = normalizeTimeSlot(timeMatch[2], startTime.includes("PM") ? "PM" : "AM");
      }

      const upper = trimmedPart.toUpperCase();

      let room = classroom;
      const roomMatch = trimmedPart.match(roomRegex);
      if (roomMatch) room = roomMatch[0].trim();

      let faculty = "Faculty Member";
      const facMatch = trimmedPart.match(facultyRegex);
      if (facMatch) faculty = facMatch[0].trim();

      const isLab = upper.includes("LAB") || upper.includes("PRACTICAL") || upper.includes("WORKSHOP");
      const type = isLab ? "lab" : "theory";

      const codeMatch = trimmedPart.match(/[A-Z]{2,4}\s*\d{3,4}/i);
      const subjectCode = codeMatch ? codeMatch[0].toUpperCase() : "";

      const cleanedName = trimmedPart
        .replace(timeRegex, "")
        .replace(roomRegex, "")
        .replace(facultyRegex, "")
        .replace(/[()[\]{}]/g, "")
        .replace(/^[,\s\-:|]+|[,\s\-:|]+$/g, "")
        .trim();

      const subjectName = cleanedName.slice(0, 50) || "Academic Lecture";

      parsedDaysMap[currentDay].push({
        id: `${currentDay.toLowerCase().slice(0, 3)}-${parsedDaysMap[currentDay].length + 1}`,
        startTime,
        endTime,
        subjectCode,
        subjectName,
        type,
        room,
        faculty,
      });

      totalParsedSlots++;
    }
  }

  const structuredDays = daysOrder.map((day) => ({
    day,
    slots: parsedDaysMap[day] || [],
  }));

  const cleanedDays = sanitizeAndMergeDays(structuredDays, classroom);

  return {
    section,
    classroom,
    days: cleanedDays,
  };
}

/**
 * POST /api/v1/academics/parse-timetable
 */
const parseTimetableEngine = async (req, res) => {
  try {
    const { rawText, defaultSection, defaultRoom } = req.body;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide raw timetable text to parse",
      });
    }

    // 1. Try Gemini Vision/Text AI first for 100% precision
    let parsedData = await parseTimetableWithGemini({
      text: rawText,
      defaultSection,
      defaultRoom,
    });

    // 2. Fallback to dynamic regex parser if Gemini is unreachable
    if (!parsedData) {
      parsedData = parseScheduleTextInternal(rawText, defaultSection, defaultRoom);
    }

    return res.status(200).json({
      success: true,
      message: "Timetable parsed successfully",
      parsedData,
    });
  } catch (error) {
    console.error("[ACADEMIC_PARSE_TIMETABLE_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to parse timetable text",
      error: error.message,
    });
  }
};

/**
 * POST /api/v1/academics/upload-file
 * Multi-format timetable file engine:
 * Handles images, PDFs, CSV, or extracted document payloads with Gemini Multimodal Vision AI!
 */
const uploadAndProcessTimetableFile = async (req, res) => {
  try {
    const { fileName, fileType, fileData, extractedText, defaultSection, defaultRoom } = req.body;

    let parsedData = null;
    let sourceMethod = "gemini_vision";

    // 1. High-Precision Gemini Multimodal Vision (Reads image table directly!)
    if (fileData) {
      console.log(`[ACADEMIC_OCR] Analyzing image/document with Gemini Vision AI: ${fileName || "uploaded-file"}`);
      parsedData = await parseTimetableWithGemini({
        fileData,
        fileType,
        text: extractedText,
        defaultSection,
        defaultRoom,
      });
    }

    // 2. Secondary fallback: OCR.space + Dynamic text parser if Gemini was unavailable
    if (!parsedData) {
      let textToParse = extractedText || "";

      if (!textToParse && fileData) {
        if (fileType && (fileType.includes("text") || fileType.includes("csv") || fileType.includes("json"))) {
          const buffer = Buffer.from(fileData.replace(/^data:.*,/, ""), "base64");
          textToParse = buffer.toString("utf-8");
        }
      }

      if (!textToParse && fileData && (fileType?.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(fileName || ""))) {
        try {
          console.log(`[ACADEMIC_OCR] Falling back to OCR.space engine: ${fileName || "uploaded-image"}`);
          const ocrFormData = new URLSearchParams();
          ocrFormData.append("apikey", "K88647588888957");
          const formattedBase64 = fileData.startsWith("data:") ? fileData : `data:${fileType || "image/png"};base64,${fileData}`;
          ocrFormData.append("base64Image", formattedBase64);
          ocrFormData.append("language", "eng");
          ocrFormData.append("isTable", "true");
          ocrFormData.append("scale", "true");
          ocrFormData.append("detectOrientation", "true");

          const ocrAbort = new AbortController();
          const ocrTimer = setTimeout(() => ocrAbort.abort(), 12000);

          const ocrRes = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            body: ocrFormData,
            signal: ocrAbort.signal,
          });
          clearTimeout(ocrTimer);

          if (ocrRes.ok) {
            const ocrJson = await ocrRes.json();
            const extractedFromOcr = ocrJson?.ParsedResults?.[0]?.ParsedText || "";
            if (extractedFromOcr && extractedFromOcr.trim()) {
              textToParse = extractedFromOcr;
            }
          }
        } catch (ocrErr) {
          console.warn("[ACADEMIC_OCR] Fallback OCR notice:", ocrErr.message);
        }
      }

      if (textToParse && textToParse.trim().length > 5) {
        // Try Gemini with text
        parsedData = await parseTimetableWithGemini({ text: textToParse, defaultSection, defaultRoom });
        if (!parsedData) {
          parsedData = parseScheduleTextInternal(textToParse, defaultSection, defaultRoom);
        }
        sourceMethod = "ocr_fallback";
      }
    }

    // 3. If still empty, return clean template instead of injecting another student's timetable!
    if (!parsedData) {
      sourceMethod = "blank_template";
      parsedData = {
        section: defaultSection || "My Section",
        classroom: defaultRoom || "Campus Hall",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({
          day,
          slots: [],
        })),
      };
    }

    // 4. Ensure final timetable is completely sanitized and multi-hour labs are merged
    if (parsedData && Array.isArray(parsedData.days)) {
      parsedData.days = sanitizeAndMergeDays(parsedData.days, parsedData.classroom);
    }

    // Auto-save directly if user is authenticated
    if (req.user && req.user._id) {
      await UserTimetable.findOneAndUpdate(
        { userId: req.user._id },
        {
          userId: req.user._id,
          registrationNumber: req.user.registrationNumber || "",
          section: parsedData.section,
          classroom: parsedData.classroom,
          days: parsedData.days,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: sourceMethod === "gemini_vision"
        ? "Timetable scanned with Google Gemini Vision AI & auto-saved successfully!"
        : "Timetable processed & saved successfully!",
      fileName: fileName || "Timetable Document",
      sourceMethod,
      parsedData,
    });
  } catch (error) {
    console.error("[ACADEMIC_UPLOAD_TIMETABLE_FILE_ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process timetable document",
      error: error.message,
    });
  }
};

module.exports = {
  getAcademicOverview,
  getUserTimetable,
  saveUserTimetable,
  resetUserTimetable,
  updateExamRadar,
  parseTimetableEngine,
  uploadAndProcessTimetableFile,
};
