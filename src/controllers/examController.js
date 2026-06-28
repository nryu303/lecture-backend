const StandaloneQuestion = require("../model/StandaloneQuestion");
const ExamHistory = require("../model/ExamHistory");
const ExamSettings = require("../model/ExamSettings");
const Exam = require("../model/Exam");
const Notification = require("../model/Notification");
const User = require("../model/User");
const { isUuid } = require("../db/adapter");

// Submit exam and store results
const submitExam = async (req, res) => {
  try {
    const {
      examineeId,
      examId,
      answers,
      timeSpent,
      submittedAt,
      totalQuestions: requestTotalQuestions,
    } = req.body;

    const user = req.user;

    // Get exam settings for time limit and passing score
    const examSettings = await ExamSettings.getSettings();
    const timeLimitMinutes = examSettings.timeLimit || 60; // Default to 60 minutes

    // Get the exam to retrieve total questions count (admin-submitted questions)
    // Only try to find exam if examId is a valid id (uuid)
    let exam = null;
    if (examId && isUuid(examId)) {
      try {
        exam = await Exam.findById(examId);
      } catch (error) {
        console.warn("Failed to find exam by ID:", examId, error.message);
        exam = null;
      }
    }

    // Get question IDs from examinee answers (these are the actual questions that were presented)
    const questionIds = answers.map((answer) => answer.questionId);

    // Get only the questions that were actually presented to the examinee
    const presentedQuestions = await StandaloneQuestion.find({
      _id: { $in: questionIds },
      isActive: true,
    });

    // Use totalQuestions from exam (admin-submitted questions) or from request
    // Priority: exam.totalQuestions > requestTotalQuestions > presentedQuestions.length
    // This ensures the score is calculated as: correct answers / admin-submitted questions
    const totalQuestions =
      exam?.totalQuestions ||
      requestTotalQuestions ||
      presentedQuestions.length;

    let totalScore = 0;
    const gradedAnswers = [];

    // Create a map of examinee answers for quick lookup
    const examineeAnswersMap = new Map();
    answers.forEach((answer) => {
      examineeAnswersMap.set(answer.questionId, answer);
    });

    // Create a map of questions for quick lookup
    const questionsMap = new Map();
    presentedQuestions.forEach((question) => {
      questionsMap.set(question._id.toString(), question);
    });

    // Grade only the questions that were presented to the examinee
    for (const questionId of questionIds) {
      const question = questionsMap.get(questionId);
      if (!question) {
        console.warn(`Question ${questionId} not found, skipping`);
        continue;
      }

      // Check if examinee answered this question
      const examineeAnswer = examineeAnswersMap.get(question._id.toString());
      const examineeAnswered = !!examineeAnswer;

      let isCorrect = false;
      let pointsEarned = 0;

      // Grade based on question type
      if (question.type === "true_false") {
        if (examineeAnswered) {
          isCorrect = examineeAnswer.answer === question.correctAnswer;
        }
      } else if (question.type === "single_choice") {
        const correctOption = question.options.find((opt) => opt.isCorrect);
        if (examineeAnswered) {
          isCorrect = examineeAnswer.answer === correctOption?.id;
        }
      } else if (question.type === "multiple_choice") {
        const correctOptionIds = question.options
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id)
          .sort();
        if (examineeAnswered) {
          const examineeAnswers = Array.isArray(examineeAnswer.answer)
            ? examineeAnswer.answer.sort()
            : [];
          isCorrect =
            JSON.stringify(examineeAnswers) ===
            JSON.stringify(correctOptionIds);
        }
      }

      if (isCorrect) {
        pointsEarned = 1; // Each question is worth 1 point
        totalScore += pointsEarned;
      }

      // Add to graded answers (include all questions, answered or not)
      gradedAnswers.push({
        questionId: question._id.toString(),
        questionContent: question.content,
        questionType: question.type,
        answer: examineeAnswered ? examineeAnswer.answer : null,
        answeredAt: examineeAnswered ? examineeAnswer.answeredAt : null,
        isCorrect,
        pointsEarned,
        examineeAnswered,
        correctAnswer: question.correctAnswer,
        options: question.options,
      });
    }

    // Calculate percentage based on correct answers divided by total questions (admin-submitted)
    const percentage =
      totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    const passed = percentage >= examSettings.passingScore;

    // Store exam results in the database
    const examResult = {
      examineeId: user.id,
      examineeName: user.username || user.email,
      answers: gradedAnswers,
      score: totalScore,
      totalQuestions: totalQuestions,
      percentage: percentage,
      passed: passed,
      passingGrade: examSettings.passingScore,
      timeAll: timeLimitMinutes * 60, // Total time allocated in seconds
      timeSpent: timeSpent,
      submittedAt: new Date(submittedAt),
      gradedAt: new Date(),
      status: "completed",
    };

    // Save to examHistories collection
    const savedExamHistory = new ExamHistory(examResult);
    await savedExamHistory.save();

    // If exam passed, send notification to all admins
    if (passed) {
      try {
        const admins = await User.find({ role: "admin" });
        const student = await User.findById(user.id);
        const studentName = student?.username || student?.email || "受講生";

        const notifications = admins.map((admin) => ({
          title: "試験合格通知",
          message: `${studentName}さんが試験に合格しました。修了証を発行してください。`,
          recipientId: admin._id.toString(),
          senderId: "system",
          type: "success",
          metadata: {
            userId: user.id,
            studentName: studentName,
            action: "issue_certificate",
          },
        }));

        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
        }
      } catch (error) {
        console.error("Error sending exam pass notification:", error);
        // Don't fail the exam submission if notification fails
      }
    }

    res.json({
      success: true,
      message: "Exam submitted and graded successfully",
      examResult: examResult,
      examHistoryId: savedExamHistory._id,
    });
  } catch (error) {
    console.error("Submit exam error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit exam",
      error: error.message,
    });
  }
};

