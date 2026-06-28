const { createModel } = require("../db/adapter");

const GROUP_STAGE = {
  _id: null,
  totalExams: { $sum: 1 },
  averageScore: { $avg: "$score" },
  averagePercentage: { $avg: "$percentage" },
  passedExams: { $sum: { $cond: ["$passed", 1, 0] } },
  totalTimeSpent: { $sum: "$timeSpent" },
  totalTimeAllocated: { $sum: "$timeAll" },
  bestScore: { $max: "$score" },
  bestPercentage: { $max: "$percentage" },
};

const EMPTY_STATS = {
  totalExams: 0,
  averageScore: 0,
  averagePercentage: 0,
  passedExams: 0,
  totalTimeSpent: 0,
  totalTimeAllocated: 0,
  bestScore: 0,
  bestPercentage: 0,
};

// exam_histories table. `answers` is a jsonb array (with nested options).
const ExamHistory = createModel("exam_histories", {
  columns: [
    "examineeId",
    "examineeName",
    "answers",
    "score",
    "totalQuestions",
    "percentage",
    "passed",
    "passingGrade",
    "timeAll",
    "timeSpent",
    "submittedAt",
    "gradedAt",
    "status",
  ],
  // Mirror the original pre-save: recompute percentage and pass/fail.
  preSave: (doc) => {
    if (doc.totalQuestions > 0) {
      doc.percentage = Math.round((doc.score / doc.totalQuestions) * 100);
    }
    doc.passed = doc.percentage >= (doc.passingGrade != null ? doc.passingGrade : 60);
  },
  statics: {
    async getExamineeStats(examineeId) {
      const stats = await this.aggregate([
        { $match: { examineeId } },
        { $group: GROUP_STAGE },
      ]);
      return stats[0] || { ...EMPTY_STATS };
    },
  },
});

module.exports = ExamHistory;
