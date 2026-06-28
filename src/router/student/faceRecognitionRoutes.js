const express = require("express");
const router = express.Router();
const {
  registerFace,
  getFaceData,
  verifyFace,
  deleteFaceData,
} = require("../../controllers/faceRecognitionController");
const authenticateToken = require("../../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// Register or update face data
router.post("/register", registerFace);

// Get face data
router.get("/data", getFaceData);

// Verify face
router.post("/verify", verifyFace);

// Delete face data
router.delete("/data", deleteFaceData);

module.exports = router;