// Get exam results by exam history ID
const getExamResults = async (req, res) => {
  try {
    const { examHistoryId } = req.params;
    const user = req.user;

    const examHistory = await ExamHistory.findById(examHistoryId);

    if (!examHistory) {
      return res.status(404).json({
        success: false,
        message: "Exam history not found",
      });
    }

    // Check if the exam history belongs to the current user
    if (examHistory.examineeId !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      message: "Exam results retrieved successfully",
      examResults: examHistory,
    });
  } catch (error) {
    console.error("Get exam results error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch exam results",
      error: error.message,
    });
  }
};

// Get exam histories for an examinee
const getExamHistories = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10 } = req.query;

    const query = { examineeId: user.id };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const examHistories = await ExamHistory.find(query)
      .select("-answers") // Don't include detailed answers in list
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalHistories = await ExamHistory.countDocuments(query);

    // Get statistics for the examinee
    const stats = await ExamHistory.getExamineeStats(user.id);

    res.json({
      success: true,
      examHistories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalHistories / parseInt(limit)),
        totalHistories,
        hasNext: skip + examHistories.length < totalHistories,
        hasPrev: parseInt(page) > 1,
      },
      statistics: stats,
    });
  } catch (error) {
    console.error("Get exam histories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch exam histories",
      error: error.message,
    });
  }
};

// Get all exam histories for admin
const getAllExamHistories = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10, examineeId, passed } = req.query;

    // Check if user is admin (you might want to add proper admin role checking)
    // For now, we'll allow any authenticated user to access all histories
    const query = {}; // No filter - get all exam histories

    // Add filters if provided
    if (examineeId) {
      query.examineeId = examineeId;
    }
    if (passed !== undefined) {
      // Handle both string "true"/"false" and boolean true/false
      query.passed = passed === "true" || passed === true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const examHistories = await ExamHistory.find(query)
      .select("-answers") // Don't include detailed answers in list
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalHistories = await ExamHistory.countDocuments(query);

    // Get overall statistics
    const stats = await ExamHistory.aggregate([
      {
        $group: {
          _id: null,
          totalExams: { $sum: 1 },
          averageScore: { $avg: "$score" },
          averagePercentage: { $avg: "$percentage" },
          passedExams: { $sum: { $cond: ["$passed", 1, 0] } },
          totalTimeSpent: { $sum: "$timeSpent" },
          totalTimeAllocated: { $sum: "$timeAll" },
          bestScore: { $max: "$score" },
          bestPercentage: { $max: "$percentage" },
        },
      },
    ]);

    const result = stats[0] || {
      totalExams: 0,
      averageScore: 0,
      averagePercentage: 0,
      passedExams: 0,
      totalTimeSpent: 0,
      totalTimeAllocated: 0,
      bestScore: 0,
      bestPercentage: 0,
    };

    res.json({
      success: true,
      examHistories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalHistories / parseInt(limit)),
        totalHistories,
        hasNext: skip + examHistories.length < totalHistories,
        hasPrev: parseInt(page) > 1,
      },
      statistics: result,
    });
  } catch (error) {
    console.error("Get all exam histories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch exam histories",
      error: error.message,
    });
  }
};

