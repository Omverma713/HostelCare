const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  getAcademicOverview,
  getUserTimetable,
  saveUserTimetable,
  resetUserTimetable,
  updateExamRadar,
  parseTimetableEngine,
} = require("../controllers/academic.controller");

// Overview: Academic calendar, Gazetted Holidays (12), Curriculum (5th sem CSE), Exam Radar, Timetable
router.get("/overview", getAcademicOverview);

// User-Specific Timetable Management (Requires Auth)
router.get("/timetable", authMiddleware, getUserTimetable);
router.put("/timetable", authMiddleware, saveUserTimetable);
router.delete("/timetable", authMiddleware, resetUserTimetable);

// AI / Heuristic Timetable Parser Engine
router.post("/parse-timetable", authMiddleware, parseTimetableEngine);

// SuperAdmin Exam Radar & Syllabus Updates
router.put("/exam-radar", authMiddleware, updateExamRadar);

module.exports = router;
