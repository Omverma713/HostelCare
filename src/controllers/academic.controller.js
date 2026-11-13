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

// ─── GEMINI MULTIMODAL VISION TIMETABLE PARSER ─────────────────────────────
async function parseTimetableWithGemini({ text, fileData, fileType, defaultSection, defaultRoom }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an expert college academic timetable analyzer.
Extract the complete weekly class schedule from the provided timetable (image or text).
Analyze the days of the week, time intervals, subject names, course codes, room numbers, and faculty names.
If a slot is a Laboratory, Lab, Practical or Workshop, set "type": "lab", otherwise "type": "theory".

Return ONLY valid JSON matching this exact structure:
{
  "section": "string representing section or branch, e.g. CSE 5A, Mech 3B, Section 24E1C3",
  "classroom": "string representing default lecture hall or room e.g. Room 304, LH-201",
  "days": [
    {
      "day": "Monday",
      "slots": [
        {
          "startTime": "08:00 AM",
          "endTime": "09:00 AM",
          "subjectCode": "CSE 3544",
          "subjectName": "Full Subject Name",
          "type": "theory",
          "room": "Room 304",
          "faculty": "Prof. Faculty Name"
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

  const modelCandidates = ["gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-flash-latest"];
  for (const model of modelCandidates) {
    try {
      const abortCtrl = new AbortController();
      const timer = setTimeout(() => abortCtrl.abort(), 18000);

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
          const parsed = JSON.parse(candidateText);
          if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
            parsed.section = parsed.section || defaultSection || "My Section";
            parsed.classroom = parsed.classroom || defaultRoom || "Campus Hall";
            parsed.days = parsed.days.map((d) => ({
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
            }));
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

  return {
    section,
    classroom,
    days: structuredDays,
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