// Get exam statistics
const getExamStats = async (req, res) => {
  try {
    const user = req.user;

    // Get overall statistics
    const stats = await ExamHistory.aggregate([
      {
        $group: {
          _id: null,
          totalExams: { $sum: 1 },
          averageScore: { $avg: "$score" },
          averagePercentage: { $avg: "$percentage" },
          passedExams: { $sum: { $cond: ["$passed", 1, 0] } },
          totalTimeSpent: { $sum: "$timeSpent" },
          totalTimeAllocated: { $sum: "$timeAll" },
          bestScore: { $max: "$score" },
          bestPercentage: { $max: "$percentage" },
        },
      },
    ]);

    const result = stats[0] || {
      totalExams: 0,
      averageScore: 0,
      averagePercentage: 0,
      passedExams: 0,
      totalTimeSpent: 0,
      totalTimeAllocated: 0,
      bestScore: 0,
      bestPercentage: 0,
    };

    res.json({
      success: true,
      stats: result,
    });
  } catch (error) {
    console.error("Error fetching exam stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching exam statistics",
      error: error.message,
    });
  }
};

// Update exam history (admin only)
const updateExamHistory = async (req, res) => {
  try {
    const { examHistoryId } = req.params;
    const {
      examineeName,
      score,
      totalQuestions,
      percentage,
      passed,
      timeSpent,
      timeAll,
    } = req.body;

    // Find the exam history
    const examHistory = await ExamHistory.findById(examHistoryId);
    if (!examHistory) {
      return res.status(404).json({
        success: false,
        message: "Exam history not found",
      });
    }

    // Update the fields
    if (examineeName !== undefined) examHistory.examineeName = examineeName;
    if (score !== undefined) examHistory.score = score;
    if (totalQuestions !== undefined)
      examHistory.totalQuestions = totalQuestions;
    if (percentage !== undefined) examHistory.percentage = percentage;
    if (passed !== undefined) examHistory.passed = passed;
    if (timeSpent !== undefined) examHistory.timeSpent = timeSpent;
    if (timeAll !== undefined) examHistory.timeAll = timeAll;

    // Update gradedAt timestamp
    examHistory.gradedAt = new Date();

    await examHistory.save();

    res.json({
      success: true,
      message: "Exam history updated successfully",
      examHistory: examHistory,
    });
  } catch (error) {
    console.error("Update exam history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update exam history",
      error: error.message,
    });
  }
};

// Delete exam history (admin only)
const deleteExamHistory = async (req, res) => {
  try {
    const { examHistoryId } = req.params;

    const examHistory = await ExamHistory.findById(examHistoryId);
    if (!examHistory) {
      return res.status(404).json({
        success: false,
        message: "Exam history not found",
      });
    }

    await ExamHistory.findByIdAndDelete(examHistoryId);

    res.json({
      success: true,
      message: "Exam history deleted successfully",
    });
  } catch (error) {
    console.error("Delete exam history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete exam history",
      error: error.message,
    });
  }
};

module.exports = {
  submitExam,
  getExamResults,
  getExamHistories,
  getAllExamHistories,
  getExamStats,
  updateExamHistory,
  deleteExamHistory,
};
