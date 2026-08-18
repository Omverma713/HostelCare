const express = require("express");
const router = express.Router();
const {activateUser,loggedInUser,} = require("../controllers/user.controllers")
const authMiddleware = require("../middleware/auth.middleware")
const { savingComplaint,findingcomplaint,caretakerComplaints, updateComplaint,wardernDashboard ,updateComplaintbyid,staffPerformance} = require("../controllers/comaplaint.controllers")

router.post("/activate",activateUser)
router.post("/login",loggedInUser)
router.post("/complaints", authMiddleware, savingComplaint);
router.get("/hostel-complaints", authMiddleware, findingcomplaint);
router.get("/caretaker/complaints", authMiddleware, caretakerComplaints);
router.patch("/update-complaint/:id", authMiddleware, updateComplaintbyid);
router.get("/warden/dashboard", authMiddleware, wardernDashboard);
router.get(
    "/superintendent/staff-performance",
    authMiddleware,
    staffPerformance
);




module.exports = router