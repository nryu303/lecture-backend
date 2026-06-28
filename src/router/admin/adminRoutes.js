const express = require("express");
const router = express.Router();
const {
  deleteUser,
  toggleUserBlock,
  getAllUsers,
  issueCertificate,
} = require("../../controllers/adminController");
const authenticateToken = require("../../middleware/auth");

// Apply authentication middleware to all admin routes
router.use(authenticateToken);

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }
  next();
};

// Apply admin role requirement to all routes
router.use(requireAdmin);

// Admin user management routes
router.get("/users", getAllUsers);
router.delete("/users/:userId", deleteUser);
router.patch("/users/:userId/block", toggleUserBlock);

// Certificate management routes
router.post("/certificate/issue", issueCertificate);

module.exports = router;
