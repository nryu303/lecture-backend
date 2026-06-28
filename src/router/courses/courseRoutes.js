const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../controllers/authController");
const {
  getUserCourses,
  getCourseById,
  updateCourseProgress,
  checkExamEligibility,
  getExamEligibility,
} = require("../../controllers/courseController");

// Check exam eligibility (must be before /:courseId route)
router.post("/exam-eligibility/check", verifyToken, checkExamEligibility);

// Get exam eligibility status (must be before /:courseId route)
router.get("/exam-eligibility", verifyToken, getExamEligibility);

// Get all courses for a specific user
router.get("/user/:userId", getUserCourses);

// Update course progress
router.put("/:courseId/progress", verifyToken, updateCourseProgress);

// Get specific course details (must be last to avoid conflicts)
router.get("/:courseId", verifyToken, getCourseById);

module.exports = router;
