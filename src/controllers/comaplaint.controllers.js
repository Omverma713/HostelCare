const Complaint = require("../models/complaints.model");

// ─── Pagination Defaults ──────────────────────────────────────────────────────
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

function getPagination(query) {
    const page  = Math.max(1, parseInt(query.page)  || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
    const skip  = (page - 1) * limit;
    return { page, limit, skip };
}

// ─── findBystatus ─────────────────────────────────────────────────────────────
// GET /api/v1/complaints/status/:status
// Roles: warden, caretaker, superintendent
const findBystatus = async (req, res) => {
    try {
        // Authorize before any DB work
        if (
            req.user.role !== "warden" &&
            req.user.role !== "caretaker" &&
            req.user.role !== "superintendent"
        ) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to view this complaint"
            });
        }

        const { page, limit, skip } = getPagination(req.query);

        const [complaints, total] = await Promise.all([
            Complaint
                .find({ status: req.params.status, hostelNo: req.user.hostel })
                .lean()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Complaint.countDocuments({ status: req.params.status, hostelNo: req.user.hostel }),
        ]);

        if (total === 0) {
            return res.status(404).json({
                success: false,
                message: "complaint not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "complaint found",
            status: complaints,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure",
            error: error.message
        });
    }
};

// ─── wardernDashboard ─────────────────────────────────────────────────────────
// GET /api/v1/users/warden/dashboard
// Role: warden only
const wardernDashboard = async (req, res) => {
    try {
        // Authorize first — before any DB calls
        if (req.user.role !== "warden") {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to view this complaint"
            });
        }

        // Single aggregation replaces 4 sequential countDocuments calls.
        // Uses compound index { hostelNo, status } for IXSCAN.
        // Status values match the schema enum exactly: "pending", "inprogress", "resolved"
        const [result] = await Complaint.aggregate([
            { $match: { hostelNo: req.user.hostel } },
            {
                $facet: {
                    total: [{ $count: "count" }],
                    byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                }
            }
        ]);

        const totaComplaints = result.total[0]?.count ?? 0;

        if (totaComplaints === 0) {
            return res.status(404).json({
                success: false,
                message: "no complaint found"
            });
        }

        // Map status breakdown — matching exact enum values from the schema
        let pendingComplaints    = 0;
        let inProgressComplaints = 0;
        let resolvedComplaints   = 0;
        for (const s of result.byStatus) {
            if (s._id === "pending")    pendingComplaints    = s.count;
            if (s._id === "inprogress") inProgressComplaints = s.count;
            if (s._id === "resolved")   resolvedComplaints   = s.count;
        }

        // Preserve existing response shape — frontend reads stats.totaComplaints etc.
        return res.status(200).json({
            success: true,
            stats: {
                totaComplaints,
                pendingComplaints,
                inProgressComplaints,
                resolvedComplaints
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure"
        });
    }
};

// ─── updateComplaint ──────────────────────────────────────────────────────────
// (legacy — used by the /complaints router PUT route)
// Authorization and null check happen BEFORE the DB write.
const updateComplaint = async (req, res) => {
    try {
        // 1. Authorize first
        if (
            req.user.role !== "warden" &&
            req.user.role !== "caretaker"
        ) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to update this complaint"
            });
        }

        // 2. Fetch first to check hostel ownership — no write yet
        const existing = await Complaint.findById(req.params.id).lean();
        if (existing == null) {
            return res.status(404).json({
                success: false,
                message: "complaint not found"
            });
        }

        if (existing.hostelNo !== req.user.hostel) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to update this complaint"
            });
        }

        // 3. Only now perform the update
        const complaintstatus = await Complaint.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status.toLowerCase() },
            { returnDocument: "after", runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: "complaint updated",
            complaintstatus
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure"
        });
    }
};

// ─── caretakerComplaints ──────────────────────────────────────────────────────
// GET /api/v1/users/caretaker/complaints
// Roles: caretaker, warden
const caretakerComplaints = async (req, res) => {
    try {
        // Authorize first
        if (req.user.role !== "caretaker" && req.user.role !== "warden") {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to view this complaint"
            });
        }

        const { page, limit, skip } = getPagination(req.query);

        const [complaints, total] = await Promise.all([
            Complaint
                .find({ hostelNo: req.user.hostel })
                .lean()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Complaint.countDocuments({ hostelNo: req.user.hostel }),
        ]);

        if (total === 0) {
            return res.status(404).json({
                success: false,
                message: "no complaint found"
            });
        }

        return res.status(200).json({
            success: true,
            complaints,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure"
        });
    }
};

