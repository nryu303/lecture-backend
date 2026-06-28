const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const User = require("../model/User");
const Profile = require("../model/Profile");
const Course = require("../model/Course");
// GroupTicket model has been removed

/**
 * Get user profile with full details
 * @route GET /api/profile
 */
const getProfile = async (req, res) => {
  try {
    const { userId } = req.user;

    // Fetch user data using _id
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch profile data
    const profile = await Profile.findOne({ userId });

    // Fetch course data for the user
    const courses = await Course.find({ userId }).select(
      "courseName studentId password courseId status lectureProgress videoProgress documentProgress"
    );

    // Ticket-based studentInfo has been removed
    let studentInfoFromTicket = null;

    // Combine user and profile data
    const profileData = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: profile?.avatar || "",
      phone: profile?.phone || "",
      gender: profile?.gender || "男性",
      birthday: profile?.birthday || null,
      // Group admin specific fields
      group_id: profile?.group_id || "",
      companyName: profile?.companyName || "",
      postalCode: profile?.postalCode || "",
      prefecture: profile?.prefecture || "",
      city: profile?.city || "",
      addressOther: profile?.addressOther || "",
      // Student info (ticket-based info has been removed)
      studentInfo: studentInfoFromTicket ? {
        name: studentInfoFromTicket.name || null,
        birthday: studentInfoFromTicket.birthday || null,
        email: studentInfoFromTicket.email || null,
      } : null,
      joinedDate: user.createdAt,
      lastLogin: user.lastLoginAt,
      courses: courses.map((course) => ({
        courseId: course.courseId,
        courseName: course.courseName,
        studentId: course.studentId,
        password: course.password,
        status: course.status,
        lectureProgress: course.lectureProgress,
        videoProgress: course.videoProgress || [],
        documentProgress: course.documentProgress || [],
      })),
    };

    // Fetch all profiles from database
    const allProfiles = await Profile.find().sort({ createdAt: -1 });

    // Get user data for each profile
    const profilesWithUserData = await Promise.all(
      allProfiles.map(async (prof) => {
        const profileUser = await User.findById(prof.userId).select(
          "-password"
        );
        return {
          id: prof._id.toString(),
          userId: prof.userId,
          username: profileUser?.username || "",
          email: profileUser?.email || "",
          role: profileUser?.role || "student",
          avatar: prof.avatar,
          phone: prof.phone,
          gender: prof.gender,
          birthday: prof.birthday,
          createdAt: prof.createdAt,
          updatedAt: prof.updatedAt,
        };
      })
    );

    // Fetch all users from database
    const allUsers = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });
    const usersData = allUsers.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      email: u.email,
      role: u.role,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.status(200).json({
      success: true,
      profile: profileData,
      profiles: profilesWithUserData,
      users: usersData,
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
      error: error.message,
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { username, phone, gender, birthday, email, avatar, group_id, companyName, postalCode, prefecture, city, addressOther, studentInfo } = req.body;

    // Validate email format (only if email is provided and not empty)
    if (
      email &&
      email.trim() !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Validate phone format (only if phone is provided and not empty)
    // Allow digits, spaces, dashes, parentheses, and plus sign
    if (phone && phone.trim() !== "") {
      const cleanPhone = phone.replace(/[\s\-+()]/g, "");
      if (!/^\d{10,15}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format (should be 10-15 digits)",
        });
      }
    }

    // Validate birthday (only if birthday is provided and not empty)
    if (birthday && birthday.trim() !== "" && isNaN(Date.parse(birthday))) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format for birthday",
      });
    }

    // Fetch user using _id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // Update user fields if provided
    let userUpdated = false;
    if (email && email.trim() !== "" && email !== user.email) {
      user.email = email;
      userUpdated = true;
    }
    if (username && username.trim() !== "" && username !== user.username) {
      user.username = username;
      userUpdated = true;
    }
    if (userUpdated) {
      await user.save();
    }

    // Find or create profile
    let profile = await Profile.findOne({ userId });

    if (!profile) {
      profile = new Profile({
        userId,
      });
    }

    // Update profile fields
    let profileUpdated = false;

    if (phone !== undefined && phone.trim() !== "") {
      profile.phone = phone;
      profileUpdated = true;
    }
    if (gender !== undefined && gender.trim() !== "") {
      profile.gender = gender;
      profileUpdated = true;
    }
    if (birthday !== undefined && birthday.trim() !== "") {
      const newBirthday = birthday ? new Date(birthday) : null;
      profile.birthday = newBirthday;
      profileUpdated = true;
    }
    if (avatar !== undefined && avatar.trim() !== "") {
      profile.avatar = avatar;
      profileUpdated = true;
    }
    if (group_id !== undefined) {
      profile.group_id = group_id.trim() || "";
      profileUpdated = true;
    }
    if (companyName !== undefined) {
      profile.companyName = companyName.trim() || "";
      profileUpdated = true;
    }
    if (postalCode !== undefined) {
      profile.postalCode = postalCode.trim() || "";
      profileUpdated = true;
    }
    if (prefecture !== undefined) {
      profile.prefecture = prefecture.trim() || "";
      profileUpdated = true;
    }
    if (city !== undefined) {
      profile.city = city.trim() || "";
      profileUpdated = true;
    }
    if (addressOther !== undefined) {
      profile.addressOther = addressOther.trim() || "";
      profileUpdated = true;
    }

    await profile.save();

    // Ticket-based studentInfo updates have been removed
    let updatedStudentInfo = null;

    // Return updated profile
    const profileData = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: profile.avatar,
      phone: profile.phone,
      gender: profile.gender,
      birthday: profile.birthday,
      // Group admin specific fields
      group_id: profile.group_id || "",
      companyName: profile.companyName || "",
      postalCode: profile.postalCode || "",
      prefecture: profile.prefecture || "",
      city: profile.city || "",
      addressOther: profile.addressOther || "",
      // Student info (ticket-based info has been removed)
      studentInfo: null,
      joinedDate: user.createdAt,
      lastLogin: user.lastLoginAt,
    };

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("❌ ERROR UPDATING PROFILE");
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

