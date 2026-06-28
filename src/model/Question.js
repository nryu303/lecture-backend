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

// questions table. examId references exams.id.
const Question = createModel("questions", {
  columns: [
    "examId",
    "type",
    "title",
    "content",
    "points",
    "order",
    "correctAnswer",
    "options",
    "correctOptions",
    "explanation",
    "feedback",
    "difficulty",
    "tags",
    "isActive",
    "createdBy",
  ],
  refs: { examId: "exams" },
  preValidate: validateQuestion,
});

module.exports = Question;
