const { createModel } = require("../db/adapter");

// courses table (enrollment-with-credentials records)
const Course = createModel("courses", {
  columns: [
    "userId",
    "courseId",
    "courseName",
    "studentId",
    "password",
    "enrollmentAt",
    "videoProgress",
    "documentProgress",
    "lectureProgress",
    "completionRate",
    "examEligible",
    "status",
    "paymentId",
    "subscriptionId",
    "paymentAmount",
    "lastAccessedAt",
    "expiresAt",
    "completedAt",
    "notes",
  ],
});

module.exports = Course;
