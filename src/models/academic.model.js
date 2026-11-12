const mongoose = require("mongoose");

const defaultCurriculum = [
  {
    code: "CSE 3544",
    name: "Practical Programming with C",
    credits: 4,
    gradingPattern: "1",
    weeklyFormat: "2L - 4P",
    isRequiredForPromotion: true,
    textbooks: "Practical C Programming by Harwani, Packt Publishing",
    syllabus: "Working with Arrays, Managing Strings, Exploring Functions, Preprocessing and Compilation, Deep Dive into Pointers, File Handling, Implementing Concurrency, Networking and Inter-Process Communication, Sorting and Searching, Working with Graphs, Advanced Data Structures and Algorithms, Creativity with Graphics, General-Purpose Utilities, Dynamic memory allocation, Improving the Performance of Your Code, Low-Level Programming, Applying Security in Coding.",
    tags: ["core", "programming", "lab"]
  },
  {
    code: "CSE 3249",
    name: "Design Principles of Operating Systems",
    credits: 4,
    gradingPattern: "1",
    weeklyFormat: "3L - 2P",
    isRequiredForPromotion: true,
    textbooks: "Operating Systems : Internals and Design Principles by Stallings, Pearson India; Unix Shell Programming by Yashavant Kanetkar, BPB Publications",
    syllabus: "Theory (From Stallings): Computer System Overview, Operating System Overview, Process Description and Control, Threads, Concurrency: Mutual Exclusion and Synchronization, Concurrency: Deadlock and Starvation, Memory Management, Virtual Memory, Uniprocessor Scheduling, Multiprocessor, Multicore and Real-Time Scheduling, I/O Management and Disk Scheduling, File Management.\nLabs (From Kanetkar): The Unix File System, Essential Unix Commands, I/O Redirection and Piping, vi - The King of All Editors, Processes in Unix, Communication - Unix Style.",
    tags: ["core", "systems", "lab"]
  },
  {
    code: "CSE 3751",
    name: "Computer Networking : Concepts",
    credits: 4,
    gradingPattern: "1",
    weeklyFormat: "3L - 2P",
    isRequiredForPromotion: true,
    textbooks: "CompTIA Network+ Certification Guide by Singh, Packt Publishing; CompTIA Network+ N10-009 Certification Guide by Neil, Packt Publishing",
    syllabus: "Singh: Exploring the OSI Model and TCP/IP, Network Topologies and Connections, Ethernet Technology and Virtualization, Understanding IPv4 and IPv6 Addressing, Applied IPv4 Subnetting, Exploring Network Protocols and Services, Data Center Architecture and Cloud Computing, Networking Devices, Routing and Switching Concepts, Exploring Wireless Standards and Technologies, Assuring Network Availability, Organizational Documents and Policies, High Availability and Disaster Recovery.\nNeil: Supplementary Practice questions and tests from secondary textbook.",
    tags: ["core", "networks", "lab"]
  },
  {
    code: "CSE 3967",
    name: "Machine Learning Concepts 1",
    credits: 2,
    gradingPattern: "5",
    weeklyFormat: "0L - 4P",
    isRequiredForPromotion: false,
    textbooks: "Practical Handbook of Machine Learning by Bhattacharyya, GK Publications",
    syllabus: "Prerequisites - Python, NumPy, Matplotlib, Pandas, Statistics and Probability, AIML Revolution, Prediction Problems Using Regression, Non-Linear Models and Feature Engineering, Sources of Model Error, Overfitting and Underfitting (Bias and Variance), Model Validation (Train-Test Split), Classification Problems, Digging Deeper into Classifier Accuracy: The Confusion Matrix, Distance-Based ML Algorithms, Feature Scaling, Decision Tree, Ensemble Models, Random Forest Classifier, Unsupervised Learning.",
    tags: ["ml", "ai", "lab-only"]
  },
  {
    code: "CSE 3731",
    name: "Introduction to the Theory of Computation",
    credits: 3,
    gradingPattern: "6",
    weeklyFormat: "3L - 0P",
    isRequiredForPromotion: false,
    textbooks: "Introduction to the Theory of Computation by Sipser, Cengage",
    syllabus: "Automata and Languages: Regular Languages, Context Free grammar.\nComputability: The Church Turing Thesis, Decidability, Reducibility.",
    tags: ["theory", "automata"]
  },
  {
    code: "MTH 3647",
    name: "Fundamentals of Machine Intelligence 1",
    credits: 3,
    gradingPattern: "6",
    weeklyFormat: "3L - 0P",
    isRequiredForPromotion: false,
    textbooks: "Artificial Intelligence and Machine Learning by Singh and Gandhi, McGraw Hill",
    syllabus: "Foundations of Artificial Intelligence, Intelligent Agents and Environments, Search and Problem Solving, Knowledge Representation and Logical Reasoning, Probabilistic Reasoning and Uncertainty, Machine Learning Basics and Techniques, Supervised Learning Techniques, Unsupervised Learning Techniques, Neural Networks and Deep Learning (if time permits).",
    tags: ["ai", "math"]
  },
  {
    code: "GET 2024",
    name: "Intermediate Problem Solving — 1",
    credits: 0,
    gradingPattern: "GP6",
    weeklyFormat: "120 mins (40 mins/session)",
    isRequiredForPromotion: false,
    isMandatoryExtracurricular: true,
    textbooks: "Open Genus, Notion Press: Problems on Array (Aditya Chatterjee), Linked List Problems, Binary Tree Problems, Binary Search Problems",
    syllabus: "Selected problems from relevant chapters of the four prescribed books to be used for programming practice and problem solving ability development. Minimum attendance criteria must be satisfied.",
    tags: ["extracurricular", "dsa", "coding"]
  }
];

