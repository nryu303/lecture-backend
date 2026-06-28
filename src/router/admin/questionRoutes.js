const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionTypes,
} = require("../../controllers/questionController");

// All routes require authentication
router.use(auth);

// Get question types
router.get("/types", getQuestionTypes);

// Get all questions (with optional filtering)
router.get("/", getQuestions);

// Get question by ID
router.get("/:id", getQuestionById);

// Create new question
router.post("/", createQuestion);

// Update question
router.put("/:id", updateQuestion);

// Delete question
router.delete("/:id", deleteQuestion);

module.exports = router;