// ─── findingcomplaint ─────────────────────────────────────────────────────────
// GET /api/v1/users/hostel-complaints
// Returns student's own complaints
const findingcomplaint = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);

        const [complaints, total] = await Promise.all([
            Complaint
                .find({ registrationNo: req.user.registrationNumber })
                .lean()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Complaint.countDocuments({ registrationNo: req.user.registrationNumber }),
        ]);

        if (total === 0) {
            return res.status(404).json({
                success: false,
                message: "no complaint found"
            });
        }

        return res.status(200).json({
            success: true,
            complaints,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure"
        });
    }
};

// ─── savingComplaint ──────────────────────────────────────────────────────────
// POST /api/v1/users/complaints  (user route — has authMiddleware)
// POST /api/v1/complaints/        (complaints route — now has authMiddleware)
// Uses JWT payload directly — no redundant User.findById call
const savingComplaint = async (req, res) => {
    try {
        // All required fields are in the JWT payload — no extra DB round-trip needed.
        // req.user is populated by authMiddleware with: id, name, registrationNumber,
        // role, hostel — all of which were set at account activation.
        const complaintData = {
            studentName:    req.user.name,
            registrationNo: req.user.registrationNumber,
            hostelNo:       req.user.hostel,
            roomNo:         parseInt(req.user.roomNumber) || 0,
            department:     req.body.department,
            description:    req.body.description,
        };

        await Complaint.create(complaintData);

        return res.status(201).json({
            success: true,
            message: "Complaint saved successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "failled to save complaint",
        });
    }
};

// ─── getAllComplaints ─────────────────────────────────────────────────────────
// GET /api/v1/complaints/Allcomplaints
// No auth required (existing behavior preserved)
const getAllComplaints = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);

        const [complaints, total] = await Promise.all([
            Complaint
                .find()
                .lean()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Complaint.estimatedDocumentCount(),
        ]);

        return res.status(200).json({
            success: true,
            message: "all data fetched below here",
            allcomplaint: complaints,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "failed to fetched data",
        });
    }
};

// ─── allComplaintsId ─────────────────────────────────────────────────────────
// GET /api/v1/complaints/Allcomplaints/:complaintId
// Roles: warden, caretaker, superintendent
const allComplaintsId = async (req, res) => {
    try {
        const complaintId = await Complaint.findById(req.params.complaintId).lean();

        // Null check BEFORE any property access
        if (complaintId == null) {
            return res.status(404).json({
                success: false,
                message: "complaint not found"
            });
        }

        // Authorization check after null guard
        if (
            complaintId.hostelNo !== req.user.hostel ||
            (
                req.user.role !== "warden" &&
                req.user.role !== "caretaker" &&
                req.user.role !== "superintendent"
            )
        ) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to view this complaint"
            });
        }

        return res.status(200).json({
            success: true,
            message: "complaint found by id ",
            complaintID: complaintId
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system maintenance complaint not found",
            error: error.message
        });
    }
};

// ─── updateComplaintbyid ──────────────────────────────────────────────────────
// PATCH /api/v1/users/update-complaint/:id
// PUT   /api/v1/complaints/Allcomplaints/:complaintId
// Roles: warden, caretaker, superintendent
const updateComplaintbyid = async (req, res) => {
    const { status, description } = req.body;

    // 1. Role check first — no DB calls yet
    if (
        req.user.role !== "warden" &&
        req.user.role !== "caretaker" &&
        req.user.role !== "superintendent"
    ) {
        return res.status(403).json({
            success: false,
            message: "you are not authorized to update this complaint"
        });
    }

    try {
        // 2. Fetch to verify hostel ownership before writing
        const complaintId = req.params.id || req.params.complaintId;
        const existing = await Complaint.findById(complaintId).lean();

        if (existing == null) {
            return res.status(404).json({
                success: false,
                message: "complaint not found"
            });
        }

        if (existing.hostelNo !== req.user.hostel) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to update this complaint"
            });
        }

        // 3. Authorized — now perform the update
        const updatedData = await Complaint.findByIdAndUpdate(
            complaintId,
            {
                status,
                description,
                $push: {
                    actions: {
                        userId:    req.user.id,
                        role:      req.user.role,
                        action:    `status change to ${status}`,
                        timestamp: new Date()
                    }
                }
            },
            { returnDocument: "after", runValidators: true }

        );

        return res.status(200).json({
            success: true,
            message: "complaint update by id ",
            complaintID: updatedData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system maintenance complaint not found"
        });
    }
};