const defaultHolidays = [
  { name: "Republic Day", date: "2026-01-26", dayOfWeek: "Monday", description: "National Gazetted Holiday" },
  { name: "Holi", date: "2026-03-04", dayOfWeek: "Wednesday", description: "Festival of Colors" },
  { name: "Good Friday", date: "2026-04-03", dayOfWeek: "Friday", description: "Gazetted Holiday" },
  { name: "Id-ul-Zuha", date: "2026-05-27", dayOfWeek: "Wednesday", description: "Gazetted Holiday" },
  { name: "Rath Yatra", date: "2026-07-16", dayOfWeek: "Thursday", description: "State & University Holiday" },
  { name: "Independence Day", date: "2026-08-15", dayOfWeek: "Saturday", description: "National Gazetted Holiday" },
  { name: "Janmasthami", date: "2026-09-04", dayOfWeek: "Friday", description: "Gazetted Holiday" },
  { name: "Ganesh Puja", date: "2026-09-14", dayOfWeek: "Monday", description: "Gazetted Holiday" },
  { name: "Gandhi Jayanti", date: "2026-10-02", dayOfWeek: "Friday", description: "National Gazetted Holiday" },
  { name: "Maha Navami", date: "2026-10-19", dayOfWeek: "Monday", description: "Durga Puja Gazetted Holiday" },
  { name: "Vijaya Dasami", date: "2026-10-20", dayOfWeek: "Tuesday", description: "Dussehra Gazetted Holiday" },
  { name: "X-Mass Day", date: "2026-12-25", dayOfWeek: "Friday", description: "Christmas Gazetted Holiday" }
];

