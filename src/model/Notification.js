const { createModel } = require("../db/adapter");

// notifications table
const Notification = createModel("notifications", {
  columns: [
    "title",
    "message",
    "recipientId",
    "senderId",
    "isRead",
    "readAt",
    "type",
    "metadata",
  ],
});

module.exports = Notification;