// ─── deleteComplaintbyid ──────────────────────────────────────────────────────
// DELETE /api/v1/complaints/Allcomplaints/:complaintId
// Roles: warden, caretaker
const deleteComplaintbyid = async (req, res) => {
    try {
        // 1. Role check first — before any DB operation
        if (
            req.user.role !== "warden" &&
            req.user.role !== "caretaker"
        ) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to delete this complaint"
            });
        }

        // 2. Fetch to check hostel ownership — no delete yet
        const existing = await Complaint.findById(req.params.complaintId).lean();

        if (existing == null) {
            return res.status(404).json({
                success: false,
                message: "complaint not found"
            });
        }

        if (existing.hostelNo !== req.user.hostel) {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to delete this complaint"
            });
        }

        // 3. Authorized — now delete
        const deletedData = await Complaint.findByIdAndDelete(req.params.complaintId);

        return res.status(200).json({
            success: true,
            message: "deleted successfully",
            complaintID: deletedData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system maintenance complaint not found"
        });
    }
};

// ─── superintendentDashboard ──────────────────────────────────────────────────
// GET /api/v1/complaints/superintendent/dashboard
// Role: superintendent only
const superintendentDashboard = async (req, res) => {
    // Authorize first
    if (req.user.role !== "superintendent") {
        return res.status(403).json({
            success: false,
            message: "you are not authorized to view staff performance"
        });
    }

    try {
        const totalComplaints = await Complaint.aggregate([
            { $match: { hostelNo: req.user.hostel } },
            {
                $facet: {
                    totalComplaints:    [{ $count: "total" }],
                    complaintsByStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }]
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Superintendent dashboard data fetched successfully",
            totalComplaints
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure",
            error: error.message
        });
    }
};

// ─── staffPerformance ─────────────────────────────────────────────────────────
// GET /api/v1/users/superintendent/staff-performance
// Role: superintendent only
const staffPerformance = async (req, res) => {
    try {
        // Authorize first
        if (req.user.role !== "superintendent") {
            return res.status(403).json({
                success: false,
                message: "you are not authorized to view staff performance"
            });
        }

        const performance = await Complaint.aggregate([
            {
                $match: { hostelNo: req.user.hostel }
            },
            {
                $unwind: "$actions"
            },
            {
                $match: { "actions.role": { $in: ["caretaker", "warden"] } }
            },
            {
                $group: {
                    _id: "$actions.userId",
                    totalActions: { $sum: 1 },
                    // Status values match the exact enum: "resolved", "inprogress", "pending"
                    resolved: {
                        $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                    },
                    inProgress: {
                        $sum: { $cond: [{ $eq: ["$status", "inprogress"] }, 1, 0] }
                    },
                    pending: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from:         "users",
                    localField:   "_id",
                    foreignField: "_id",
                    as:           "staff"
                }
            },
            {
                $unwind: "$staff"
            },
            {
                $project: {
                    _id:          0,
                    staff:        "$staff.registrationNumber",
                    role:         "$staff.role",
                    totalActions: 1,
                    resolved:     1,
                    inProgress:   1,
                    pending:      1
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "staff performance found",
            performance
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "due to system failure",
            error: error.message
        });
    }
};

module.exports = {
    staffPerformance,
    savingComplaint,
    getAllComplaints,
    allComplaintsId,
    updateComplaintbyid,
    deleteComplaintbyid,
    findingcomplaint,
    caretakerComplaints,
    updateComplaint,
    wardernDashboard,
    findBystatus,
    superintendentDashboard,
};