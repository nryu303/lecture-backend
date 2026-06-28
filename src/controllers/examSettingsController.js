const ExamSettings = require("../model/ExamSettings");

// Get exam settings
const getExamSettings = async (req, res) => {
  try {
    const settings = await ExamSettings.getSettings();

    res.status(200).json({
      success: true,
      settings: {
        timeLimit: settings.timeLimit,
        numberOfQuestions: settings.numberOfQuestions,
        passingScore: settings.passingScore,
        faceVerificationIntervalMinutes: settings.faceVerificationIntervalMinutes,
        lastUpdated: settings.lastUpdated,
        updatedBy: settings.updatedBy,
      },
    });
  } catch (error) {
    console.error("Error fetching exam settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch exam settings",
      error: error.message,
    });
  }
};

// Update exam settings
const updateExamSettings = async (req, res) => {
  try {
    const { timeLimit, numberOfQuestions, passingScore, faceVerificationIntervalMinutes } = req.body;

    // Validate input
    if (timeLimit && (timeLimit < 1 || timeLimit > 480)) {
      return res.status(400).json({
        success: false,
        message: "Time limit must be between 1 and 480 minutes",
      });
    }

    if (
      numberOfQuestions &&
      (numberOfQuestions < 1 || numberOfQuestions > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Number of questions must be between 1 and 100",
      });
    }

    if (passingScore && (passingScore < 0 || passingScore > 100)) {
      return res.status(400).json({
        success: false,
        message: "Passing score must be between 0 and 100",
      });
    }

    if (faceVerificationIntervalMinutes && (faceVerificationIntervalMinutes < 1 || faceVerificationIntervalMinutes > 60)) {
      return res.status(400).json({
        success: false,
        message: "Face verification interval must be between 1 and 60 minutes",
      });
    }

    // Get current settings or create new one
    let settings = await ExamSettings.findOne();

    if (!settings) {
      settings = new ExamSettings({});
    }

    // Update fields
    if (timeLimit !== undefined) settings.timeLimit = timeLimit;
    if (numberOfQuestions !== undefined)
      settings.numberOfQuestions = numberOfQuestions;
    if (passingScore !== undefined) settings.passingScore = passingScore;
    if (faceVerificationIntervalMinutes !== undefined)
      settings.faceVerificationIntervalMinutes = faceVerificationIntervalMinutes;

    settings.lastUpdated = new Date();
    settings.updatedBy = req.user?.username || req.user?.email || "admin";

    await settings.save();

    res.status(200).json({
      success: true,
      message: "Exam settings updated successfully",
      settings: {
        timeLimit: settings.timeLimit,
        numberOfQuestions: settings.numberOfQuestions,
        passingScore: settings.passingScore,
        faceVerificationIntervalMinutes: settings.faceVerificationIntervalMinutes,
        lastUpdated: settings.lastUpdated,
        updatedBy: settings.updatedBy,
      },
    });
  } catch (error) {
    console.error("Error updating exam settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update exam settings",
      error: error.message,
    });
  }
};

module.exports = {
  getExamSettings,
  updateExamSettings,
};
