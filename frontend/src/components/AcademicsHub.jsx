import React, { useState, useEffect, useMemo } from "react";
import "./AcademicsHub.css";

const API_BASE = "/api/v1/academics";

// Bundled Fallbacks in case offline or API is starting
const FALLBACK_CURRICULUM = [
  {
    code: "CSE 3544",
    name: "Practical Programming with C",
    credits: 4,
    gradingPattern: "1",
    weeklyFormat: "2L - 4P",
    isRequiredForPromotion: true,
    textbooks: "Practical C Programming by Harwani, Packt Publishing",
    syllabus:
      "Working with Arrays, Managing Strings, Exploring Functions, Preprocessing and Compilation, Deep Dive into Pointers, File Handling, Implementing Concurrency, Networking and Inter-Process Communication, Sorting and Searching, Working with Graphs, Advanced Data Structures and Algorithms, Creativity with Graphics, General-Purpose Utilities, Dynamic memory allocation, Improving the Performance of Your Code, Low-Level Programming, Applying Security in Coding.",
    tags: ["Core", "Programming", "Lab Required"],
  },
  {
    code: "CSE 3249",
    name: "Design Principles of Operating Systems",
    credits: 4,
    gradingPattern: "1",
    weeklyFormat: "3L - 2P",
    isRequiredForPromotion: true,
    textbooks:
      "Operating Systems: Internals and Design Principles by Stallings, Pearson India; Unix Shell Programming by Yashavant Kanetkar, BPB Publications",
    syllabus:
      "Theory (From Stallings): Computer System Overview, Operating System Overview, Process Description and Control, Threads, Concurrency: Mutual Exclusion and Synchronization, Concurrency: Deadlock and Starvation, Memory Management, Virtual Memory, Uniprocessor Scheduling, Multiprocessor, Multicore and Real-Time Scheduling, I/O Management and Disk Scheduling, File Management.\nLabs (From Kanetkar): The Unix File System, Essential Unix Commands, I/O Redirection and Piping, vi - The King of All Editors, Processes in Unix, Communication - Unix Style.",
    tags: ["Core", "Systems", "Lab Required"],
  },
  {
    code: "CSE 3751",
    name: "Computer Networking : Concepts",
    credits: 4,
    gradingPattern: "1",
    weeklyFormat: "3L - 2P",
    isRequiredForPromotion: true,
    textbooks:
      "CompTIA Network+ Certification Guide by Singh, Packt Publishing; CompTIA Network+ N10-009 Certification Guide by Neil, Packt Publishing",
    syllabus:
      "Singh: Exploring the OSI Model and TCP/IP, Network Topologies and Connections, Ethernet Technology and Virtualization, Understanding IPv4 and IPv6 Addressing, Applied IPv4 Subnetting, Exploring Network Protocols and Services, Data Center Architecture and Cloud Computing, Networking Devices, Routing and Switching Concepts, Exploring Wireless Standards and Technologies, Assuring Network Availability, Organizational Documents and Policies, High Availability and Disaster Recovery.\nNeil: Supplementary Practice questions and tests from secondary textbook.",
    tags: ["Core", "Networks", "Lab Required"],
  },
  {
    code: "CSE 3967",
    name: "Machine Learning Concepts 1",
    credits: 2,
    gradingPattern: "5",
    weeklyFormat: "0L - 4P",
    isRequiredForPromotion: false,
    textbooks: "Practical Handbook of Machine Learning by Bhattacharyya, GK Publications",
    syllabus:
      "Prerequisites - Python, NumPy, Matplotlib, Pandas, Statistics and Probability, AIML Revolution, Prediction Problems Using Regression, Non-Linear Models and Feature Engineering, Sources of Model Error, Overfitting and Underfitting (Bias and Variance), Model Validation (Train-Test Split), Classification Problems, Digging Deeper into Classifier Accuracy: The Confusion Matrix, Distance-Based ML Algorithms, Feature Scaling, Decision Tree, Ensemble Models, Random Forest Classifier, Unsupervised Learning. ML-LAB.",
    tags: ["ML", "AI", "Lab Only"],
  },
  {
    code: "CSE 3731",
    name: "Introduction to the Theory of Computation",
    credits: 3,
    gradingPattern: "6",
    weeklyFormat: "3L - 0P",
    isRequiredForPromotion: false,
    textbooks: "Introduction to the Theory of Computation by Sipser, Cengage",
    syllabus:
      "Automata and Languages: Regular Languages, Context Free grammar.\nComputability: The Church Turing Thesis, Decidability, Reducibility.",
    tags: ["Theory", "Automata"],
  },
  {
    code: "MTH 3647",
    name: "Fundamentals of Machine Intelligence 1",
    credits: 3,
    gradingPattern: "6",
    weeklyFormat: "3L - 0P",
    isRequiredForPromotion: false,
    textbooks: "Artificial Intelligence and Machine Learning by Singh and Gandhi, McGraw Hill",
    syllabus:
      "Foundations of Artificial Intelligence, Intelligent Agents and Environments, Search and Problem Solving, Knowledge Representation and Logical Reasoning, Probabilistic Reasoning and Uncertainty, Machine Learning Basics and Techniques, Supervised Learning Techniques, Unsupervised Learning Techniques, Neural Networks and Deep Learning (if time permits).",
    tags: ["AI", "Math"],
  },
  {
    code: "GET 2024",
    name: "Intermediate Problem Solving — 1",
    credits: 0,
    gradingPattern: "GP6",
    weeklyFormat: "120 minutes (40 mins/session)",
    isRequiredForPromotion: false,
    isMandatoryExtracurricular: true,
    textbooks:
      "Problems on Array (Aditya Chatterjee), Linked List Problems, Binary Tree Problems, Binary Search Problems (Open Genus, Notion Press)",
    syllabus:
      "Selected problems from relevant chapters of the four prescribed books to be used for programming practice and problem solving ability development. Minimum attendance criteria must be satisfied.",
    tags: ["Extracurricular", "DSA", "Problem Solving"],
  },
];

