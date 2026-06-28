const StandaloneQuestion = require("../model/StandaloneQuestion");

// Get all questions with optional filtering
const getAllQuestions = async (req, res) => {
  try {
    const { type, courseId, page = 1, limit = 10 } = req.query;

    const query = {};

    if (type) {
      query.type = type;
    }

    if (courseId) {
      query.courseId = courseId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const questions = await StandaloneQuestion.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await StandaloneQuestion.countDocuments(query);

    res.json({
      success: true,
      questions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalQuestions / parseInt(limit)),
        totalQuestions,
        hasNext: skip + questions.length < totalQuestions,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get all questions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
      error: error.message,
    });
  }
};

// Get question by ID
const getStandaloneQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await StandaloneQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "StandaloneQuestion not found",
      });
    }

    res.json({
      success: true,
      question,
    });
  } catch (error) {
    console.error("Get question by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch question",
      error: error.message,
    });
  }
};

// Create new question
const createStandaloneQuestion = async (req, res) => {
  try {
    const {
      type,
      title,
      content,
      courseId,
      courseName,
      correctAnswer,
      estimatedTime,
      options,
    } = req.body;

    // Get user info from token
    const user = req.user;

    const questionData = {
      type,
      title,
      content,
      courseId,
      courseName,
      correctAnswer,
      estimatedTime: estimatedTime || 2,
      createdBy: user.username || user.email,
    };

    // Only add options for question types that need them
    if (type === "single_choice" || type === "multiple_choice") {
      questionData.options = options
        ? options.map((option, index) => ({
            id: option.id,
            text: option.text,
            isCorrect: option.isCorrect,
            order: index + 1,
          }))
        : undefined;
    }

    const question = new StandaloneQuestion(questionData);
    await question.save();

    res.status(201).json({
      success: true,
      message: "StandaloneQuestion created successfully",
      question,
    });
  } catch (error) {
    console.error("Create question error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create question",
      error: error.message,
    });
  }
};

// Update question
const updateStandaloneQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.createdBy;

    // Process options if provided and question type needs them
    if (
      updateData.options &&
      (updateData.type === "single_choice" ||
        updateData.type === "multiple_choice")
    ) {
      updateData.options = updateData.options.map((option, index) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        order: index + 1,
      }));
    } else if (updateData.type === "true_false") {
      // Remove options field for question types that don't need them
      delete updateData.options;
    }

    const question = await StandaloneQuestion.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "StandaloneQuestion not found",
      });
    }

    res.json({
      success: true,
      message: "StandaloneQuestion updated successfully",
      question,
    });
  } catch (error) {
    console.error("Update question error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update question",
      error: error.message,
    });
  }
};

// Delete question
const deleteStandaloneQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await StandaloneQuestion.findById(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "StandaloneQuestion not found",
      });
    }

    await StandaloneQuestion.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "StandaloneQuestion deleted successfully",
    });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete question",
      error: error.message,
    });
  }
};

// Get question types
const getStandaloneQuestionTypes = async (req, res) => {
  try {
    const questionTypes = [
      {
        value: "true_false",
        label: "Type 1: True/False",
        description: "Yes/No or True/False questions",
      },
      {
        value: "single_choice",
        label: "Type 2: Single Choice",
        description: "One correct answer from multiple options",
      },
      {
        value: "multiple_choice",
        label: "Type 3: Multiple Choice",
        description: "Multiple correct answers from options",
      },
    ];

    res.json({
      success: true,
      questionTypes,
    });
  } catch (error) {
    console.error("Get question types error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch question types",
      error: error.message,
    });
  }
};

module.exports = {
  getQuestions: getAllQuestions,
  getQuestionById: getStandaloneQuestionById,
  createQuestion: createStandaloneQuestion,
  updateQuestion: updateStandaloneQuestion,
  deleteQuestion: deleteStandaloneQuestion,
  getQuestionTypes: getStandaloneQuestionTypes,
};