const defaultAcademicCalendar = {
  oddSemester: [
    { title: "Commencement of Odd Semester Classes", date: "27th August 2026", type: "academic_start" },
    { title: "Conduction of 1st Quiz Test", date: "21st September to 26th September 2026", type: "quiz" },
    { title: "Conduction of 2nd Quiz Test", date: "12th October to 17th October 2026", type: "quiz" },
    { title: "Mid Semester Break", date: "19th October to 24th October 2026", type: "break" },
    { title: "Mid Semester Examination", date: "26th October to 4th November 2026", type: "exam" },
    { title: "Conduction of 3rd Quiz Test", date: "30th November to 5th December 2026", type: "quiz" },
    { title: "Last Day of Odd Semester Classes", date: "10th December 2026", type: "academic_end" },
    { title: "Revision Classes for End Semester Examination", date: "11th December to 15th December 2026", type: "academic" },
    { title: "End Semester Lab Exam", date: "17th December to 24th December 2026", type: "exam" },
    { title: "End Semester / Preparatory Break", date: "25th December 2026 to 5th January 2027", type: "break" },
    { title: "End Semester Theory Exam", date: "6th January to 16th January 2027", type: "exam" }
  ],
  evenSemester: [
    { title: "Commencement of Even Semester classes", date: "18th January 2027", type: "academic_start" },
    { title: "Even Semester Break", date: "10th February to 17th February 2027", type: "break" },
    { title: "Conduction of 1st Quiz Test", date: "22nd February to 27th February 2027", type: "quiz" },
    { title: "Conduction of 2nd Quiz Test", date: "15th March to 20th March 2027", type: "quiz" },
    { title: "Cultural and Technical Fest", date: "26th March to 28th March 2027", type: "fest" },
    { title: "Mid Semester Examination", date: "2nd April to 10th April 2027", type: "exam" },
    { title: "Conduction of 3rd Quiz test", date: "26th April to 1st May 2027", type: "quiz" },
    { title: "Last Day of Even Semester Classes", date: "6th May 2027", type: "academic_end" },
    { title: "Revision Classes for End Semester Examination", date: "7th May to 10th May 2027", type: "academic" },
    { title: "Preparatory Break for End Semester Examination", date: "11th May to 13th May 2027", type: "break" },
    { title: "End Semester Examination", date: "14th May to 31st May 2027", type: "exam" }
  ],
  summerQuarter: "28th June till August 28th 2027"
};

const defaultExamRadar = {
  title: "Mid Semester Examination 2026-27",
  status: "yet_to_be_decided", // 'yet_to_be_decided' | 'announced' | 'active' | 'completed'
  statusBadgeText: "Yet to be Decided",
  tentativeDateRange: "26th October to 4th November 2026 (Odd Sem) / 2nd April to 10th April 2027 (Even Sem)",
  notice: "Official datesheet has not been issued by the examination division yet. Examination datesheet and finalized syllabus modules will be published here as soon as approved.",
  publishedDatesheet: [],
  subjectSyllabus: defaultCurriculum.map((c) => ({
    subjectCode: c.code,
    subjectName: c.name,
    syllabusCoverage: "Syllabus yet to be decided by the department. Topics will be updated once faculty syllabus notification is released.",
    isConfirmed: false,
    lastUpdatedBy: "SuperAdmin"
  }))
};

