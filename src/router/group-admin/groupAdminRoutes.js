const express = require("express");
const router = express.Router();
const authenticateToken = require("../../middleware/auth");
const {
  createMultiTicketSessionPublic,
  purchaseSuccessPublic,
  getTicketGroups,
  createMultiTicketSession,
  getAllGroupAdmins,
  deleteGroupAdmin,
  assignStudentInfo,
} = require("../../controllers/groupAdminController");

/**
 * Middleware to check if user is group admin
 */
const isGroupAdmin = (req, res, next) => {
  if (req.user.role !== "group_admin") {
    return res.status(403).json({
      success: false,
      message: "グループ管理者のみがアクセスできます",
    });
  }
  next();
};

/**
 * Middleware to check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "管理者のみがアクセスできます",
    });
  }
  next();
};

/**
 * PUBLIC ROUTES (No authentication required)
 */
// Multi-course ticket purchase
router.post(
  "/create-multi-ticket-session-public",
  createMultiTicketSessionPublic
);

// Purchase success confirmation (public)
router.post("/purchase-success-public", purchaseSuccessPublic);

/**
 * PROTECTED ROUTES (Authentication required)
 */

// All routes below require authentication
router.use(authenticateToken);

// Get ticket groups for authenticated group admin
router.get("/ticket-groups", isGroupAdmin, getTicketGroups);

// Create multi-course ticket purchase session (authenticated)
router.post("/create-multi-ticket-session", isGroupAdmin, createMultiTicketSession);

// Get all group admins (admin only)
router.get("/admin/all", isAdmin, getAllGroupAdmins);

// Delete a group admin (admin only)
router.delete("/admin/:userId", isAdmin, deleteGroupAdmin);

// Assign student information to tickets (group admin only)
router.post("/assign-student-info", isGroupAdmin, assignStudentInfo);

module.exports = router;

