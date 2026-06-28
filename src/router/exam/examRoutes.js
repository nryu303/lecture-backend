const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const {
  submitExam,
  getExamResults,
  getExamHistories,
  getAllExamHistories,
  getExamStats,
  updateExamHistory,
  deleteExamHistory,
} = require("../../controllers/examController");

// Import exam settings routes
const examSettingsRoutes = require("./examSettingsRoutes");

// All routes require authentication
router.use(auth);

// Submit exam
router.post("/submit", submitExam);

// Get exam results by exam history ID
router.get("/results/:examHistoryId", getExamResults);

// Get exam histories for an examinee
router.get("/histories", getExamHistories);

// Get all exam histories for admin
router.get("/admin/histories", getAllExamHistories);

// Get exam statistics
router.get("/stats", getExamStats);

// Update exam history (admin only)
router.put("/admin/histories/:examHistoryId", updateExamHistory);

// Delete exam history (admin only)
router.delete("/admin/histories/:examHistoryId", deleteExamHistory);

// Use exam settings routes
router.use("/settings", examSettingsRoutes);

module.exports = router;