const FALLBACK_HOLIDAYS = [
  { name: "Republic Day", date: "26.01.2026", dayOfWeek: "Monday", description: "National Gazetted Holiday" },
  { name: "Holi", date: "04.03.2026", dayOfWeek: "Wednesday", description: "Festival of Colors" },
  { name: "Good Friday", date: "03.04.2026", dayOfWeek: "Friday", description: "Gazetted Holiday" },
  { name: "Id-ul-Zuha", date: "27.05.2026", dayOfWeek: "Wednesday", description: "Gazetted Holiday" },
  { name: "Rath Yatra", date: "16.07.2026", dayOfWeek: "Thursday", description: "State & University Holiday" },
  { name: "Independence Day", date: "15.08.2026", dayOfWeek: "Saturday", description: "National Gazetted Holiday" },
  { name: "Janmasthami", date: "04.09.2026", dayOfWeek: "Friday", description: "Gazetted Holiday" },
  { name: "Ganesh Puja", date: "14.09.2026", dayOfWeek: "Monday", description: "Gazetted Holiday" },
  { name: "Gandhi Jayanti", date: "02.10.2026", dayOfWeek: "Friday", description: "National Gazetted Holiday" },
  { name: "Maha Navami", date: "19.10.2026", dayOfWeek: "Monday", description: "Durga Puja Gazetted Holiday" },
  { name: "Vijaya Dasami", date: "20.10.2026", dayOfWeek: "Tuesday", description: "Dussehra Gazetted Holiday" },
  { name: "X-Mass Day", date: "25.12.2026", dayOfWeek: "Friday", description: "Christmas Gazetted Holiday" },
];

