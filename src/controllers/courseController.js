const Course = require("../model/Course");
const User = require("../model/User");
const Material = require("../model/Material");

// Get all courses for a specific user
const getUserCourses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ユーザーが見つかりません",
      });
    }

    // Get all courses for this user
    const courses = await Course.find({ userId: userId })
      .select(
        "courseId courseName studentId password enrollmentAt lectureProgress videoProgress documentProgress status lastAccessedAt"
      )
      .sort({ enrollmentAt: -1 });

    res.json({
      success: true,
      courses: courses,
      count: courses.length,
    });
  } catch (error) {
    console.error("❌ Error getting user courses:", error);
    res.status(500).json({
      success: false,
      message: "コースの取得に失敗しました",
      error: error.message,
    });
  }
};

// Get specific course details
const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "認証が必要です",
      });
    }

    // Get course details
    const course = await Course.findOne({
      courseId: courseId,
      userId: userId,
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "コースが見つかりません",
      });
    }

    res.json({
      success: true,
      course: course,
    });
  } catch (error) {
    console.error("❌ Error getting course details:", error);
    res.status(500).json({
      success: false,
      message: "コース詳細の取得に失敗しました",
      error: error.message,
    });
  }
};

// Update course lecture progress for a specific material
const updateCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { materialName, progress, materialType } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "認証が必要です",
      });
    }

    // Validate materialName
    if (!materialName || typeof materialName !== "string") {
      return res.status(400).json({
        success: false,
        message: "教材名が必要です",
      });
    }

    // Determine material type (video or pdf)
    const type = materialType || "video"; // Default to video for backward compatibility

    // Find the current course
    const course = await Course.findOne({
      courseId: courseId,
      userId: userId,
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "コースが見つかりません",
      });
    }

    // Handle video progress (with percentage)
    if (type === "video") {
      // Validate progress for videos
      if (typeof progress !== "number" || progress < 0 || progress > 100) {
        return res.status(400).json({
          success: false,
          message: "進捗は0-100の間で指定してください",
        });
      }

      // Find existing progress entry for this video material
      const existingProgressIndex = course.videoProgress.findIndex(
        (item) => item.materialName === materialName
      );

      // Check if this material's progress is already 100
      if (
        existingProgressIndex !== -1 &&
        course.videoProgress[existingProgressIndex].progress === 100
      ) {
        return res.json({
          success: true,
          course: course,
          skipped: true,
        });
      }

      // Update or add progress for this video material
      if (existingProgressIndex !== -1) {
        // Update existing entry
        course.videoProgress[existingProgressIndex].progress = progress;
      } else {
        // Add new entry
        course.videoProgress.push({
          materialName: materialName,
          progress: progress,
        });
      }

      // Also update legacy lectureProgress for backward compatibility
      const legacyIndex = course.lectureProgress.findIndex(
        (item) => item.materialName === materialName
      );
      if (legacyIndex !== -1) {
        course.lectureProgress[legacyIndex].progress = progress;
      } else {
        course.lectureProgress.push({
          materialName: materialName,
          progress: progress,
        });
      }
    } else if (type === "pdf") {
      // Handle document progress (completed/not completed only, no percentage)
      const existingDocumentIndex = course.documentProgress.findIndex(
        (item) => item.materialName === materialName
      );

      // If already completed, skip
      if (existingDocumentIndex !== -1) {
        return res.json({
          success: true,
          course: course,
          skipped: true,
        });
      }

      // Add to document progress (mark as completed)
      course.documentProgress.push({
        materialName: materialName,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "無効な材料タイプです（videoまたはpdf）",
      });
    }

    // Calculate completion rate based on video progress only (not documents)
    const calculateCompletionRate = (videoProgress) => {
      if (!videoProgress || videoProgress.length === 0) return 0;

      const totalProgress = videoProgress.reduce(
        (sum, item) => sum + item.progress,
        0
      );
      return Math.round(totalProgress / videoProgress.length);
    };

    // Update completion rate (only from videos)
    course.completionRate = calculateCompletionRate(course.videoProgress);

    // Check if course is completed (100% completion rate for videos)
    if (course.completionRate === 100) {
      course.status = "completed";
      course.completedAt = new Date();
    }

    course.lastAccessedAt = new Date();
    await course.save();

    // Check exam eligibility for this user after updating progress
    try {
      // Get all available courses from materials
      const allCourseIds = await Material.distinct("courseId");

      // Get all courses purchased by this user
      const userCourses = await Course.find({
        userId: userId,
        status: { $in: ["active", "completed"] },
      }).select("courseId completionRate");

      // Check if user has purchased all courses
      const purchasedCourseIds = userCourses.map((c) => c.courseId);
      const hasAllCourses = allCourseIds.every((courseId) =>
        purchasedCourseIds.includes(courseId)
      );

      // Only check completion if user has all courses
      let allCoursesCompleted = false;
      if (hasAllCourses) {
        allCoursesCompleted = userCourses.every(
          (course) => course.completionRate === 100
        );
      }

      // Update exam eligibility for all user's courses
      await Course.updateMany(
        { userId: userId, status: { $in: ["active", "completed"] } },
        { examEligible: allCoursesCompleted }
      );
    } catch (eligibilityError) {
      console.error("Error checking exam eligibility:", eligibilityError);
      // Don't fail the main request if eligibility check fails
    }

    res.json({
      success: true,
      course: course,
      message: "進捗が更新されました",
    });
  } catch (error) {
    console.error("❌ Error updating course lecture progress:", error);
    res.status(500).json({
      success: false,
      message: "進捗の更新に失敗しました",
      error: error.message,
    });
  }
};