/**
 * Upload avatar
 * @route POST /api/profile/avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    const { userId } = req.user;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }
    // Find or create profile
    let profile = await Profile.findOne({ userId });

    if (!profile) {
      // Get user data for creating profile
      const user = await User.findById(userId);

      // Create new profile if it doesn't exist
      profile = new Profile({
        userId,
      });
    }

    // Delete old avatar file if exists
    if (profile.avatar) {
      const oldAvatarPath = path.join(
        __dirname,
        "../../public",
        profile.avatar
      );
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Save new avatar path (relative path for URL)
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    profile.avatar = avatarUrl;
    await profile.save();

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      avatarUrl: avatarUrl,
    });
  } catch (error) {
    console.error("❌ ERROR UPLOADING AVATAR");
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // Clean up uploaded file if there was an error
    if (req.file) {
      const uploadedFilePath = req.file.path;
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
      error: error.message,
    });
  }
};

/**
 * Delete avatar
 * @route DELETE /api/profile/avatar
 */
const deleteAvatar = async (req, res) => {
  try {
    const { userId } = req.user;

    // Find profile
    const profile = await Profile.findOne({ userId });

    if (!profile || !profile.avatar) {
      return res.status(404).json({
        success: false,
        message: "No avatar to delete",
      });
    }

    // Delete avatar file
    const avatarPath = path.join(__dirname, "../../public", profile.avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    // Remove avatar from profile
    profile.avatar = "";
    await profile.save();

    res.status(200).json({
      success: true,
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting avatar:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete avatar",
      error: error.message,
    });
  }
};

/**
 * Change user password
 * @route PUT /api/profile/password
 */
const changePassword = async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const saltRounds = 12;
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashed;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message,
    });
  }
};

/**
 * Toggle favorite material for user
 * @route POST /api/profile/favorites
 */
const toggleFavorite = async (req, res) => {
  try {
    const { userId } = req.user;
    const { materialId } = req.body;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "教材IDが必要です",
      });
    }

    // Find or create profile
    let profile = await Profile.findOne({ userId });

    if (!profile) {
      profile = new Profile({
        userId,
        favorites: [],
      });
    }

    // Toggle favorite
    const favoriteIndex = profile.favorites.indexOf(materialId);
    if (favoriteIndex > -1) {
      // Remove from favorites
      profile.favorites.splice(favoriteIndex, 1);
      await profile.save();
      return res.status(200).json({
        success: true,
        message: "お気に入りから削除しました",
        isFavorite: false,
        favorites: profile.favorites,
      });
    } else {
      // Add to favorites
      profile.favorites.push(materialId);
      await profile.save();
      return res.status(200).json({
        success: true,
        message: "お気に入りに追加しました",
        isFavorite: true,
        favorites: profile.favorites,
      });
    }
  } catch (error) {
    console.error("Error toggling favorite:", error);
    res.status(500).json({
      success: false,
      message: "お気に入りの更新に失敗しました",
      error: error.message,
    });
  }
};

/**
 * Get user favorites
 * @route GET /api/profile/favorites
 */
const getFavorites = async (req, res) => {
  try {
    const { userId } = req.user;

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      return res.status(200).json({
        success: true,
        favorites: [],
      });
    }

    res.status(200).json({
      success: true,
      favorites: profile.favorites || [],
    });
  } catch (error) {
    console.error("Error getting favorites:", error);
    res.status(500).json({
      success: false,
      message: "お気に入りの取得に失敗しました",
      error: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  toggleFavorite,
  getFavorites,
};