export default function AcademicsHub({ userRole = "student", onBackToHome }) {
  const [activeSubTab, setActiveSubTab] = useState("timetable"); // 'timetable' | 'exam' | 'curriculum' | 'calendar'
  const [loading, setLoading] = useState(true);
  const [academicData, setAcademicData] = useState(null);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedSyllabus, setExpandedSyllabus] = useState(null);

  // Timetable Parser & Editor Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customSection, setCustomSection] = useState("CSE Section 5A");
  const [customRoom, setCustomRoom] = useState("Room 304 (C-Block)");
  const [parsingEngineRunning, setParsingEngineRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // SuperAdmin Exam Editor Modal
  const [showAdminExamModal, setShowAdminExamModal] = useState(false);
  const [adminExamStatus, setAdminExamStatus] = useState("yet_to_be_decided");
  const [adminExamTitle, setAdminExamTitle] = useState("Mid Semester Examination 2026-27");
  const [adminExamRange, setAdminExamRange] = useState("26th October to 4th November 2026");
  const [adminExamNotice, setAdminExamNotice] = useState("");

  const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Fetch Academic Data
  const loadAcademics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE}/overview`, { headers });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (json.success && json.data) {
        setAcademicData(json.data);
        if (json.data.examRadar) {
          setAdminExamStatus(json.data.examRadar.status || "yet_to_be_decided");
          setAdminExamTitle(json.data.examRadar.title || "Mid Semester Examination 2026-27");
          setAdminExamRange(json.data.examRadar.tentativeDateRange || "26th October to 4th November 2026");
          setAdminExamNotice(json.data.examRadar.notice || "");
        }
      }
    } catch (err) {
      console.warn("[ACADEMICS_HUB] API request failed, applying local fallback:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAcademics();
    // Auto-select current day of week if Monday-Saturday
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    if (daysList.includes(todayName)) {
      setSelectedDay(todayName);
    }
  }, []);

  const activeTimetable = academicData?.activeTimetable || academicData?.defaultTimetable;
  const curriculumList = academicData?.curriculum || FALLBACK_CURRICULUM;
  const holidaysList = academicData?.holidays || FALLBACK_HOLIDAYS;
  const examRadar = academicData?.examRadar || {
    title: "Mid Semester Examination 2026-27",
    status: "yet_to_be_decided",
    statusBadgeText: "Yet to be Decided",
    tentativeDateRange: "26th October to 4th November 2026 (Odd Sem)",
    notice: "Official datesheet has not been released yet by the examination division. SuperAdmin updates will appear here automatically.",
  };

  // Find active / upcoming class in real time
  const currentLiveClass = useMemo(() => {
    if (!activeTimetable || !activeTimetable.days) return null;
    const now = new Date();
    const todayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const dayData = activeTimetable.days.find((d) => d.day.toLowerCase() === todayName.toLowerCase());
    if (!dayData || !dayData.slots || dayData.slots.length === 0) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseToMins = (timeStr) => {
      if (!timeStr) return 0;
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
      if (!match) return 0;
      let hours = parseInt(match[1], 10);
      const mins = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3].toUpperCase();
      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;
      return hours * 60 + mins;
    };

    let activeSlot = null;
    let nextSlot = null;

    for (let i = 0; i < dayData.slots.length; i++) {
      const slot = dayData.slots[i];
      const start = parseToMins(slot.startTime);
      const end = parseToMins(slot.endTime);

      if (currentMinutes >= start && currentMinutes <= end) {
        activeSlot = { ...slot, remainingMins: end - currentMinutes };
        nextSlot = dayData.slots[i + 1] || null;
        break;
      } else if (currentMinutes < start && !nextSlot) {
        nextSlot = slot;
      }
    }

    return { activeSlot, nextSlot, todayName };
  }, [activeTimetable]);

  // Handle Timetable Auto-Parser
  const handleAutoParseTimetable = async () => {
    if (!customText.trim()) {
      setActionMessage({ type: "error", text: "Please paste your section schedule text first." });
      return;
    }

    try {
      setParsingEngineRunning(true);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/parse-timetable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          rawText: customText,
          defaultSection: customSection,
          defaultRoom: customRoom,
        }),
      });

      const json = await res.json();
      if (json.success && json.parsedData) {
        // Save parsed timetable
        await handleSaveParsedSchedule(json.parsedData);
      } else {
        throw new Error(json.message || "Failed to parse timetable");
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Parsing error" });
    } finally {
      setParsingEngineRunning(false);
    }
  };

  const handleSaveParsedSchedule = async (parsedData) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/timetable`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(parsedData),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: "Timetable updated & saved successfully!" });
        setShowEditModal(false);
        loadAcademics();
      } else {
        throw new Error(json.message || "Could not save timetable");
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleResetTimetable = async () => {
    if (!window.confirm("Are you sure you want to revert your timetable back to the ITER institute default?")) return;
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/timetable`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: "Timetable reset to institute default." });
        loadAcademics();
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const handleSaveExamRadarAdmin = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/exam-radar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: adminExamStatus,
          title: adminExamTitle,
          tentativeDateRange: adminExamRange,
          notice: adminExamNotice,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: "Exam Radar settings published to all students!" });
        setShowAdminExamModal(false);
        loadAcademics();
      } else {
        throw new Error(json.message || "Failed to update Exam Radar");
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    }
  };

  const currentDaySlots = useMemo(() => {
    if (!activeTimetable || !activeTimetable.days) return [];
    const found = activeTimetable.days.find((d) => d.day.toLowerCase() === selectedDay.toLowerCase());
    return found ? found.slots || [] : [];
  }, [activeTimetable, selectedDay]);

  return (
    <div className="academics-hub-container">
      {/* 1. TOP HEADER BANNER */}
      <div className="acad-header-card">
        <div className="acad-badge-row">
          <span className="acad-pill">🏛️ ITER | SIKSHA 'O' ANUSANDHAN</span>
          <span className="acad-pill">🎓 B.Tech CSE • Sem 5</span>
          <span className={`acad-pill exam-status ${examRadar.status}`}>
            {examRadar.status === "yet_to_be_decided" ? "⏳ Exam Dates: Yet to be Decided" : "📢 Datesheet Released"}
          </span>
          {academicData?.userTimetable && (
            <span className="acad-pill" style={{ background: "#E0F2FE", color: "#0369A1", borderColor: "#BAE6FD" }}>
              👤 Custom Timetable Active
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="acad-title">Academics & Schedule Radar</h1>
            <p className="acad-subtitle">
              Live classroom slots, syllabus modules, 12 official gazetted student holidays, and upcoming exam radar for Academic Year 2026-27.
            </p>
          </div>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              style={{
                background: "transparent",
                border: "1px solid #C07660",
                color: "#C07660",
                borderRadius: 9999,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ← Back to Sanctuary
            </button>
          )}
        </div>

        {/* Action toast */}
        {actionMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 12,
              background: actionMessage.type === "success" ? "#DEF7EC" : "#FDE8E8",
              color: actionMessage.type === "success" ? "#03543F" : "#9B1C1C",
              border: `1px solid ${actionMessage.type === "success" ? "#BCF0DA" : "#F8B4B4"}`,
            }}
          >
            {actionMessage.text}
          </div>
        )}

        {/* 2. SUB-NAVIGATION TABS */}
        <div className="acad-nav-tabs">
          <button
            className={`acad-nav-tab ${activeSubTab === "timetable" ? "active" : ""}`}
            onClick={() => setActiveSubTab("timetable")}
          >
            🕒 Class Timetable
          </button>
          <button
            className={`acad-nav-tab ${activeSubTab === "exam" ? "active" : ""}`}
            onClick={() => setActiveSubTab("exam")}
          >
            🎯 Exam Radar
          </button>
          <button
            className={`acad-nav-tab ${activeSubTab === "curriculum" ? "active" : ""}`}
            onClick={() => setActiveSubTab("curriculum")}
          >
            📚 5th Sem Curriculum ({curriculumList.length})
          </button>
          <button
            className={`acad-nav-tab ${activeSubTab === "calendar" ? "active" : ""}`}
            onClick={() => setActiveSubTab("calendar")}
          >
            📅 Academic Calendar & Holidays
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: CLASS TIMETABLE & LIVE TRACKER
         ========================================================================= */}
      {activeSubTab === "timetable" && (
        <div>
          {/* Real-time Classroom Status Cards */}
          <div className="timetable-hero-banner">
            <div className={`live-class-card ${currentLiveClass?.activeSlot ? "active-pulse" : ""}`}>
              <div className="live-pulse-badge">
                <span className="pulse-dot"></span>
                {currentLiveClass?.activeSlot ? "Happening Now" : "Classroom Radar"}
              </div>

              {currentLiveClass?.activeSlot ? (
                <div>
                  <h3 className="live-subject-name">
                    {currentLiveClass.activeSlot.subjectName} ({currentLiveClass.activeSlot.subjectCode})
                  </h3>
                  <div className="live-subject-meta">
                    <span className="meta-item">
                      📍 <strong>Classroom:</strong> {currentLiveClass.activeSlot.room || "Room 304"}
                    </span>
                    <span className="meta-item">
                      👨‍🏫 <strong>Faculty:</strong> {currentLiveClass.activeSlot.faculty || "Faculty Member"}
                    </span>
                    <span className="meta-item">
                      ⏰ <strong>Timing:</strong> {currentLiveClass.activeSlot.startTime} – {currentLiveClass.activeSlot.endTime}
                    </span>
                    <span className="meta-item" style={{ color: "#C07660", fontWeight: 700 }}>
                      ⏳ {currentLiveClass.activeSlot.remainingMins} mins remaining
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="live-subject-name" style={{ fontSize: 18, color: "#6B685F" }}>
                    No ongoing lecture right now
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8C887B" }}>
                    Enjoy your break! Check the schedule below for upcoming lecture slots and hall numbers.
                  </p>
                </div>
              )}
            </div>

            {/* Next Up Card */}
            <div className="live-class-card">
              <span className="live-pulse-badge" style={{ background: "#F4EFEA", color: "#575854" }}>
                ⏭️ Next Up Today
              </span>
              {currentLiveClass?.nextSlot ? (
                <div>
                  <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#242523" }}>
                    {currentLiveClass.nextSlot.subjectName}
                  </h4>
                  <div style={{ fontSize: 12.5, color: "#6B685F", display: "flex", flexDirection: "column", gap: 3 }}>
                    <span>📍 Hall: <strong>{currentLiveClass.nextSlot.room || "Room 304"}</strong></span>
                    <span>👨‍🏫 Faculty: {currentLiveClass.nextSlot.faculty || "Faculty Member"}</span>
                    <span>⏰ Starts at {currentLiveClass.nextSlot.startTime}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#8C887B", marginTop: 6 }}>
                  No more lectures scheduled for the remainder of today.
                </div>
              )}
            </div>
          </div>

          {/* Controls: Section & Edit / Upload Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, margin: "16px 0 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#242523" }}>
                Section: {activeTimetable?.section || "CSE Section 5A"}
              </span>
              <span style={{ fontSize: 12, color: "#8C887B" }}>• Base Hall: {activeTimetable?.classroom || "Room 304"}</span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {academicData?.userTimetable && (
                <button
                  onClick={handleResetTimetable}
                  style={{
                    background: "transparent",
                    border: "1px solid #E6DCD0",
                    color: "#6B685F",
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ↺ Reset to Default
                </button>
              )}
              <button
                onClick={() => setShowEditModal(true)}
                style={{
                  background: "#C07660",
                  color: "#FAF7F2",
                  border: "none",
                  borderRadius: 10,
                  padding: "7px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(192, 118, 96, 0.25)",
                }}
              >
                ✏️ Upload / Edit Timetable
              </button>
            </div>
          </div>

          {/* Interactive Day Switcher */}
          <div className="day-selector-bar">
            {daysList.map((day) => {
              const daySlots = activeTimetable?.days?.find((d) => d.day.toLowerCase() === day.toLowerCase())?.slots || [];
              const isSelected = selectedDay.toLowerCase() === day.toLowerCase();
              return (
                <button
                  key={day}
                  className={`day-btn ${isSelected ? "active" : ""}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <span>{day.slice(0, 3)}</span>
                  <span className="day-slot-count">{daySlots.length} classes</span>
                </button>
              );
            })}
          </div>

          {/* Schedule List */}
          <div className="timetable-timeline">
            {currentDaySlots.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#8C887B" }}>
                ☕ No classes scheduled for {selectedDay}.
              </div>
            ) : (
              currentDaySlots.map((slot) => {
                const isLab = slot.type === "lab" || slot.subjectCode === "CSE 3967";
                return (
                  <div key={slot.id || `${slot.subjectCode}-${slot.startTime}`} className={`timetable-slot-card ${isLab ? "is-lab" : ""}`}>
                    {/* Time Column */}
                    <div className="slot-time-col">
                      <span className="slot-time-range">{slot.startTime} – {slot.endTime}</span>
                      <span className="slot-duration">{isLab ? "2-Hour Practical Lab" : "1-Hour Lecture"}</span>
                    </div>

                    {/* Subject Details */}
                    <div className="slot-content-col">
                      <div className="slot-title">{slot.subjectName}</div>
                      <div className="slot-sub-info">
                        <span>📍 <strong>{slot.room || "Room 304"}</strong></span>
                        <span>👨‍🏫 {slot.faculty || "Faculty"}</span>
                        <span>🏷️ {slot.subjectCode}</span>
                      </div>
                    </div>

                    {/* Badge Column */}
                    <div className="slot-badge-col">
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: 9999,
                          textTransform: "uppercase",
                          background: isLab ? "#FEF3C7" : "#F4EFEA",
                          color: isLab ? "#92400E" : "#575854",
                        }}
                      >
                        {isLab ? "🔬 Lab Session" : "📖 Theory"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: EXAM RADAR
         ========================================================================= */}
      {activeSubTab === "exam" && (
        <div className="exam-radar-container">
          <div className="exam-hero-box">
            <div className="exam-hero-top">
              <div>
                <span className={`exam-status-tag ${examRadar.status}`}>
                  {examRadar.statusBadgeText || (examRadar.status === "yet_to_be_decided" ? "⏳ Yet to be Decided" : "📢 Datesheet Released")}
                </span>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, margin: "10px 0 6px", color: "#242523" }}>
                  {examRadar.title || "Mid Semester Examination 2026-27"}
                </h2>
                <div style={{ fontSize: 13.5, color: "#6B685F" }}>
                  🗓️ <strong>Tentative Examination Window:</strong>{" "}
                  <span style={{ color: "#C07660", fontWeight: 700 }}>
                    {examRadar.tentativeDateRange || "26th October to 4th November 2026 (Odd Sem)"}
                  </span>
                </div>
              </div>

              {/* SuperAdmin Controls Button */}
              {userRole === "superadmin" && (
                <button
                  onClick={() => setShowAdminExamModal(true)}
                  style={{
                    background: "#242523",
                    color: "#FAF7F2",
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 16px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ⚙️ Admin: Update Datesheet & Syllabus
                </button>
              )}
            </div>

            <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "#575854", lineHeight: 1.5, background: "#FAF7F2", padding: "12px 16px", borderRadius: 12, border: "1px solid #EAE3D6" }}>
              📌 <strong>Examination Division Notice:</strong> {examRadar.notice}
            </p>
          </div>

          {/* Published Datesheet Table (When Announced) */}
          {examRadar.publishedDatesheet && examRadar.publishedDatesheet.length > 0 ? (
            <div style={{ background: "#FAF7F2", border: "1px solid #EAE3D6", borderRadius: 18, padding: 20 }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: "0 0 14px", color: "#242523" }}>
                Official Examination Datesheet
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #EAE3D6", textAlign: "left", color: "#8C887B" }}>
                      <th style={{ padding: "10px 12px" }}>Date</th>
                      <th style={{ padding: "10px 12px" }}>Subject</th>
                      <th style={{ padding: "10px 12px" }}>Time</th>
                      <th style={{ padding: "10px 12px" }}>Hall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examRadar.publishedDatesheet.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #F4EFEA" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#C07660" }}>{row.examDate}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.subjectName} ({row.subjectCode})</td>
                        <td style={{ padding: "10px 12px" }}>{row.examTime}</td>
                        <td style={{ padding: "10px 12px" }}>{row.roomNumber || "Announced on Admit Card"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ background: "#FAF7F2", border: "1px dashed #D88B74", borderRadius: 16, padding: "20px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
              <h4 style={{ margin: "0 0 4px", fontSize: 15, color: "#242523" }}>Official Datesheet Yet to be Released</h4>
              <p style={{ margin: 0, fontSize: 13, color: "#6B685F" }}>
                The examination schedule is currently under finalization by the Dean of Examinations. When dates are declared, the subject timetable will reflect here.
              </p>
            </div>
          )}

          {/* Per-Subject Exam Syllabus Coverage */}
          <div>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 19, margin: "16px 0 12px", color: "#242523" }}>
              Exam Syllabus Coverage (5th Semester)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {curriculumList.map((course) => {
                const isExpanded = expandedSyllabus === course.code;
                const radarSyllabus = examRadar.subjectSyllabus?.find((s) => s.subjectCode === course.code);

                return (
                  <div
                    key={course.code}
                    className="syllabus-accordion-item"
                    onClick={() => setExpandedSyllabus(isExpanded ? null : course.code)}
                  >
                    <div className="syllabus-item-header">
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#C07660", marginRight: 8 }}>{course.code}</span>
                        <strong style={{ fontSize: 14, color: "#242523" }}>{course.name}</strong>
                      </div>
                      <span style={{ fontSize: 12, color: "#8C887B" }}>{isExpanded ? "▲ Hide" : "▼ Syllabus"}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EAE3D6", fontSize: 13, lineHeight: 1.6, color: "#575854" }}>
                        <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "#FFF8F5", border: "1px solid #F4EBE6" }}>
                          <strong style={{ color: "#9C5B49" }}>Mid-Sem Target Modules:</strong>{" "}
                          {radarSyllabus?.syllabusCoverage || "Modules 1 & 2 (Tentative). Official unit coverage will be updated once faculty releases question bank."}
                        </div>
                        <div>
                          <strong>Prescribed Textbook:</strong> {course.textbooks}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <strong>Full Syllabus Topics:</strong> {course.syllabus}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: 5TH SEM CURRICULUM
         ========================================================================= */}
      {activeSubTab === "curriculum" && (
        <div>
          <div style={{ margin: "14px 0 16px", padding: "12px 16px", borderRadius: 12, background: "#FAF7F2", border: "1px solid #EAE3D6", fontSize: 13, color: "#6B685F" }}>
            📌 <strong>Curriculum Handbook Note:</strong> B.Tech CSE Admission Batches 2024 + 2025. Subjects with Black Highlighting (CSE 3544, CSE 3249, CSE 3751) are strictly required for promotion to 4th year. <em>The prescribed textbooks are required and will be the only ones used.</em>
          </div>

          <div className="curriculum-grid">
            {curriculumList.map((course) => {
              const isExpanded = expandedCourse === course.code;
              return (
                <div key={course.code} className="curriculum-card">
                  <div>
                    <div className="curriculum-top">
                      <span className="course-code">{course.code}</span>
                      {course.isRequiredForPromotion && (
                        <span className="promotion-badge">Required for Promotion</span>
                      )}
                      {course.isMandatoryExtracurricular && (
                        <span className="promotion-badge" style={{ background: "#E0F2FE", color: "#0369A1" }}>
                          Mandatory Extracurricular
                        </span>
                      )}
                    </div>

                    <h3 className="course-name">{course.name}</h3>

                    <div className="course-meta-tags">
                      <span className="meta-chip">⭐ {course.credits} Credits</span>
                      <span className="meta-chip">⏱️ Format: {course.weeklyFormat}</span>
                      <span className="meta-chip">📊 Pattern: GP-{course.gradingPattern}</span>
                    </div>

                    <div style={{ fontSize: 12.5, color: "#6B685F", marginBottom: 10, lineHeight: 1.4 }}>
                      📚 <strong>Prescribed Book:</strong> {course.textbooks}
                    </div>

                    {isExpanded && (
                      <div style={{ fontSize: 12, color: "#575854", lineHeight: 1.6, background: "#FFFBF8", padding: 12, borderRadius: 10, border: "1px solid #F4EBE6", marginTop: 8 }}>
                        <strong>Curriculum Modules:</strong>
                        <p style={{ margin: "4px 0 0", whiteSpace: "pre-line" }}>{course.syllabus}</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedCourse(isExpanded ? null : course.code)}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      padding: "8px",
                      borderRadius: 10,
                      background: isExpanded ? "#F4EFEA" : "transparent",
                      border: "1px solid #E6DCD0",
                      color: "#C07660",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isExpanded ? "▲ Collapse Syllabus" : "▼ View Detailed Syllabus"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: CALENDAR & 12 OFFICIAL GAZETTED HOLIDAYS
         ========================================================================= */}
      {activeSubTab === "calendar" && (
        <div>
          <div style={{ margin: "14px 0 16px", padding: "12px 16px", borderRadius: 12, background: "#FAF7F2", border: "1px solid #EAE3D6", fontSize: 13, color: "#575854" }}>
            ℹ️ <strong>Official Student Holiday Policy:</strong> Reflects exactly the 12 official Gazetted Holidays for calendar year 2026. The 10 optional holidays (for hospital and administrative staff only) have been excluded.
          </div>

          <div className="holidays-calendar-layout">
            {/* Gazetted Holidays */}
            <div className="calendar-section-card">
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: "0 0 14px", color: "#242523" }}>
                Official Gazetted Holidays (2026)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {holidaysList.map((h, i) => (
                  <div key={i} className="holiday-row">
                    <div>
                      <div className="holiday-name">{h.name}</div>
                      <div style={{ fontSize: 11.5, color: "#8C887B" }}>{h.dayOfWeek} • {h.description || "University Holiday"}</div>
                    </div>
                    <span className="holiday-date">{h.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Academic Milestones */}
            <div className="calendar-section-card">
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: "0 0 14px", color: "#242523" }}>
                Odd Semester Milestones (2026)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {academicData?.calendar?.oddSemester?.map((m, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "#FFFDF9", border: "1px solid #F4EBE6", borderRadius: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#242523" }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: "#C07660", fontWeight: 700, marginTop: 2 }}>🗓️ {m.date}</div>
                  </div>
                )) || (
                  <div style={{ fontSize: 13, color: "#8C887B" }}>
                    • Odd Sem Commencement: 27th August 2026<br />
                    • Mid Semester Examination: 26th October to 4th November 2026<br />
                    • End Semester Lab Exam: 17th December to 24th December 2026<br />
                    • End Semester Theory Exam: 6th January to 16th January 2027
                  </div>
                )}

                <h4 style={{ fontFamily: "var(--font-serif)", fontSize: 16, margin: "14px 0 6px", color: "#242523" }}>
                  Even Semester Milestones (2027)
                </h4>
                {academicData?.calendar?.evenSemester?.map((m, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "#FFFDF9", border: "1px solid #F4EBE6", borderRadius: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#242523" }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: "#C07660", fontWeight: 700, marginTop: 2 }}>🗓️ {m.date}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TIMETABLE PARSER & ENGINE
         ========================================================================= */}
      {showEditModal && (
        <div className="acad-modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="acad-modal-window" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, margin: 0, color: "#242523" }}>
                Smart Timetable Parser Engine
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8C887B" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#6B685F", margin: "0 0 16px", lineHeight: 1.5 }}>
              Paste your branch/section timetable text, WhatsApp class schedule message, or copy-pasted table rows below. The engine will extract the <strong>Classroom Number</strong>, <strong>Teacher Name</strong>, <strong>Subject Code</strong>, and <strong>Time Slots</strong> automatically!
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                  Section Name
                </label>
                <input
                  type="text"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  placeholder="e.g. CSE Section 5A"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E6DCD0", background: "#FFFDF9", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                  Default Classroom / Hall
                </label>
                <input
                  type="text"
                  value={customRoom}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  placeholder="e.g. Room 304 (C-Block)"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E6DCD0", background: "#FFFDF9", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                Paste Timetable Text / Schedule Data
              </label>
              <textarea
                className="acad-textarea"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={`Example Format:\nMonday\n08:00 AM - 09:00 AM | CSE 3249 Operating Systems | Room 304 | Prof. S. Mohanty\n10:15 AM - 12:15 PM | CSE 3544 C Lab | Software Lab 2 | Prof. Harwani\nTuesday\n...`}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: "#F4EFEA", border: "1px solid #E6DCD0", color: "#575854", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoParseTimetable}
                disabled={parsingEngineRunning}
                style={{
                  background: "#C07660",
                  color: "#FAF7F2",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: parsingEngineRunning ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {parsingEngineRunning ? "Running Engine..." : "⚡ Parse & Save Timetable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SUPERADMIN EXAM RADAR EDITOR
         ========================================================================= */}
      {showAdminExamModal && (
        <div className="acad-modal-backdrop" onClick={() => setShowAdminExamModal(false)}>
          <div className="acad-modal-window" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, margin: 0, color: "#242523" }}>
                SuperAdmin Exam Radar Setup
              </h3>
              <button
                onClick={() => setShowAdminExamModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8C887B" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                Exam Status
              </label>
              <select
                value={adminExamStatus}
                onChange={(e) => setAdminExamStatus(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E6DCD0", background: "#FFFDF9", fontSize: 13 }}
              >
                <option value="yet_to_be_decided">⏳ Yet to be Decided (Tentative Countdown)</option>
                <option value="announced">📢 Datesheet Announced (Show Datesheet Table)</option>
                <option value="active">🔥 Exams Active / Ongoing</option>
                <option value="completed">✓ Exams Completed</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                Exam Title
              </label>
              <input
                type="text"
                value={adminExamTitle}
                onChange={(e) => setAdminExamTitle(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E6DCD0", background: "#FFFDF9", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                Tentative Date Range
              </label>
              <input
                type="text"
                value={adminExamRange}
                onChange={(e) => setAdminExamRange(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E6DCD0", background: "#FFFDF9", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#575854", marginBottom: 4 }}>
                Official Examination Division Notice
              </label>
              <textarea
                value={adminExamNotice}
                onChange={(e) => setAdminExamNotice(e.target.value)}
                placeholder="Notice message for students..."
                style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 10, border: "1px solid #E6DCD0", background: "#FFFDF9", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAdminExamModal(false)}
                style={{ background: "#F4EFEA", border: "1px solid #E6DCD0", color: "#575854", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExamRadarAdmin}
                style={{ background: "#242523", color: "#FAF7F2", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Publish Exam Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