// Check exam eligibility for a user
const checkExamEligibility = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "認証が必要です",
      });
    }

    // Step 1: Get all available courses from materials collection
    const allCourseIds = await Material.distinct("courseId");

    if (!allCourseIds || allCourseIds.length === 0) {
      return res.json({
        success: true,
        examEligible: false,
        courses: [],
        message: "コースが存在しません",
      });
    }

    // Step 2: Get all courses purchased by this user
    const userCourses = await Course.find({
      userId: userId,
      status: { $in: ["active", "completed"] },
    }).select("courseId courseName completionRate status");

    // Step 3: Check if user has purchased all courses
    const purchasedCourseIds = userCourses.map((c) => c.courseId);
    const hasAllCourses = allCourseIds.every((courseId) =>
      purchasedCourseIds.includes(courseId)
    );

    let allCoursesCompleted = false;
    let coursesWithStatus = [];

    if (!hasAllCourses) {
      // User hasn't purchased all courses
      // Get course names from materials for all courses
      const materials = await Material.find({
        courseId: { $in: allCourseIds },
      }).select("courseId courseName");

      // Create a map of courseId to courseName
      const courseNameMap = new Map();
      materials.forEach((material) => {
        if (!courseNameMap.has(material.courseId)) {
          courseNameMap.set(material.courseId, material.courseName);
        }
      });

      // Format response with all courses (purchased and unpurchased)
      coursesWithStatus = allCourseIds.map((courseId) => {
        const userCourse = userCourses.find((c) => c.courseId === courseId);
        if (userCourse) {
          return {
            courseId: userCourse.courseId,
            courseName: userCourse.courseName,
            completionRate: userCourse.completionRate || 0,
            status: userCourse.status,
          };
        } else {
          return {
            courseId: courseId,
            courseName: courseNameMap.get(courseId) || courseId,
            completionRate: 0,
            status: "not_purchased",
          };
        }
      });

      // Update exam eligibility to false
      await Course.updateMany(
        { userId: userId, status: { $in: ["active", "completed"] } },
        { examEligible: false }
      );
    } else {
      // Step 4: User has purchased all courses, check if all completion rates are 100%
      allCoursesCompleted = userCourses.every(
        (course) => course.completionRate === 100
      );

      // Format courses with completion status
      coursesWithStatus = userCourses.map((course) => ({
        courseId: course.courseId,
        courseName: course.courseName,
        completionRate: course.completionRate || 0,
        status: course.status,
      }));

      // Update exam eligibility for all courses
      await Course.updateMany(
        { userId: userId, status: { $in: ["active", "completed"] } },
        { examEligible: allCoursesCompleted }
      );
    }

    res.json({
      success: true,
      examEligible: allCoursesCompleted,
      courses: coursesWithStatus,
      message: !hasAllCourses
        ? "すべてのコースを購入する必要があります"
        : allCoursesCompleted
        ? "すべてのコースが完了しました。試験を受けることができます。"
        : "まだコースが完了していません。",
    });
  } catch (error) {
    console.error("❌ Error checking exam eligibility:", error);
    res.status(500).json({
      success: false,
      message: "試験資格の確認に失敗しました",
      error: error.message,
    });
  }
};

