const { createModel } = require("../db/adapter");

// Replicates the original Mongoose pre('validate') checks.
function validateQuestion(doc) {
  if (doc.type === "single_choice") {
    if (!doc.options || doc.options.length < 2) {
      throw new Error("Single choice questions must have at least 2 options");
    }
    const correct = doc.options.filter((o) => o.isCorrect);
    if (correct.length !== 1) {
      throw new Error("Single choice questions must have exactly 1 correct option");
    }
  }
  if (doc.type === "multiple_choice") {
    if (!doc.options || doc.options.length < 2) {
      throw new Error("Multiple choice questions must have at least 2 options");
    }
    const correct = doc.options.filter((o) => o.isCorrect);
    if (correct.length < 1) {
      throw new Error("Multiple choice questions must have at least 1 correct option");
    }
  }
  if (doc.type === "true_false") {
    if (doc.correctAnswer === null || doc.correctAnswer === undefined) {
      throw new Error("True/False questions must have a correct answer");
    }
  }
}

// standalone_questions table (course-level question bank, not tied to an exam)
const StandaloneQuestion = createModel("standalone_questions", {
  columns: [
    "type",
    "title",
    "content",
    "courseId",
    "courseName",
    "correctAnswer",
    "options",
    "correctOptions",
    "estimatedTime",
    "explanation",
    "feedback",
    "tags",
    "isActive",
    "createdBy",
  ],
  preValidate: validateQuestion,
});

module.exports = StandaloneQuestion;
