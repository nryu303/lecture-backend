const express = require("express");
const {
  registerUser,
  loginUser,
  verifyToken,
  getUserProfile,
} = require("../../controllers/authController");

const router = express.Router();

// Simple user registration
router.post("/register", registerUser);

// Login user with ID and password
router.post("/login", loginUser);

// Get user profile (protected route)
// router.get("/profile", verifyToken, getUserProfile);

module.exports = router;
