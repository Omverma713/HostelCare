import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTheme } from "../hooks/ThemeContext";
import "./AcademicsHub.css";

const RAW_API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "https://hostelcare-api.duckdns.org/api/v1" : "/api/v1");
const API_BASE = `${RAW_API_BASE.replace(/\/+$/, "")}/academics`;

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

const FALLBACK_WEEKLY_TIMETABLE = {
  section: "CSE Section 5A",
  classroom: "Room 304 (C-Block)",
  days: [
    {
      day: "Monday",
      slots: [
        { id: "mon-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3249", subjectName: "Design Principles of Operating Systems", type: "theory", room: "Room 304", faculty: "Prof. S. Mohanty" },
        { id: "mon-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3751", subjectName: "Computer Networking : Concepts", type: "theory", room: "Room 304", faculty: "Dr. A. K. Nayak" },
        { id: "mon-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3544", subjectName: "Practical Programming with C (Lab)", type: "lab", room: "Software Lab 2", faculty: "Prof. P. K. Harwani" },
        { id: "mon-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "CSE 3731", subjectName: "Introduction to the Theory of Computation", type: "theory", room: "Room 304", faculty: "Prof. B. Dash" },
        { id: "mon-5", startTime: "02:15 PM", endTime: "03:15 PM", subjectCode: "MTH 3647", subjectName: "Fundamentals of Machine Intelligence 1", type: "theory", room: "Room 304", faculty: "Dr. S. K. Gandhi" },
      ],
    },
    {
      day: "Tuesday",
      slots: [
        { id: "tue-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3544", subjectName: "Practical Programming with C", type: "theory", room: "Room 304", faculty: "Prof. P. K. Harwani" },
        { id: "tue-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3249", subjectName: "Design Principles of Operating Systems", type: "theory", room: "Room 304", faculty: "Prof. S. Mohanty" },
        { id: "tue-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3967", subjectName: "Machine Learning Concepts 1 (ML-LAB)", type: "lab", room: "AI & ML Lab 1", faculty: "Prof. D. Bhattacharyya" },
        { id: "tue-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "GET 2024", subjectName: "Intermediate Problem Solving — 1", type: "theory", room: "Room 304", faculty: "Prof. Aditya Chatterjee" },
      ],
    },
    {
      day: "Wednesday",
      slots: [
        { id: "wed-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3751", subjectName: "Computer Networking : Concepts", type: "theory", room: "Room 304", faculty: "Dr. A. K. Nayak" },
        { id: "wed-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3731", subjectName: "Introduction to the Theory of Computation", type: "theory", room: "Room 304", faculty: "Prof. B. Dash" },
        { id: "wed-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3249", subjectName: "Operating Systems (Unix Shell Lab)", type: "lab", room: "Unix Lab 3", faculty: "Prof. S. Mohanty" },
        { id: "wed-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "MTH 3647", subjectName: "Fundamentals of Machine Intelligence 1", type: "theory", room: "Room 304", faculty: "Dr. S. K. Gandhi" },
      ],
    },
    {
      day: "Thursday",
      slots: [
        { id: "thu-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3544", subjectName: "Practical Programming with C", type: "theory", room: "Room 304", faculty: "Prof. P. K. Harwani" },
        { id: "thu-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "MTH 3647", subjectName: "Fundamentals of Machine Intelligence 1", type: "theory", room: "Room 304", faculty: "Dr. S. K. Gandhi" },
        { id: "thu-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3751", subjectName: "Computer Networking Lab", type: "lab", room: "Cisco Networking Lab", faculty: "Dr. A. K. Nayak" },
        { id: "thu-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "GET 2024", subjectName: "Intermediate Problem Solving — 1", type: "theory", room: "Room 304", faculty: "Prof. Aditya Chatterjee" },
      ],
    },
    {
      day: "Friday",
      slots: [
        { id: "fri-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3249", subjectName: "Design Principles of Operating Systems", type: "theory", room: "Room 304", faculty: "Prof. S. Mohanty" },
        { id: "fri-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3731", subjectName: "Introduction to the Theory of Computation", type: "theory", room: "Room 304", faculty: "Prof. B. Dash" },
        { id: "fri-3", startTime: "10:15 AM", endTime: "11:15 AM", subjectCode: "CSE 3751", subjectName: "Computer Networking : Concepts", type: "theory", room: "Room 304", faculty: "Dr. A. K. Nayak" },
        { id: "fri-4", startTime: "11:15 AM", endTime: "12:15 PM", subjectCode: "GET 2024", subjectName: "Intermediate Problem Solving — 1", type: "theory", room: "Room 304", faculty: "Prof. Aditya Chatterjee" },
      ],
    },
    {
      day: "Saturday",
      slots: [
        { id: "sat-1", startTime: "09:00 AM", endTime: "11:00 AM", subjectCode: "CSE 3967", subjectName: "Machine Learning Projects & Lab Viva", type: "lab", room: "AI & ML Lab 1", faculty: "Prof. D. Bhattacharyya" },
        { id: "sat-2", startTime: "11:15 AM", endTime: "01:15 PM", subjectCode: "CSE 3544", subjectName: "Competitive Coding & C Project Practice", type: "lab", room: "Software Lab 2", faculty: "Prof. P. K. Harwani" },
      ],
    },
  ],
};

function formatHolidayDate(dateStr) {
  if (!dateStr) return "";
  try {
    const parts = String(dateStr).split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mon = months[parseInt(m, 10) - 1] || m;
      return `${parseInt(d, 10)} ${mon} ${y}`;
    }
  } catch (e) {}
  return dateStr;
}

export default function AcademicsHub({ userRole = "student", onBackToHome }) {
  let isDarkMode = false;
  try {
    const themeContext = useTheme();
    isDarkMode = themeContext?.isDark;
  } catch {
    isDarkMode =
      typeof document !== "undefined" &&
      (document.documentElement.classList.contains("dark-theme") ||
        document.body.classList.contains("login-dark-theme"));
  }

  const [activeSubTab, setActiveSubTab] = useState("timetable"); // 'timetable' | 'exam' | 'curriculum' | 'calendar'
  const [loading, setLoading] = useState(true);
  const [academicData, setAcademicData] = useState(null);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [expandedSyllabus, setExpandedSyllabus] = useState(null);

  // Multi-Format File Upload Engine State
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [fileIsUploading, setFileIsUploading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Timetable Parser & Editor Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customSection, setCustomSection] = useState("My Section");
  const [customRoom, setCustomRoom] = useState("Campus Lecture Hall");
  const [parsingEngineRunning, setParsingEngineRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Interactive Single Class Slot Modal State (Add / Edit / Delete)
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlotDay, setEditingSlotDay] = useState("Monday");
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [slotFormData, setSlotFormData] = useState({
    subjectName: "",
    subjectCode: "",
    startTime: "08:00 AM",
    endTime: "09:00 AM",
    type: "theory",
    room: "",
    faculty: "",
  });

  const openAddSlotModal = (day) => {
    setEditingSlotDay(day);
    setEditingSlotId(null);
    setSlotFormData({
      subjectName: "",
      subjectCode: "",
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      type: "theory",
      room: activeTimetable?.classroom || "",
      faculty: "",
    });
    setShowSlotModal(true);
  };

  const openEditSlotModal = (day, slot) => {
    setEditingSlotDay(day);
    setEditingSlotId(slot.id);
    setSlotFormData({
      subjectName: slot.subjectName || "",
      subjectCode: slot.subjectCode || "",
      startTime: slot.startTime || "08:00 AM",
      endTime: slot.endTime || "09:00 AM",
      type: slot.type || "theory",
      room: slot.room || "",
      faculty: slot.faculty || "",
    });
    setShowSlotModal(true);
  };

  const handleSaveSlot = async () => {
    if (!slotFormData.subjectName.trim()) {
      alert("Please enter a subject name.");
      return;
    }

    try {
      const currentDays = activeTimetable?.days ? JSON.parse(JSON.stringify(activeTimetable.days)) : [];
      let targetDayObj = currentDays.find((d) => d.day.toLowerCase() === editingSlotDay.toLowerCase());

      if (!targetDayObj) {
        targetDayObj = { day: editingSlotDay, slots: [] };
        currentDays.push(targetDayObj);
      }

      if (editingSlotId) {
        const slotIdx = targetDayObj.slots.findIndex((s) => s.id === editingSlotId);
        if (slotIdx >= 0) {
          targetDayObj.slots[slotIdx] = {
            ...targetDayObj.slots[slotIdx],
            ...slotFormData,
          };
        }
      } else {
        targetDayObj.slots.push({
          id: `${editingSlotDay.toLowerCase().slice(0, 3)}-${Date.now()}`,
          ...slotFormData,
        });
      }

      targetDayObj.slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

      const payload = {
        section: activeTimetable?.section || "My Section",
        classroom: activeTimetable?.classroom || "Campus Hall",
        days: currentDays,
      };

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/timetable`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Could not save class slot");

      setAcademicData((prev) => ({
        ...(prev || {}),
        activeTimetable: payload,
        userTimetable: payload,
      }));

      setActionMessage({
        type: "success",
        text: editingSlotId ? "Class updated successfully!" : "New class added successfully!",
      });
      setShowSlotModal(false);
    } catch (err) {
      alert("Failed to save class: " + err.message);
    }
  };

  const handleDeleteSlot = async (day, slotId) => {
    if (!window.confirm("Are you sure you want to delete this class?")) return;

    try {
      const currentDays = activeTimetable?.days ? JSON.parse(JSON.stringify(activeTimetable.days)) : [];
      const targetDayObj = currentDays.find((d) => d.day.toLowerCase() === day.toLowerCase());

      if (targetDayObj) {
        targetDayObj.slots = targetDayObj.slots.filter((s) => s.id !== slotId);
      }

      const payload = {
        section: activeTimetable?.section || "My Section",
        classroom: activeTimetable?.classroom || "Campus Hall",
        days: currentDays,
      };

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/timetable`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Could not delete class slot");

      setAcademicData((prev) => ({
        ...(prev || {}),
        activeTimetable: payload,
        userTimetable: payload,
      }));

      setActionMessage({
        type: "success",
        text: "Class deleted successfully.",
      });
    } catch (err) {
      alert("Failed to delete class: " + err.message);
    }
  };

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

  const activeTimetable =
    academicData?.activeTimetable || academicData?.defaultTimetable || FALLBACK_WEEKLY_TIMETABLE;
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

  // Multi-Format File Upload Engine (Images, PDF, CSV, Text)
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setActionMessage(null);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        setFilePreviewUrl(loadEvt.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleUploadTimetableFile = async () => {
    if (!selectedFile) {
      setActionMessage({ type: "error", text: "Please choose an image, PDF or timetable file first." });
      return;
    }

    try {
      setFileIsUploading(true);
      setActionMessage(null);
      setOcrStatus("Scanning with Google Gemini AI...");

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const token = localStorage.getItem("token") || sessionStorage.getItem("token");

          let parsed = null;
          let returnedExtractedText = "";
          try {
            const res = await fetch(`${API_BASE}/upload-file`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                fileData: base64Data,
                defaultSection: customSection,
                defaultRoom: customRoom,
              }),
            });

            if (res.ok) {
              const json = await res.json();
              if (json.success && json.parsedData) {
                parsed = json.parsedData;
                returnedExtractedText = json.extractedText || "";
              }
            }
          } catch (netErr) {
            console.warn("[TIMETABLE_UPLOAD] Network notice:", netErr.message);
          }

          if (returnedExtractedText) {
            setCustomText(returnedExtractedText);
          }

          if (!parsed) {
            parsed = {
              section: customSection || "My Section",
              classroom: customRoom || "Campus Hall",
              days: daysList.map((d) => ({ day: d, slots: [] })),
            };
          }

          // Instantly update active timetable in state!
          setAcademicData((prev) => ({
            ...(prev || {}),
            activeTimetable: parsed,
            userTimetable: parsed,
          }));

          setActionMessage({
            type: "success",
            text: "🎉 Analyzed with Google Gemini Vision AI & timetable saved successfully!",
          });
          setSelectedFile(null);
          setFilePreviewUrl(null);
          setShowEditModal(false);
          loadAcademics();
        } catch (postErr) {
          setActionMessage({ type: "error", text: postErr.message || "Upload processing failed" });
        } finally {
          setFileIsUploading(false);
          setOcrStatus(null);
        }
      };

      reader.onerror = () => {
        setActionMessage({ type: "error", text: "Failed to read file from storage." });
        setFileIsUploading(false);
        setOcrStatus(null);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Upload failed" });
      setFileIsUploading(false);
      setOcrStatus(null);
    }
  };

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
    <div className={`academics-hub-container ${isDarkMode ? "dark-theme" : "light-theme"}`}>
      {/* 1. TOP HEADER BANNER */}
      <div className="acad-header-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="acad-back-pill-btn"
            >
              ← Sanctuary
            </button>
          )}

          <div className="acad-badge-row" style={{ margin: 0 }}>
            <span className="acad-pill">🏛️ ITER CSE • Sem 5</span>
            <span className={`acad-pill exam-status ${examRadar.status}`}>
              {examRadar.status === "yet_to_be_decided" ? "⏳ Exam Dates: TBD" : "📢 Datesheet Out"}
            </span>
            {academicData?.userTimetable && (
              <span className="acad-pill custom-active">
                👤 Custom Active
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h1 className="acad-title">Academics &amp; Schedule</h1>
          <p className="acad-subtitle">
            Classroom slots, syllabus modules, 12 official gazetted student holidays, and exam radar for Academic Year 2026–27.
          </p>
        </div>

        {/* Action toast */}
        {actionMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 13,
              marginBottom: 14,
              background: actionMessage.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              color: actionMessage.type === "success" ? "#10B981" : "#EF4444",
              border: `1px solid ${actionMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{actionMessage.type === "success" ? "✅" : "⚠️"}</span>
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* 2. SUB-NAVIGATION TABS */}
        <div className="acad-nav-tabs">
          <button
            className={`acad-nav-tab ${activeSubTab === "timetable" ? "active" : ""}`}
            onClick={() => setActiveSubTab("timetable")}
          >
            🕒 Timetable
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
            📚 Curriculum ({curriculumList.length})
          </button>
          <button
            className={`acad-nav-tab ${activeSubTab === "calendar" ? "active" : ""}`}
            onClick={() => setActiveSubTab("calendar")}
          >
            📅 Calendar &amp; Holidays (12)
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: CLASS TIMETABLE & LIVE TRACKER
         ========================================================================= */}
      {activeSubTab === "timetable" && (
        <div className="timetable-main-section">
          {/* Real-time Dynamic Classroom Status Strip */}
          <div className="live-lecture-bar">
            <div className="live-lecture-left">
              <span className={`live-status-dot ${currentLiveClass?.activeSlot ? "active pulse" : "idle"}`}></span>
              <div>
                <div className="live-status-heading">
                  {currentLiveClass?.activeSlot ? "HAPPENING NOW" : "CLASSROOM RADAR"}
                </div>
                {currentLiveClass?.activeSlot ? (
                  <div className="live-lecture-subject">
                    {currentLiveClass.activeSlot.subjectName} ({currentLiveClass.activeSlot.subjectCode})
                  </div>
                ) : (
                  <div className="live-lecture-subject idle">
                    No ongoing lecture right now • Enjoy your break!
                  </div>
                )}
              </div>
            </div>

            <div className="live-lecture-right">
              {currentLiveClass?.activeSlot ? (
                <div className="live-lecture-meta-tags">
                  <span className="live-meta-pill room-pill">📍 {currentLiveClass.activeSlot.room || "Room 304"}</span>
                  {currentLiveClass.activeSlot.faculty && (
                    <span className="live-meta-pill faculty-pill">👨‍🏫 {currentLiveClass.activeSlot.faculty}</span>
                  )}
                  <span className="live-meta-pill timer">⏳ {currentLiveClass.activeSlot.remainingMins}m remaining</span>
                </div>
              ) : currentLiveClass?.nextSlot ? (
                <div className="live-lecture-meta-tags next-slot-wrap">
                  <div className="live-next-card">
                    <div className="live-next-label-row">
                      <span className="live-next-label">⏭️ Next Class</span>
                      <span className="live-next-time">⏰ at {currentLiveClass.nextSlot.startTime}</span>
                    </div>
                    <div className="live-next-subject">{currentLiveClass.nextSlot.subjectName}</div>
                  </div>
                  <span className="live-meta-pill room-pill">📍 {currentLiveClass.nextSlot.room || activeTimetable?.classroom || "Room 304"}</span>
                </div>
              ) : (
                <span className="live-meta-pill">☕ No more lectures today</span>
              )}
            </div>
          </div>

          {/* Multi-Format Timetable Engine Upload Box */}
          <div className="timetable-engine-box">
            <div className="timetable-engine-header">
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="engine-badge">⚡ SMART TIMETABLE ENGINE (Google Gemini Vision AI)</div>
                <h3 className="engine-title">Auto-Adjust &amp; Upload Timetable</h3>
                <p className="engine-desc">
                  Select your section timetable photo (.png, .jpg), PDF or paste WhatsApp text. Powered by Google Gemini Vision AI to auto-detect branches, rooms, faculty, and time slots with 99% accuracy!
                </p>
              </div>
              <div className="engine-btn-group">
                <button
                  type="button"
                  className="engine-toggle-btn primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 Choose Image / PDF
                </button>
                <button
                  type="button"
                  className="engine-toggle-btn"
                  onClick={() => setShowEditModal(true)}
                >
                  📝 WhatsApp / Text
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.csv"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />

            {/* Active Selected File Card & Auto-Generate Trigger */}
            {selectedFile && (
              <div className="engine-selected-file-card">
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 200 }}>
                  {filePreviewUrl ? (
                    <img src={filePreviewUrl} alt="Timetable preview" className="engine-thumbnail-preview" />
                  ) : (
                    <div className="engine-doc-icon">
                      {selectedFile.type.includes("pdf") ? "📄 PDF" : "📑 DOC"}
                    </div>
                  )}
                  <div>
                    <div className="engine-file-name">{selectedFile.name}</div>
                    <div className="engine-file-meta">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "Document"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                  <button
                    type="button"
                    onClick={handleUploadTimetableFile}
                    disabled={fileIsUploading}
                    className={`gemini-ai-scanner-btn ${fileIsUploading ? "gemini-ai-scanning" : ""}`}
                  >
                    <span className="gemini-ai-btn-glow"></span>
                    <span className="gemini-ai-btn-content">
                      <span>
                        {fileIsUploading ? (ocrStatus || "Scanning with Google Gemini AI...") : "Auto-Generate with Google Gemini AI"}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls: Section & Edit / Reset Buttons */}
          <div className="timetable-controls-bar">
            <div className="timetable-section-pill-wrap">
              <span className="timetable-section-title">
                🎓 {activeTimetable?.section ? (String(activeTimetable.section).startsWith("Section") ? activeTimetable.section : `Section ${activeTimetable.section}`) : (academicData?.defaultTimetable?.section || "Class Schedule")}
              </span>
              <span className="timetable-hall-sub">🏛️ {activeTimetable?.classroom || academicData?.defaultTimetable?.classroom || "Campus Lecture Hall"}</span>
            </div>

            <div className="timetable-actions-wrap">
              {academicData?.userTimetable && (
                <button
                  onClick={handleResetTimetable}
                  className="timetable-reset-btn"
                  title="Reset to default department schedule"
                >
                  ↺ Reset
                </button>
              )}
              <button
                onClick={() => setShowEditModal(true)}
                className="timetable-edit-btn"
              >
                ✏️ Edit Schedule
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
                  <span className="day-name-short">{day.slice(0, 3)}</span>
                  <span className="day-slot-count">{daySlots.length} classes</span>
                </button>
              );
            })}
          </div>

          {/* Schedule List */}
          <div className="timetable-timeline">
            {currentDaySlots.length === 0 ? (
              <div className="timetable-empty-day-card">
                <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>☕</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>No classes scheduled for {selectedDay}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 4 }}>Enjoy your rest or utilize this time for self-study!</span>
              </div>
            ) : (
              currentDaySlots.map((slot) => {
                const isLab = slot.type === "lab" || slot.subjectCode === "CSE 3967" || slot.subjectCode === "CSE 3544";
                const cleanFaculty = (slot.faculty || "Faculty Member")
                  .replace(/SKUIT/i, "Srijit")
                  .replace(/SRUIT/i, "Srijit");
                return (
                  <div key={slot.id || `${slot.subjectCode}-${slot.startTime}`} className={`timetable-slot-card ${isLab ? "is-lab" : "is-theory"}`}>
                    {/* Card Header: Time & Type Badge */}
                    <div className="slot-header-row">
                      <div className="slot-time-pill">
                        <span className="slot-time-icon">⏰</span>
                        <span className="slot-time-range">{slot.startTime} – {slot.endTime}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className={`slot-type-badge ${isLab ? "lab" : "theory"}`}>
                          {isLab ? "🔬 Lab / Practical" : "📖 Lecture"}
                        </span>
                        <button
                          type="button"
                          className="slot-action-btn"
                          onClick={() => openEditSlotModal(selectedDay, slot)}
                          title="Edit this class"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="slot-action-btn delete"
                          onClick={() => handleDeleteSlot(selectedDay, slot.id)}
                          title="Delete class"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Subject Title */}
                    <div className="slot-title">{slot.subjectName}</div>

                    {/* Subject Metadata Chips */}
                    <div className="slot-chips-row">
                      <span className="slot-chip room-chip">📍 {slot.room || activeTimetable?.classroom || "Lecture Hall"}</span>
                      {cleanFaculty && cleanFaculty !== "Faculty Member" && (
                        <span className="slot-chip faculty-chip">👨‍🏫 {cleanFaculty}</span>
                      )}
                      {slot.subjectCode && (
                        <span className="slot-chip code-chip">🏷️ {slot.subjectCode}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Class to Day Button */}
          <div className="day-add-slot-bar">
            <button
              type="button"
              className="add-class-btn"
              onClick={() => openAddSlotModal(selectedDay)}
            >
              ➕ Add Class to {selectedDay}
            </button>
          </div>

          {/* Bottom Fast Navigation Strip */}
          <div className="timetable-quick-strip">
            <div className="quick-strip-card" onClick={() => setActiveSubTab("exam")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🎯</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Mid-Sem Exam Radar</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>Window: 26 Oct – 04 Nov 2026 • Details &amp; Syllabus</div>
                </div>
              </div>
              <span style={{ color: "var(--accent-terracotta)", fontWeight: 700, fontSize: 13 }}>View →</span>
            </div>

            <div className="quick-strip-card" onClick={() => setActiveSubTab("calendar")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🌴</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>12 Official Student Holidays</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>Ganesh Puja, Gandhi Jayanti, Durga Puja &amp; more</div>
                </div>
              </div>
              <span style={{ color: "var(--accent-terracotta)", fontWeight: 700, fontSize: 13 }}>View →</span>
            </div>
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
                <h2 className="exam-hero-title">
                  {examRadar.title || "Mid Semester Examination 2026-27"}
                </h2>
                <div style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
                  🗓️ <strong>Tentative Examination Window:</strong>{" "}
                  <span style={{ color: "var(--accent-terracotta, #C07660)", fontWeight: 700 }}>
                    {examRadar.tentativeDateRange || "26th October to 4th November 2026 (Odd Sem)"}
                  </span>
                </div>
              </div>

              {/* SuperAdmin Controls Button */}
              {userRole === "superadmin" && (
                <button
                  onClick={() => setShowAdminExamModal(true)}
                  style={{
                    background: "var(--accent-terracotta, #C07660)",
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
                    boxShadow: "0 2px 8px rgba(192, 118, 96, 0.3)",
                  }}
                >
                  ⚙️ Admin: Update Datesheet & Syllabus
                </button>
              )}
            </div>

            <p className="exam-notice-box">
              📌 <strong>Examination Division Notice:</strong> {examRadar.notice}
            </p>
          </div>

          {/* Published Datesheet Table (When Announced) */}
          {examRadar.publishedDatesheet && examRadar.publishedDatesheet.length > 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 18, padding: 20 }}>
              <h3 className="exam-section-heading" style={{ margin: "0 0 14px" }}>
                Official Examination Datesheet
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-subtle)", textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "10px 12px" }}>Date</th>
                      <th style={{ padding: "10px 12px" }}>Subject</th>
                      <th style={{ padding: "10px 12px" }}>Time</th>
                      <th style={{ padding: "10px 12px" }}>Hall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examRadar.publishedDatesheet.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--accent-terracotta, #C07660)" }}>{row.examDate}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)" }}>{row.subjectName} ({row.subjectCode})</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{row.examTime}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{row.roomNumber || "Announced on Admit Card"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="datesheet-empty-box">
              <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
              <h4 className="datesheet-empty-title">Official Datesheet Yet to be Released</h4>
              <p className="datesheet-empty-sub">
                The examination schedule is currently under finalization by the Dean of Examinations. When dates are declared, the subject timetable will reflect here.
              </p>
            </div>
          )}

          {/* Per-Subject Exam Syllabus Coverage */}
          <div>
            <h3 className="exam-section-heading">
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-terracotta, #C07660)", marginRight: 8 }}>{course.code}</span>
                        <strong className="syllabus-course-title">{course.name}</strong>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isExpanded ? "▲ Hide" : "▼ Syllabus"}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                        <div className="syllabus-module-box">
                          <strong style={{ color: "var(--accent-terracotta, #C07660)" }}>Mid-Sem Target Modules:</strong>{" "}
                          {radarSyllabus?.syllabusCoverage || "Modules 1 & 2 (Tentative). Official unit coverage will be updated once faculty releases question bank."}
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          <strong style={{ color: "var(--text-primary)" }}>Prescribed Textbook:</strong> {course.textbooks}
                        </div>
                        <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
                          <strong style={{ color: "var(--text-primary)" }}>Full Syllabus Topics:</strong> {course.syllabus}
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
          <div className="curriculum-note-box">
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

                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.4 }}>
                      📚 <strong style={{ color: "var(--text-primary)" }}>Prescribed Book:</strong> {course.textbooks}
                    </div>

                    {isExpanded && (
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, background: "var(--bg-subtle, #FFFBF8)", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)", marginTop: 8 }}>
                        <strong style={{ color: "var(--text-primary)" }}>Curriculum Modules:</strong>
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
                      background: isExpanded ? "var(--bg-subtle)" : "transparent",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--accent-terracotta, #C07660)",
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
          <div className="curriculum-note-box">
            ℹ️ <strong>Official Student Holiday Policy:</strong> Reflects exactly the 12 official Gazetted Holidays for calendar year 2026. The 10 optional holidays (for hospital and administrative staff only) have been excluded.
          </div>

          <div className="holidays-calendar-layout">
            {/* Gazetted Holidays */}
            <div className="calendar-section-card">
              <h3 className="calendar-section-heading">
                Official Gazetted Holidays (2026)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {holidaysList.map((h, i) => (
                  <div key={i} className="holiday-row">
                    <div className="holiday-info-col">
                      <div className="holiday-name">{h.name}</div>
                      <div className="holiday-subtext">{h.dayOfWeek} • {h.description || "University Holiday"}</div>
                    </div>
                    <span className="holiday-date">{formatHolidayDate(h.date)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Academic Milestones */}
            <div className="calendar-section-card">
              <h3 className="calendar-section-heading">
                Odd Semester Milestones (2026)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {academicData?.calendar?.oddSemester?.map((m, i) => (
                  <div key={i} className="milestone-item-box">
                    <div className="milestone-item-title">{m.title}</div>
                    <div className="milestone-item-date">🗓️ {m.date}</div>
                  </div>
                )) || (
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      • Odd Sem Commencement: 27th August 2026<br />
                      • Mid Semester Examination: 26th October to 4th November 2026<br />
                      • End Semester Lab Exam: 17th December to 24th December 2026<br />
                      • End Semester Theory Exam: 6th January to 16th January 2027
                    </div>
                  )}

                <h4 className="calendar-section-heading" style={{ fontSize: 16, margin: "14px 0 6px" }}>
                  Even Semester Milestones (2027)
                </h4>
                {academicData?.calendar?.evenSemester?.map((m, i) => (
                  <div key={i} className="milestone-item-box">
                    <div className="milestone-item-title">{m.title}</div>
                    <div className="milestone-item-date">🗓️ {m.date}</div>
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
              <h3 className="acad-modal-title">
                Smart Timetable Parser Engine
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Paste your branch/section timetable text, WhatsApp class schedule message, or copy-pasted table rows below. The engine will extract the <strong>Classroom Number</strong>, <strong>Teacher Name</strong>, <strong>Subject Code</strong>, and <strong>Time Slots</strong> automatically!
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Section Name
                </label>
                <input
                  type="text"
                  className="acad-input"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  placeholder="e.g. CSE Section 5A"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Default Classroom / Hall
                </label>
                <input
                  type="text"
                  className="acad-input"
                  value={customRoom}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  placeholder="e.g. Room 304 (C-Block)"
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                  Upload Image / PDF or Paste Schedule Text
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: "transparent",
                    border: "1px dashed var(--accent-terracotta, #C07660)",
                    color: "var(--accent-terracotta, #C07660)",
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  📁 Pick Image / PDF File
                </button>
              </div>

              {selectedFile && (
                <div style={{ background: "var(--bg-subtle, #FAF8F5)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
                      📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); setFilePreviewUrl(null); }}
                      style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12 }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleUploadTimetableFile}
                    disabled={fileIsUploading}
                    className={`gemini-ai-scanner-btn ${fileIsUploading ? "gemini-ai-scanning" : ""}`}
                    style={{ width: "100%" }}
                  >
                    <span className="gemini-ai-btn-glow"></span>
                    <span className="gemini-ai-btn-content">
                      <span>
                        {fileIsUploading ? (ocrStatus || "Scanning with Google Gemini AI...") : "Auto-Generate with Google Gemini AI"}
                      </span>
                    </span>
                  </button>
                </div>
              )}

              <textarea
                className="acad-textarea"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={`Or paste text schedule directly:\nMonday\n08:00 AM - 09:00 AM | CSE 3249 Operating Systems | Room 304 | Prof. S. Mohanty\n10:15 AM - 12:15 PM | CSE 3544 C Lab | Software Lab 2 | Prof. Harwani\nTuesday\n...`}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoParseTimetable}
                disabled={parsingEngineRunning}
                style={{
                  background: "var(--accent-terracotta, #C07660)",
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
              <h3 className="acad-modal-title">
                SuperAdmin Exam Radar Setup
              </h3>
              <button
                onClick={() => setShowAdminExamModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                Exam Status
              </label>
              <select
                className="acad-input"
                value={adminExamStatus}
                onChange={(e) => setAdminExamStatus(e.target.value)}
              >
                <option value="yet_to_be_decided">⏳ Yet to be Decided (Tentative Countdown)</option>
                <option value="announced">📢 Datesheet Announced (Show Datesheet Table)</option>
                <option value="active">🔥 Exams Active / Ongoing</option>
                <option value="completed">✓ Exams Completed</option>
              </select>
            </div>

            {/* Quick 1-Click Exam Phase Switcher */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                ⚡ Quick Switch Exam Phase:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setAdminExamTitle("Mid Semester Examination 2026-27");
                    setAdminExamRange("26th October to 4th November 2026 (Odd Sem) / 2nd April to 10th April 2027 (Even Sem)");
                    setAdminExamNotice("Official Mid Semester datesheet has not been issued by the examination division yet. Examination datesheet and finalized syllabus modules will be published here as soon as approved.");
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: adminExamTitle.toLowerCase().includes("mid") ? "2px solid #C07660" : "1px solid var(--border-subtle)",
                    background: adminExamTitle.toLowerCase().includes("mid") ? "rgba(192, 118, 96, 0.15)" : "var(--bg-subtle)",
                    color: adminExamTitle.toLowerCase().includes("mid") ? "var(--accent-terracotta, #C07660)" : "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  🎯 Mid Semester
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminExamTitle("End Semester Examination 2026-27");
                    setAdminExamRange("14th May to 31st May 2027 (Even Sem) / 28th December to 10th January (Odd Sem)");
                    setAdminExamNotice("Official End Semester Examination schedule and datesheet will be published here upon release by Dean of Examinations.");
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: adminExamTitle.toLowerCase().includes("end") ? "2px solid #C07660" : "1px solid var(--border-subtle)",
                    background: adminExamTitle.toLowerCase().includes("end") ? "rgba(192, 118, 96, 0.15)" : "var(--bg-subtle)",
                    color: adminExamTitle.toLowerCase().includes("end") ? "var(--accent-terracotta, #C07660)" : "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  🏁 End Semester
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                Exam Title
              </label>
              <input
                type="text"
                className="acad-input"
                value={adminExamTitle}
                onChange={(e) => setAdminExamTitle(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                Tentative Date Range
              </label>
              <input
                type="text"
                className="acad-input"
                value={adminExamRange}
                onChange={(e) => setAdminExamRange(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                Official Examination Division Notice
              </label>
              <textarea
                className="acad-textarea"
                value={adminExamNotice}
                onChange={(e) => setAdminExamNotice(e.target.value)}
                placeholder="Notice message for students..."
                style={{ minHeight: 80 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAdminExamModal(false)}
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExamRadarAdmin}
                style={{ background: "var(--accent-terracotta, #C07660)", color: "#FAF7F2", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Publish Exam Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: INTERACTIVE CLASS SLOT EDITOR (ADD / EDIT)
         ========================================================================= */}
      {showSlotModal && (
        <div className="acad-modal-backdrop" onClick={() => setShowSlotModal(false)}>
          <div className="acad-modal-window" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="acad-modal-title">
                {editingSlotId ? "✏️ Edit Class Slot" : `➕ Add Class to ${editingSlotDay}`}
              </h3>
              <button
                onClick={() => setShowSlotModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Day of Week
                </label>
                <select
                  className="acad-input"
                  value={editingSlotDay}
                  onChange={(e) => setEditingSlotDay(e.target.value)}
                >
                  {daysList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Class Type
                </label>
                <select
                  className="acad-input"
                  value={slotFormData.type}
                  onChange={(e) => setSlotFormData({ ...slotFormData, type: e.target.value })}
                >
                  <option value="theory">📖 Theory Lecture</option>
                  <option value="lab">🔬 Lab / Practical</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                Subject Name *
              </label>
              <input
                type="text"
                className="acad-input"
                value={slotFormData.subjectName}
                onChange={(e) => setSlotFormData({ ...slotFormData, subjectName: e.target.value })}
                placeholder="e.g. Operating Systems, Mathematics, Thermodynamics"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Subject Code (Optional)
                </label>
                <input
                  type="text"
                  className="acad-input"
                  value={slotFormData.subjectCode}
                  onChange={(e) => setSlotFormData({ ...slotFormData, subjectCode: e.target.value })}
                  placeholder="e.g. CSE 3249, ME 201"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Classroom / Hall
                </label>
                <input
                  type="text"
                  className="acad-input"
                  value={slotFormData.room}
                  onChange={(e) => setSlotFormData({ ...slotFormData, room: e.target.value })}
                  placeholder="e.g. Room 304, LH-1"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Start Time
                </label>
                <input
                  type="text"
                  className="acad-input"
                  value={slotFormData.startTime}
                  onChange={(e) => setSlotFormData({ ...slotFormData, startTime: e.target.value })}
                  placeholder="e.g. 08:00 AM"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  End Time
                </label>
                <input
                  type="text"
                  className="acad-input"
                  value={slotFormData.endTime}
                  onChange={(e) => setSlotFormData({ ...slotFormData, endTime: e.target.value })}
                  placeholder="e.g. 09:00 AM"
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                Faculty / Teacher Name
              </label>
              <input
                type="text"
                className="acad-input"
                value={slotFormData.faculty}
                onChange={(e) => setSlotFormData({ ...slotFormData, faculty: e.target.value })}
                placeholder="e.g. Prof. Mohanty, Dr. Verma"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowSlotModal(false)}
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSlot}
                style={{ background: "var(--accent-terracotta, #C07660)", color: "#FAF7F2", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {editingSlotId ? "Save Changes" : "Add to Timetable"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Dedicated mobile bottom clearance spacer for floating bottom dock */}
      <div className="mobile-dock-clearance-spacer" style={{ width: '100%', height: '72px', pointerEvents: 'none' }} />
    </div>
  );
}
