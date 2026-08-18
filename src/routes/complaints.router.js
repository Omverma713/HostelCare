const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
    savingComplaint,
    getAllComplaints,
    allComplaintsId,
    updateComplaintbyid,
    deleteComplaintbyid,
    findBystatus,
    superintendentDashboard,
} = require("../controllers/comaplaint.controllers");

// SECURITY: POST and PUT now require authentication
router.post("/", authMiddleware, savingComplaint);
router.get("/Allcomplaints", getAllComplaints);
router.get("/Allcomplaints/:complaintId", authMiddleware, allComplaintsId);
router.put("/Allcomplaints/:complaintId", authMiddleware, updateComplaintbyid);
router.delete("/Allcomplaints/:complaintId", authMiddleware, deleteComplaintbyid);
router.get("/status/:status", authMiddleware, findBystatus);
router.get("/superintendent/dashboard", authMiddleware, superintendentDashboard);

module.exports = router;