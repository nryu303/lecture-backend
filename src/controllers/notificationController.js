const Notification = require("../model/Notification");
const User = require("../model/User");
const { isUuid } = require("../db/adapter");

/**
 * Send notification to a specific user (admin only)
 * @route POST /api/notifications/send
 */
const sendNotification = async (req, res) => {
  try {
    const { recipientId, title, message, type } = req.body;
    const senderId = req.user.userId;

    // Validate required fields
    if (!recipientId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "recipientId, title, and message are required",
      });
    }

    // Check if recipient exists
    // Try to find by id (uuid) first, then by email or username if not a valid id
    let recipient = null;
    if (isUuid(recipientId)) {
      recipient = await User.findById(recipientId);
    } else {
      // If not a valid id, try to find by email or username
      // Extract email from strings like "Casmi (casmiyasu3811@gmail.com)"
      const emailMatch = recipientId.match(/\(([^)]+@[^)]+)\)/);
      const email = emailMatch ? emailMatch[1] : recipientId;
      
      // Try to find by email first
      recipient = await User.findOne({ email: email });
      
      // If not found by email, try by username
      if (!recipient) {
        const usernameMatch = recipientId.match(/^([^(]+)/);
        const username = usernameMatch ? usernameMatch[1].trim() : recipientId;
        recipient = await User.findOne({ username: username });
      }
    }
    
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found",
      });
    }
    
    // Use the actual user ID from the found user
    const actualRecipientId = recipient._id.toString();

    // Create notification
    const notification = new Notification({
      title,
      message,
      recipientId: actualRecipientId,
      senderId,
      type: type || "info",
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      data: notification,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Send notification to all students (admin only)
 * @route POST /api/notifications/send-all
 */
const sendNotificationToAll = async (req, res) => {
  try {
    const { title, message, type } = req.body;
    const senderId = req.user.userId;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "title and message are required",
      });
    }

    // Get all students
    const students = await User.find({ role: "student" });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }

    // Create notifications for all students
    const notifications = students.map((student) => ({
      title,
      message,
      recipientId: student._id.toString(),
      senderId,
      type: type || "info",
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: `Notification sent to ${students.length} students`,
      data: {
        count: students.length,
      },
    });
  } catch (error) {
    console.error("Error sending notification to all:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all notifications for the current user
 * @route GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, skip = 0 } = req.query;

    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Notification.countDocuments({ recipientId: userId });
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/notifications/:notificationId/read
 */
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Check if user owns this notification
    if (notification.recipientId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Mark all notifications as read for the current user
 * @route PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      data: {
        updatedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete a notification
 * @route DELETE /api/notifications/:notificationId
 */
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Check if user owns this notification
    if (notification.recipientId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    res.json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  sendNotification,
  sendNotificationToAll,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
};