// Get exam eligibility status for a user
const getExamEligibility = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "認証が必要です",
      });
    }

    // Step 1: Get all available courses from materials collection
    const allCourseIds = await Material.distinct("courseId");

    if (!allCourseIds || allCourseIds.length === 0) {
      return res.json({
        success: true,
        examEligible: false,
        courses: [],
        message: "コースが存在しません",
      });
    }

    // Step 2: Get all courses purchased by this user
    const userCourses = await Course.find({
      userId: userId,
      status: { $in: ["active", "completed"] },
    }).select("courseId courseName completionRate status");

    // Step 3: Check if user has purchased all courses
    const purchasedCourseIds = userCourses.map((c) => c.courseId);
    const hasAllCourses = allCourseIds.every((courseId) =>
      purchasedCourseIds.includes(courseId)
    );

    if (!hasAllCourses) {
      // User hasn't purchased all courses
      // Get course names from materials for all courses
      const materials = await Material.find({
        courseId: { $in: allCourseIds },
      }).select("courseId courseName");

      // Create a map of courseId to courseName
      const courseNameMap = new Map();
      materials.forEach((material) => {
        if (!courseNameMap.has(material.courseId)) {
          courseNameMap.set(material.courseId, material.courseName);
        }
      });

      // Format response with all courses (purchased and unpurchased)
      const allCoursesWithStatus = allCourseIds.map((courseId) => {
        const userCourse = userCourses.find((c) => c.courseId === courseId);
        if (userCourse) {
          return {
            courseId: userCourse.courseId,
            courseName: userCourse.courseName,
            completionRate: userCourse.completionRate || 0,
            status: userCourse.status,
          };
        } else {
          return {
            courseId: courseId,
            courseName: courseNameMap.get(courseId) || courseId,
            completionRate: 0,
            status: "not_purchased",
          };
        }
      });

      return res.json({
        success: true,
        examEligible: false,
        courses: allCoursesWithStatus,
        message: "すべてのコースを購入する必要があります",
      });
    }

    // Step 4: User has purchased all courses, check if all completion rates are 100%
    const allCoursesCompleted = userCourses.every(
      (course) => course.completionRate === 100
    );

    // Format courses with completion status
    const coursesWithStatus = userCourses.map((course) => ({
      courseId: course.courseId,
      courseName: course.courseName,
      completionRate: course.completionRate || 0,
      status: course.status,
    }));

    res.json({
      success: true,
      examEligible: allCoursesCompleted,
      courses: coursesWithStatus,
    });
  } catch (error) {
    console.error("❌ Error getting exam eligibility:", error);
    res.status(500).json({
      success: false,
      message: "試験資格の取得に失敗しました",
      error: error.message,
    });
  }
};

module.exports = {
  getUserCourses,
  getCourseById,
  updateCourseProgress,
  checkExamEligibility,
  getExamEligibility,
};
