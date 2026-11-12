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
 * Returns full academic calendar, gazetted holidays (12), 5th sem CSE curriculum,
 * exam radar status, and active timetable (custom if logged in, else default).
 */
const getAcademicOverview = async (req, res) => {
  try {
    const config = await AcademicConfig.getEffectiveConfig();
    const user = await getOptionalUser(req);

    let userTimetable = null;
    if (user) {
      userTimetable = await UserTimetable.findOne({ userId: user._id });
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
 * Returns current user's timetable, or default if none saved.
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
 * Saves or updates student's personalized timetable.
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

    const updated = await UserTimetable.findOneAndUpdate(
      { userId },
      {
        userId,
        registrationNumber: req.user.registrationNumber || "",
        section: section || "CSE Section 5A",
        classroom: classroom || "Room 304",
        days,
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
 * Resets user's personalized timetable back to standard batch default.
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
 * SuperAdmin endpoint: update exam radar status, date range, published datesheet, and syllabus
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

/**
 * POST /api/v1/academics/parse-timetable
 * Smart AI/Heuristic text parser engine:
 * Accepts pasted raw timetable text or table strings and parses them into structured JSON
 * extracting Day, Time Slots, Subject Code, Subject Name, Classroom/Room Number, and Teacher/Faculty.
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

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const parsedDaysMap = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
    };

    let currentDay = "Monday";

    // Known subjects regex map
    const subjectKnown = [
      { code: "CSE 3544", name: "Practical Programming with C", keywords: ["CSE 3544", "PPC", "C PROG", "PRACTICAL PROGRAMMING"] },
      { code: "CSE 3249", name: "Design Principles of Operating Systems", keywords: ["CSE 3249", "DPOS", "OS", "OPERATING SYSTEM", "UNIX"] },
      { code: "CSE 3751", name: "Computer Networking : Concepts", keywords: ["CSE 3751", "CN", "NETWORKING", "COMPUTER NETWORKS"] },
      { code: "CSE 3967", name: "Machine Learning Concepts 1", keywords: ["CSE 3967", "ML", "ML-LAB", "MACHINE LEARNING"] },
      { code: "CSE 3731", name: "Introduction to the Theory of Computation", keywords: ["CSE 3731", "TOC", "THEORY OF COMPUTATION", "AUTOMATA"] },
      { code: "MTH 3647", name: "Fundamentals of Machine Intelligence 1", keywords: ["MTH 3647", "FMI", "MACHINE INTELLIGENCE"] },
      { code: "GET 2024", name: "Intermediate Problem Solving — 1", keywords: ["GET 2024", "PROBLEM SOLVING", "DSA", "CODING PRACTICE"] },
    ];

    const timeRegex = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i;
    const roomRegex = /(?:room|rm|hall|lh|lab|lt)\s*[-:]?\s*([A-Za-z0-9\-]+)/i;
    const facultyRegex = /(?:prof\.|dr\.|mr\.|ms\.|mrs\.)\s*([A-Za-z\s.]+)/i;

    for (const line of lines) {
      const upper = line.toUpperCase();
      // Check if line represents a day header
      const foundDay = daysOrder.find((d) => upper.startsWith(d.toUpperCase()) || upper === d.toUpperCase());
      if (foundDay) {
        currentDay = foundDay;
        continue;
      }

      // Try matching time
      const timeMatch = line.match(timeRegex);
      let startTime = "08:00 AM";
      let endTime = "09:00 AM";
      if (timeMatch) {
        startTime = timeMatch[1].trim();
        endTime = timeMatch[2].trim();
        if (!/am|pm/i.test(startTime) && /pm/i.test(endTime)) {
          startTime += " PM";
        } else if (!/am|pm/i.test(startTime) && /am/i.test(endTime)) {
          startTime += " AM";
        }
      }

      // Try matching subject
      let matchedSubject = null;
      for (const subj of subjectKnown) {
        for (const kw of subj.keywords) {
          if (upper.includes(kw)) {
            matchedSubject = subj;
            break;
          }
        }
        if (matchedSubject) break;
      }

      // Room extraction
      let room = defaultRoom || "Room 304";
      const roomMatch = line.match(roomRegex);
      if (roomMatch) {
        room = roomMatch[0].trim();
      }

      // Faculty extraction
      let faculty = "Faculty Member";
      const facMatch = line.match(facultyRegex);
      if (facMatch) {
        faculty = facMatch[0].trim();
      }

      // Determine slot type
      const isLab = upper.includes("LAB") || (matchedSubject && matchedSubject.code === "CSE 3967");
      const type = isLab ? "lab" : "theory";

      const subjectCode = matchedSubject ? matchedSubject.code : (line.match(/[A-Z]{3}\s*\d{4}/)?.[0] || "ACAD 501");
      const subjectName = matchedSubject ? matchedSubject.name : line.replace(timeRegex, "").replace(roomRegex, "").replace(facultyRegex, "").trim().slice(0, 45) || "Academic Lecture";

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
    }

    const structuredDays = daysOrder.map((day) => ({
      day,
      slots: parsedDaysMap[day].length > 0 ? parsedDaysMap[day] : defaultWeeklyTimetable.find((d) => d.day === day)?.slots || [],
    }));

    return res.status(200).json({
      success: true,
      message: "Timetable parsed successfully",
      parsedData: {
        section: defaultSection || "CSE Section 5A",
        classroom: defaultRoom || "Room 304 (C-Block)",
        days: structuredDays,
      },
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

module.exports = {
  getAcademicOverview,
  getUserTimetable,
  saveUserTimetable,
  resetUserTimetable,
  updateExamRadar,
  parseTimetableEngine,
};

