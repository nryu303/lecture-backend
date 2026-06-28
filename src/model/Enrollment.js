const { createModel } = require("../db/adapter");

// enrollments table
const Enrollment = createModel("enrollments", {
  columns: [
    "enrollment_id",
    "student_id",
    "course_id",
    "ticket_id",
    "enrolled_date",
    "progress_status",
  ],
});

module.exports = Enrollment;
