const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const {
  getAvailableExams,
  getExamHistory,
  startExam,
  getExamQuestions,
  saveExamProgress,
  submitExam,
  getExamAttempt,
  verifyFace, // 👈 new controller for face verification
} = require("../../controllers/studentExamController");

// All routes require authentication
router.use(auth);

// Face verification route (before or during exam)
router.post("/verify-face", verifyFace);

// Get available exams for student
router.get("/", getAvailableExams);

// Get student's exam history
router.get("/history", getExamHistory);

// Start a new exam attempt
router.post("/:examId/start", startExam);

// Get exam questions for current attempt
router.get("/attempt/:attemptId/questions", getExamQuestions);

// Save exam progress
router.patch("/attempt/:attemptId/progress", saveExamProgress);

// Submit exam
router.post("/attempt/:attemptId/submit", submitExam);

// Get specific exam attempt
router.get("/attempt/:attemptId", getExamAttempt);

// Get exam results (reuses getExamAttempt for now)
router.get("/attempt/:attemptId/results", getExamAttempt);

module.exports = router;
