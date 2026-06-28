const { createModel } = require("../db/adapter");

// exams table. `questions` is a jsonb array of question id strings.
const Exam = createModel("exams", {
  columns: [
    "title",
    "description",
    "courseId",
    "courseName",
    "instructions",
    "timeLimit",
    "maxAttempts",
    "passingScore",
    "shuffleQuestions",
    "shuffleOptions",
    "showCorrectAnswers",
    "showFeedback",
    "status",
    "questions",
    "totalQuestions",
    "totalPoints",
    "createdBy",
  ],
});

module.exports = Exam;
