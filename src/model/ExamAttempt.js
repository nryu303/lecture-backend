const { createModel } = require("../db/adapter");

// exam_attempts table. `answers` is a jsonb array. examId references exams.id.
const ExamAttempt = createModel("exam_attempts", {
  columns: [
    "examId",
    "studentId",
    "studentName",
    "attemptNumber",
    "status",
    "startedAt",
    "completedAt",
    "timeSpent",
    "answers",
    "score",
    "percentage",
    "passed",
    "feedback",
  ],
  refs: { examId: "exams" },
});

module.exports = ExamAttempt;
