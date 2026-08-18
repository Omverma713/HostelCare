const mongoose = require("mongoose");

const createComplaint = new mongoose.Schema({
    studentName: {
        type: String,
        required: true
    },

    registrationNo: {
        type: String,
        required: true
    },

    hostelNo: {
        type: String,
        required: true
    },

    roomNo: {
        type: Number,
        required: true
    },

    department: {
        type: String,
        required: true,
        enum: [
            "Electrical",
            "Plumbing",
            "Carpentry",
            "Civil",
            "Cleaning",
            "Mess",
            "Internet",
            "Water",
            "Furniture",
            "Security",
            "Medical",
            "Others"
        ]
    },

    description: {
        type: String,
        required: true
    },

    status: {
        type: String,
        default: "pending",
        enum: ["pending", "inprogress", "resolved"]
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    actions: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            role: {
                type: String,
                enum: ["warden", "caretaker", "superintendent"]
            },
            action: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ]
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Compound index: hostelNo + status
// Used by: findBystatus (find({hostelNo, status})), wardernDashboard
// ($facet with hostelNo + status), caretakerComplaints (find({hostelNo}))
// Benefit: converts full COLLSCAN to IXSCAN for every hostel-scoped query.
// The compound covers hostelNo-only queries too (leading key prefix rule).
// Write cost: one index entry per document — minimal at this data volume.
createComplaint.index({ hostelNo: 1, status: 1 });

// Index: registrationNo
// Used by: findingcomplaint (find({registrationNo: req.user.registrationNumber}))
// Benefit: student's own complaints lookup becomes IXSCAN instead of COLLSCAN.
// Write cost: one index entry per document.
createComplaint.index({ registrationNo: 1 });

// Index: createdAt descending
// Used by: dashboard sorting, future pagination by date
// Benefit: enables efficient sort + skip/limit without in-memory sort.
// Write cost: one index entry per document.
createComplaint.index({ createdAt: -1 });

const Complaint = mongoose.model("complaint", createComplaint);

module.exports = Complaint;