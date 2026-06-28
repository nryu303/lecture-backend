const User = require("../model/User");
const Profile = require("../model/Profile");
const Course = require("../model/Course");
const Notification = require("../model/Notification");
const Certificate = require("../model/Certificate");

/**
 * Delete a user (admin only)
 * @route DELETE /api/admin/users/:userId
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.userId;

    // Check if admin is trying to delete themselves
    if (adminId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // Find the user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete all related data first (in order)
    // 1. Delete all courses (enrollments) associated with this user
    await Course.deleteMany({ userId });

    // 2. Delete all certificates associated with this user
    await Certificate.deleteMany({ userId });

    // 3. Delete face data if exists (face_data.userId stores the user's uuid)
    const FaceData = require("../model/FaceData");
    await FaceData.deleteMany({ userId });

    // 4. Delete user profile
    await Profile.findOneAndDelete({ userId });

    // 5. Delete the user (must be last)
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Block/Unblock a user (admin only)
 * @route PATCH /api/admin/users/:userId/block
 */
const toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;
    const adminId = req.user.userId;

    // Check if admin is trying to block themselves
    if (adminId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own account",
      });
    }

    // Find and update the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user's blocked status
    user.isBlocked = isBlocked;
    await user.save();

    res.json({
      success: true,
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
      data: {
        userId: user._id,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    console.error("Error toggling user block:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all users (admin only)
 * @route GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    // Get all users with their profiles
    const users = await User.find({}).select("-password");
    const profiles = await Profile.find({});
    const courses = await Course.find({});
    // GroupTicket model has been removed

    // Combine user and profile data
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        const profile = profiles.find((p) => p.userId === user._id.toString());
        const userCourses = courses
          .filter((c) => c.userId === user._id.toString())
          .map((course) => ({
            courseId: course.courseId,
            courseName: course.courseName,
            studentId: course.studentId,
            status: course.status,
            enrollmentAt: course.enrollmentAt,
            completedAt: course.completedAt,
          }));

        return {
          id: user._id.toString(),
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: profile?.avatar || "",
          phone: profile?.phone || "",
          gender: profile?.gender || "",
          birthday: profile?.birthday || "",
          // Group admin specific fields from profile
          group_id: profile?.group_id || "",
          companyName: profile?.companyName || "",
          postalCode: profile?.postalCode || "",
          prefecture: profile?.prefecture || "",
          city: profile?.city || "",
          addressOther: profile?.addressOther || "",
          joinedDate: user.createdAt,
          lastLogin: user.lastLoginAt,
          courses: userCourses,
          isBlocked: user.isBlocked || false,
        };
      })
    );

    res.json({
      success: true,
      data: usersWithProfiles,
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Issue certificate (admin only)
 * @route POST /api/admin/certificate/issue
 */
const issueCertificate = async (req, res) => {
  try {
    const { userId, firstCoursePurchaseDate, lastCourseCompletionDate } =
      req.body;
    const adminId = req.user.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // Check if certificate already exists
    const existingCertificate = await Certificate.findOne({ userId });
    if (existingCertificate) {
      return res.status(400).json({
        success: false,
        message: "Certificate already issued for this user",
      });
    }

    // Get user and profile information
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = await Profile.findOne({ userId });
    const name = user.username || user.email;
    let gender = "男";
    if (profile?.gender === "男性") {
      gender = "男";
    } else if (profile?.gender === "女性") {
      gender = "女";
    }

    // Get course dates if not provided
    const courses = await Course.find({ userId }).sort({ enrollmentAt: 1 });
    if (courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User has no enrolled courses",
      });
    }

    const startDate =
      firstCoursePurchaseDate ||
      (courses.length > 0 ? courses[0].enrollmentAt : null);

    const completedCourses = courses.filter(
      (c) => c.status === "completed" && c.completedAt
    );
    const endDate =
      lastCourseCompletionDate ||
      (completedCourses.length > 0
        ? completedCourses.sort(
          (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
        )[0].completedAt
        : courses.length > 0
          ? courses[courses.length - 1].enrollmentAt
          : null);

    // Generate certificate number
    const lastCertificate = await Certificate.findOne()
      .sort({ certificateNumber: -1 })
      .limit(1);

    let certificateNumber = "01";
    if (lastCertificate && lastCertificate.certificateNumber) {
      const lastNumber = parseInt(lastCertificate.certificateNumber, 10);
      if (!isNaN(lastNumber)) {
        const nextNumber = lastNumber + 1;
        certificateNumber = nextNumber.toString().padStart(2, "0");
      }
    }

    // Save certificate to database
    const certificate = new Certificate({
      userId,
      certificateNumber,
      name,
      gender,
      startDate,
      endDate,
      issueDate: new Date(),
      issuedBy: adminId,
    });

    await certificate.save();

    // Send notification to student
    const notification = new Notification({
      title: "修了証発行完了",
      message: `修了証（第${certificateNumber}号）が発行されました。プロフィールページから修了証を確認・ダウンロードできます。`,
      recipientId: userId,
      senderId: adminId,
      type: "success",
      metadata: {
        action: "view_certificate",
        certificateNumber: certificateNumber,
        certificateId: certificate._id.toString(),
      },
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Certificate issued successfully and notification sent to student",
      data: certificate,
    });
  } catch (error) {
    console.error("Error issuing certificate:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get certificate for a user
 * @route GET /api/certificates/:userId
 */
const getCertificate = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    // Users can only get their own certificate, or admins can get any certificate
    if (userId !== requestingUserId && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Find certificate by userId (stored as the user's uuid string)
    let certificate = await Certificate.findOne({ userId: userId });

    // Also try finding by userId as string in case it's stored differently
    if (!certificate) {
      certificate = await Certificate.findOne({ userId: String(userId) });
    }

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    res.json({
      success: true,
      data: certificate,
    });
  } catch (error) {
    console.error("Error getting certificate:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  deleteUser,
  toggleUserBlock,
  getAllUsers,
  issueCertificate,
  getCertificate,
};
