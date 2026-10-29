const SystemConfig = require("../models/systemConfig.model");
const CbtApplication = require("../models/cbtApplication.model");
const AuditLog = require("../models/auditLog.model");
const User = require("../models/user.model");

// ─── SUPER ADMIN CONTROLLERS ───────────────────────────────────────────────

/**
 * GET /api/v1/superadmin/cbt/config
 */
const getCbtConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const closedBeta = config.closedBeta || {};
    return res.status(200).json({ success: true, closedBeta });
  } catch (error) {
    console.error("getCbtConfig error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch CBT configuration", error: error.message });
  }
};

/**
 * PUT /api/v1/superadmin/cbt/config
 */
const updateCbtConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    if (!config.closedBeta) {
      config.closedBeta = {};
    }

    const {
      formEnabled,
      formTitle,
      formDescription,
      betaVersion,
      betaApkUrl,
      formDeadline,
      maxApplicants,
    } = req.body;

    const previousEnabled = config.closedBeta.formEnabled;

    if (formEnabled !== undefined) {
      config.closedBeta.formEnabled = Boolean(formEnabled);
      if (config.closedBeta.formEnabled && !previousEnabled) {
        config.closedBeta.openedAt = new Date();
      } else if (!config.closedBeta.formEnabled && previousEnabled) {
        config.closedBeta.closedAt = new Date();
      }
    }

    if (formTitle !== undefined) config.closedBeta.formTitle = formTitle.trim();
    if (formDescription !== undefined) config.closedBeta.formDescription = formDescription.trim();
    if (betaVersion !== undefined) config.closedBeta.betaVersion = betaVersion.trim();
    if (betaApkUrl !== undefined) config.closedBeta.betaApkUrl = betaApkUrl.trim();
    if (formDeadline !== undefined) config.closedBeta.formDeadline = formDeadline ? new Date(formDeadline) : null;
    if (maxApplicants !== undefined) config.closedBeta.maxApplicants = Number(maxApplicants) || 0;

    await config.save();

    // Audit log
    await AuditLog.create({
      adminId: req.user.id || req.user._id,
      adminRegistrationNumber: req.user.registrationNumber || "SUPERADMIN",
      adminName: req.user.name || "Super Admin",
      action: "CBT_CONFIG_UPDATED",
      targetType: "CBT",
      targetId: "closedBeta",
      details: {
        formEnabled: config.closedBeta.formEnabled,
        betaVersion: config.closedBeta.betaVersion,
      },
    }).catch((err) => console.error("Audit log error:", err.message));

    return res.status(200).json({
      success: true,
      message: `CBT configuration updated. Form is currently ${config.closedBeta.formEnabled ? "RELEASED (ON)" : "CLOSED (OFF)"}.`,
      closedBeta: config.closedBeta,
    });
  } catch (error) {
    console.error("updateCbtConfig error:", error);
    return res.status(500).json({ success: false, message: "Failed to update CBT configuration", error: error.message });
  }
};

/**
 * GET /api/v1/superadmin/cbt/applications
 */
const getCbtApplications = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: regex },
        { registrationNumber: regex },
        { hostel: regex },
        { deviceModel: regex },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [applications, total, totalPending, totalApproved, totalRejected] = await Promise.all([
      CbtApplication.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      CbtApplication.countDocuments(query),
      CbtApplication.countDocuments({ status: "pending" }),
      CbtApplication.countDocuments({ status: "approved" }),
      CbtApplication.countDocuments({ status: "rejected" }),
    ]);

    return res.status(200).json({
      success: true,
      applications,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
      stats: {
        totalAll: totalPending + totalApproved + totalRejected,
        pending: totalPending,
        approved: totalApproved,
        rejected: totalRejected,
      },
    });
  } catch (error) {
    console.error("getCbtApplications error:", error);
    return res.status(500).json({ success: false, message: "Failed to list CBT applications", error: error.message });
  }
};

/**
 * PATCH /api/v1/superadmin/cbt/applications/:id/approve
 */
const approveCbtApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;

    const app = await CbtApplication.findById(id);
    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    app.status = "approved";
    app.reviewedBy = req.user.registrationNumber || req.user.name || "Super Admin";
    app.reviewedAt = new Date();
    if (reviewNote !== undefined) app.reviewNote = reviewNote.trim();

    await app.save();

    // Audit log
    await AuditLog.create({
      adminId: req.user.id || req.user._id,
      adminRegistrationNumber: req.user.registrationNumber || "SUPERADMIN",
      adminName: req.user.name || "Super Admin",
      action: "CBT_APPLICATION_APPROVED",
      targetType: "CBT",
      targetId: app._id.toString(),
      details: {
        studentRegNo: app.registrationNumber,
        studentName: app.name,
      },
    }).catch((err) => console.error("Audit log error:", err.message));

    return res.status(200).json({
      success: true,
      message: `Application for ${app.name} (${app.registrationNumber}) approved!`,
      application: app,
    });
  } catch (error) {
    console.error("approveCbtApplication error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve application", error: error.message });
  }
};

/**
 * PATCH /api/v1/superadmin/cbt/applications/:id/reject
 */
const rejectCbtApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;

    const app = await CbtApplication.findById(id);
    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    app.status = "rejected";
    app.reviewedBy = req.user.registrationNumber || req.user.name || "Super Admin";
    app.reviewedAt = new Date();
    app.reviewNote = (reviewNote || "Application not selected for this beta cycle.").trim();

    await app.save();

    // Audit log
    await AuditLog.create({
      adminId: req.user.id || req.user._id,
      adminRegistrationNumber: req.user.registrationNumber || "SUPERADMIN",
      adminName: req.user.name || "Super Admin",
      action: "CBT_APPLICATION_REJECTED",
      targetType: "CBT",
      targetId: app._id.toString(),
      details: {
        studentRegNo: app.registrationNumber,
        studentName: app.name,
        reviewNote: app.reviewNote,
      },
    }).catch((err) => console.error("Audit log error:", err.message));

    return res.status(200).json({
      success: true,
      message: `Application for ${app.name} rejected.`,
      application: app,
    });
  } catch (error) {
    console.error("rejectCbtApplication error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject application", error: error.message });
  }
};

/**
 * DELETE /api/v1/superadmin/cbt/applications/:id
 */
const deleteCbtApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await CbtApplication.findByIdAndDelete(id);
    if (!app) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    await AuditLog.create({
      adminId: req.user.id || req.user._id,
      adminRegistrationNumber: req.user.registrationNumber || "SUPERADMIN",
      adminName: req.user.name || "Super Admin",
      action: "CBT_APPLICATION_DELETED",
      targetType: "CBT",
      targetId: id,
      details: {
        studentRegNo: app.registrationNumber,
      },
    }).catch((err) => console.error("Audit log error:", err.message));

    return res.status(200).json({ success: true, message: "Application deleted successfully" });
  } catch (error) {
    console.error("deleteCbtApplication error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete application", error: error.message });
  }
};

/**
 * POST /api/v1/superadmin/cbt/applications/bulk-approve
 */
