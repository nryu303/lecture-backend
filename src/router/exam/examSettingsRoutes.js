const express = require("express");
const router = express.Router();
const {
  getExamSettings,
  updateExamSettings,
} = require("../../controllers/examSettingsController");
const authMiddleware = require("../../middleware/auth");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/exam/settings - Get exam settings
router.get("/", getExamSettings);

// PUT /api/exam/settings - Update exam settings
router.put("/", updateExamSettings);

module.exports = router;
