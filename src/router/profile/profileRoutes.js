const express = require("express");
const upload = require("../../config/multer");
const { verifyToken } = require("../../controllers/authController");
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  toggleFavorite,
  getFavorites,
} = require("../../controllers/profileController");

const router = express.Router();

// Get user profile (protected route)
router.get("/", verifyToken, getProfile);

// Update user profile (protected route)
router.put("/", verifyToken, updateProfile);

// Upload avatar (protected route)
router.post("/avatar", verifyToken, upload.single("avatar"), uploadAvatar);

// Delete avatar (protected route)
router.delete("/avatar", verifyToken, deleteAvatar);

// Change password (protected route)
router.put("/password", verifyToken, changePassword);

// Toggle favorite material (protected route)
router.post("/favorites", verifyToken, toggleFavorite);

// Get user favorites (protected route)
router.get("/favorites", verifyToken, getFavorites);

module.exports = router;