const bulkApproveCbtApplications = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an array of application IDs." });
    }

    const reviewer = req.user.registrationNumber || req.user.name || "Super Admin";
    const result = await CbtApplication.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: "approved",
          reviewedBy: reviewer,
          reviewedAt: new Date(),
        },
      }
    );

    await AuditLog.create({
      adminId: req.user.id || req.user._id,
      adminRegistrationNumber: req.user.registrationNumber || "SUPERADMIN",
      adminName: req.user.name || "Super Admin",
      action: "CBT_BULK_APPROVED",
      targetType: "CBT",
      targetId: "bulk",
      details: {
        approvedCount: result.modifiedCount,
        ids,
      },
    }).catch((err) => console.error("Audit log error:", err.message));

    return res.status(200).json({
      success: true,
      message: `Successfully approved ${result.modifiedCount} applications.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("bulkApproveCbtApplications error:", error);
    return res.status(500).json({ success: false, message: "Failed to bulk approve applications", error: error.message });
  }
};

// ─── STUDENT CONTROLLERS ───────────────────────────────────────────────────

/**
 * GET /api/v1/cbt/status
 * Returns CBT release state and current student's application status
 */
const getStudentCbtStatus = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const closedBeta = config.closedBeta || {};
    const userId = req.user.id || req.user._id;

    // Check student's application for current beta version
    const activeVersion = closedBeta.betaVersion || "1.2.2.13";
    const application = await CbtApplication.findOne({
      userId,
      betaVersion: activeVersion,
    }).lean();

    const isFormOpen = Boolean(closedBeta.formEnabled);
    const deadlinePassed = closedBeta.formDeadline && new Date(closedBeta.formDeadline) < new Date();

    const response = {
      success: true,
      formReleased: isFormOpen && !deadlinePassed,
      formDetails: {
        title: closedBeta.formTitle || "HostelCare Beta — Apply Now",
        description: closedBeta.formDescription || "",
        version: activeVersion,
        deadline: closedBeta.formDeadline || null,
      },
      hasApplied: Boolean(application),
      application: application
        ? {
            id: application._id,
            status: application.status,
            deviceModel: application.deviceModel,
            androidVersion: application.androidVersion,
            reviewNote: application.reviewNote,
            submittedAt: application.submittedAt,
            betaVersion: application.betaVersion,
            // Only reveal download APK URL if approved!
            downloadUrl: application.status === "approved" ? closedBeta.betaApkUrl : null,
          }
        : null,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("getStudentCbtStatus error:", error);
    return res.status(500).json({ success: false, message: "Failed to check CBT status", error: error.message });
  }
};

/**
 * POST /api/v1/cbt/apply
 * Submits beta testing application
 */
const applyForCbt = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const closedBeta = config.closedBeta || {};

    // 1. Validate form is active
    if (!closedBeta.formEnabled) {
      return res.status(400).json({
        success: false,
        message: "Closed Beta application form is currently closed.",
      });
    }

    if (closedBeta.formDeadline && new Date(closedBeta.formDeadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Closed Beta application deadline has already passed.",
      });
    }

    // 2. Validate applicant capacity if configured
    const activeVersion = closedBeta.betaVersion || "1.2.2.13";
    if (closedBeta.maxApplicants && closedBeta.maxApplicants > 0) {
      const currentCount = await CbtApplication.countDocuments({ betaVersion: activeVersion });
      if (currentCount >= closedBeta.maxApplicants) {
        return res.status(400).json({
          success: false,
          message: "Closed Beta application quota for this release has been filled.",
        });
      }
    }

    // 3. Validate user role
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    // 4. Check for duplicate application for this beta version
    const existing = await CbtApplication.findOne({ userId, betaVersion: activeVersion });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You have already submitted an application for Beta ${activeVersion}. Status: ${existing.status.toUpperCase()}`,
        application: existing,
      });
    }

    const { deviceModel, androidVersion, reason, feedbackComfort } = req.body;

    if (!deviceModel || !deviceModel.trim()) {
      return res.status(400).json({ success: false, message: "Device model is required." });
    }
    if (!androidVersion || !androidVersion.trim()) {
      return res.status(400).json({ success: false, message: "Android version is required." });
    }
    if (!reason || !reason.trim() || reason.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Please provide a reason of at least 10 characters." });
    }

    const newApp = await CbtApplication.create({
      userId,
      registrationNumber: user.registrationNumber,
      name: user.name,
      hostel: user.hostel || "",
      room: user.roomNumber || "",
      email: user.email || "",
      deviceModel: deviceModel.trim(),
      androidVersion: androidVersion.trim(),
      reason: reason.trim(),
      feedbackComfort: (feedbackComfort || "Very Comfortable").trim(),
      status: "pending",
      betaVersion: activeVersion,
      submittedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Your application for the Closed Beta Program has been submitted successfully!",
      application: newApp,
    });
  } catch (error) {
    console.error("applyForCbt error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted an application for this beta version.",
      });
    }
    return res.status(500).json({ success: false, message: "Failed to submit application", error: error.message });
  }
};

/**
 * GET /api/v1/cbt/my-application
 */
const getMyCbtApplication = async (req, res) => {
  try {
    const config = await SystemConfig.getEffectiveConfig();
    const activeVersion = config.closedBeta?.betaVersion || "1.2.2.13";
    const userId = req.user.id || req.user._id;

    const application = await CbtApplication.findOne({
      userId,
      betaVersion: activeVersion,
    }).lean();

    return res.status(200).json({
      success: true,
      application: application || null,
      downloadUrl: application && application.status === "approved" ? config.closedBeta?.betaApkUrl : null,
    });
  } catch (error) {
    console.error("getMyCbtApplication error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch application", error: error.message });
  }
};

module.exports = {
  // Super Admin
  getCbtConfig,
  updateCbtConfig,
  getCbtApplications,
  approveCbtApplication,
  rejectCbtApplication,
  deleteCbtApplication,
  bulkApproveCbtApplications,
  // Student
  getStudentCbtStatus,
  applyForCbt,
  getMyCbtApplication,
};
