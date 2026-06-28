const { createModel } = require("../db/adapter");

// exam_settings table (a single settings row).
const ExamSettings = createModel("exam_settings", {
  columns: [
    "timeLimit",
    "numberOfQuestions",
    "passingScore",
    "faceVerificationIntervalMinutes",
    "lastUpdated",
    "updatedBy",
  ],
  statics: {
    // Ensure exactly one settings row exists; create defaults if missing.
    async getSettings() {
      let settings = await this.findOne();
      if (!settings) {
        settings = await this.create({});
      }
      return settings;
    },
  },
});

module.exports = ExamSettings;
