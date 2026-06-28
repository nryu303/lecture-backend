const express = require("express");
const router = express.Router();
const {
  sendNotification,
  sendNotificationToAll,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require("../../controllers/notificationController");
const authenticateToken = require("../../middleware/auth");

// Apply authentication middleware to all notification routes
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

// Admin routes - send notifications
router.post("/send", requireAdmin, sendNotification);
router.post("/send-all", requireAdmin, sendNotificationToAll);

// User routes - get and manage notifications
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:notificationId/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/:notificationId", deleteNotification);

module.exports = router;