const defaultWeeklyTimetable = [
  {
    day: "Monday",
    slots: [
      { id: "mon-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3249", subjectName: "Design Principles of Operating Systems", type: "theory", room: "Room 304", faculty: "Prof. S. Mohanty" },
      { id: "mon-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3751", subjectName: "Computer Networking : Concepts", type: "theory", room: "Room 304", faculty: "Dr. A. K. Nayak" },
      { id: "mon-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3544", subjectName: "Practical Programming with C (Lab)", type: "lab", room: "Software Lab 2", faculty: "Prof. P. K. Harwani" },
      { id: "mon-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "CSE 3731", subjectName: "Introduction to the Theory of Computation", type: "theory", room: "Room 304", faculty: "Prof. B. Dash" },
      { id: "mon-5", startTime: "02:15 PM", endTime: "03:15 PM", subjectCode: "MTH 3647", subjectName: "Fundamentals of Machine Intelligence 1", type: "theory", room: "Room 304", faculty: "Dr. S. K. Gandhi" }
    ]
  },
  {
    day: "Tuesday",
    slots: [
      { id: "tue-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3544", subjectName: "Practical Programming with C", type: "theory", room: "Room 304", faculty: "Prof. P. K. Harwani" },
      { id: "tue-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3249", subjectName: "Design Principles of Operating Systems", type: "theory", room: "Room 304", faculty: "Prof. S. Mohanty" },
      { id: "tue-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3967", subjectName: "Machine Learning Concepts 1 (ML-LAB)", type: "lab", room: "AI & ML Lab 1", faculty: "Prof. D. Bhattacharyya" },
      { id: "tue-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "GET 2024", subjectName: "Intermediate Problem Solving — 1", type: "theory", room: "Room 304", faculty: "Prof. Aditya Chatterjee" }
    ]
  },
  {
    day: "Wednesday",
    slots: [
      { id: "wed-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3751", subjectName: "Computer Networking : Concepts", type: "theory", room: "Room 304", faculty: "Dr. A. K. Nayak" },
      { id: "wed-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3731", subjectName: "Introduction to the Theory of Computation", type: "theory", room: "Room 304", faculty: "Prof. B. Dash" },
      { id: "wed-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3249", subjectName: "Operating Systems (Unix Shell Lab)", type: "lab", room: "Unix Lab 3", faculty: "Prof. S. Mohanty" },
      { id: "wed-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "MTH 3647", subjectName: "Fundamentals of Machine Intelligence 1", type: "theory", room: "Room 304", faculty: "Dr. S. K. Gandhi" }
    ]
  },
  {
    day: "Thursday",
    slots: [
      { id: "thu-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3544", subjectName: "Practical Programming with C", type: "theory", room: "Room 304", faculty: "Prof. P. K. Harwani" },
      { id: "thu-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "MTH 3647", subjectName: "Fundamentals of Machine Intelligence 1", type: "theory", room: "Room 304", faculty: "Dr. S. K. Gandhi" },
      { id: "thu-3", startTime: "10:15 AM", endTime: "12:15 PM", subjectCode: "CSE 3751", subjectName: "Computer Networking Lab", type: "lab", room: "Cisco Networking Lab", faculty: "Dr. A. K. Nayak" },
      { id: "thu-4", startTime: "01:15 PM", endTime: "02:15 PM", subjectCode: "GET 2024", subjectName: "Intermediate Problem Solving — 1", type: "theory", room: "Room 304", faculty: "Prof. Aditya Chatterjee" }
    ]
  },
  {
    day: "Friday",
    slots: [
      { id: "fri-1", startTime: "08:00 AM", endTime: "09:00 AM", subjectCode: "CSE 3249", subjectName: "Design Principles of Operating Systems", type: "theory", room: "Room 304", faculty: "Prof. S. Mohanty" },
      { id: "fri-2", startTime: "09:00 AM", endTime: "10:00 AM", subjectCode: "CSE 3731", subjectName: "Introduction to the Theory of Computation", type: "theory", room: "Room 304", faculty: "Prof. B. Dash" },
      { id: "fri-3", startTime: "10:15 AM", endTime: "11:15 AM", subjectCode: "CSE 3751", subjectName: "Computer Networking : Concepts", type: "theory", room: "Room 304", faculty: "Dr. A. K. Nayak" },
      { id: "fri-4", startTime: "11:15 AM", endTime: "12:15 PM", subjectCode: "GET 2024", subjectName: "Intermediate Problem Solving — 1", type: "theory", room: "Room 304", faculty: "Prof. Aditya Chatterjee" }
    ]
  },
  {
    day: "Saturday",
    slots: [
      { id: "sat-1", startTime: "09:00 AM", endTime: "11:00 AM", subjectCode: "CSE 3967", subjectName: "Machine Learning Projects & Lab Viva", type: "lab", room: "AI & ML Lab 1", faculty: "Prof. D. Bhattacharyya" },
      { id: "sat-2", startTime: "11:15 AM", endTime: "01:15 PM", subjectCode: "CSE 3544", subjectName: "Competitive Coding & C Project Practice", type: "lab", room: "Software Lab 2", faculty: "Prof. P. K. Harwani" }
    ]
  }
];

const academicConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      trim: true,
    },
    institution: {
      type: String,
      default: "ITER | SIKSHA 'O' ANUSANDHAN",
      trim: true,
    },
    academicYear: {
      type: String,
      default: "2026-27",
      trim: true,
    },
    academicCalendar: {
      oddSemester: [
        {
          title: String,
          date: String,
          type: { type: String, default: "academic" },
        },
      ],
      evenSemester: [
        {
          title: String,
          date: String,
          type: { type: String, default: "academic" },
        },
      ],
      summerQuarter: {
        type: String,
        default: "28th June till August 28th 2027",
      },
    },
    holidays2026: [
      {
        name: String,
        date: String,
        dayOfWeek: String,
        description: String,
      },
    ],
    curriculum: [
      {
        code: String,
        name: String,
        credits: Number,
        gradingPattern: String,
        weeklyFormat: String,
        isRequiredForPromotion: { type: Boolean, default: false },
        isMandatoryExtracurricular: { type: Boolean, default: false },
        textbooks: String,
        syllabus: String,
        tags: [String],
      },
    ],
    examRadar: {
      title: { type: String, default: "Mid Semester Examination 2026-27" },
      status: {
        type: String,
        enum: ["yet_to_be_decided", "announced", "active", "completed"],
        default: "yet_to_be_decided",
      },
      statusBadgeText: { type: String, default: "Yet to be Decided" },
      tentativeDateRange: {
        type: String,
        default: "26th October to 4th November 2026 (Odd Sem) / 2nd April to 10th April 2027 (Even Sem)",
      },
      notice: {
        type: String,
        default: "Official datesheet has not been issued by the examination division yet. Examination datesheet and finalized syllabus modules will be published here as soon as approved.",
      },
      publishedDatesheet: [
        {
          subjectCode: String,
          subjectName: String,
          examDate: String,
          examTime: String,
          roomNumber: String,
        },
      ],
      subjectSyllabus: [
        {
          subjectCode: String,
          subjectName: String,
          syllabusCoverage: String,
          isConfirmed: { type: Boolean, default: false },
          lastUpdatedBy: String,
          updatedAt: { type: Date, default: Date.now },
        },
      ],
    },
    defaultTimetable: {
      section: { type: String, default: "CSE Section 5A" },
      classroom: { type: String, default: "Room 304 (C-Block)" },
      days: [
        {
          day: String,
          slots: [
            {
              id: String,
              startTime: String,
              endTime: String,
              subjectCode: String,
              subjectName: String,
              type: { type: String, enum: ["theory", "lab", "break"], default: "theory" },
              room: String,
              faculty: String,
            },
          ],
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

academicConfigSchema.statics.getEffectiveConfig = async function () {
  let config = await this.findOne({ key: "default" });
  if (!config) {
    config = await this.create({
      key: "default",
      academicCalendar: defaultAcademicCalendar,
      holidays2026: defaultHolidays,
      curriculum: defaultCurriculum,
      examRadar: defaultExamRadar,
      defaultTimetable: {
        section: "CSE Section 5A",
        classroom: "Room 304 (C-Block)",
        days: defaultWeeklyTimetable,
      },
    });
  }
  return config;
};

// User-Specific Timetable Override Collection
const userTimetableSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
      index: true,
    },
    section: {
      type: String,
      default: "CSE Section 5A",
      trim: true,
    },
    classroom: {
      type: String,
      default: "Room 304 (C-Block)",
      trim: true,
    },
    days: [
      {
        day: String,
        slots: [
          {
            id: String,
            startTime: String,
            endTime: String,
            subjectCode: String,
            subjectName: String,
            type: { type: String, enum: ["theory", "lab", "break"], default: "theory" },
            room: String,
            faculty: String,
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const AcademicConfig = mongoose.model("AcademicConfig", academicConfigSchema);
const UserTimetable = mongoose.model("UserTimetable", userTimetableSchema);

module.exports = {
  AcademicConfig,
  UserTimetable,
  defaultCurriculum,
  defaultHolidays,
  defaultAcademicCalendar,
  defaultWeeklyTimetable,
};
