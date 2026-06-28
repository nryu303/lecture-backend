const { Profile } = require("../model");

/**
 * Register face data for a user (stored in Profile collection)
 */
const registerFace = async (req, res) => {
  try {
    const { userId } = req.user; // From auth middleware
    const { descriptor, imageData } = req.body;

    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid face descriptor",
      });
    }

    // Find or create profile for this user
    let profile = await Profile.findOne({ userId: userId.toString() });

    if (!profile) {
      // Create new profile if it doesn't exist
      profile = new Profile({
        userId: userId.toString(),
        faceDescriptor: descriptor,
      });
    } else {
      // Update existing profile with face descriptor
      profile.faceDescriptor = descriptor;
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: "Face registered successfully",
      data: {
        registeredAt: profile.updatedAt || new Date(),
      },
    });
  } catch (error) {
    console.error("Error registering face:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register face",
      error: error.message,
    });
  }
};

/**
 * Get face data for a user (from Profile collection)
 */
const getFaceData = async (req, res) => {
  try {
    const { userId } = req.user; // From auth middleware

    const profile = await Profile.findOne({ userId: userId.toString() });

    if (!profile || !profile.faceDescriptor || profile.faceDescriptor.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No face data found for this user",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        descriptor: profile.faceDescriptor,
        registeredAt: profile.updatedAt || profile.createdAt,
      },
    });
  } catch (error) {
    console.error("Error getting face data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get face data",
      error: error.message,
    });
  }
};

/**
 * Verify face against registered face data (from Profile collection)
 */
const verifyFace = async (req, res) => {
  try {
    const { userId } = req.user; // From auth middleware
    const { descriptor, similarity } = req.body;

    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid face descriptor",
      });
    }

    const profile = await Profile.findOne({ userId: userId.toString() });

    if (!profile || !profile.faceDescriptor || profile.faceDescriptor.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No face data found for this user",
      });
    }

    // Note: Similarity calculation is done on the frontend
    // This endpoint just confirms the face data exists and returns the result

    res.status(200).json({
      success: true,
      verified: similarity >= 0.6,
      similarity,
      message: similarity >= 0.6 ? "Face verified successfully" : "Face verification failed",
    });
  } catch (error) {
    console.error("Error verifying face:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify face",
      error: error.message,
    });
  }
};

/**
 * Delete face data for a user (from Profile collection)
 */
const deleteFaceData = async (req, res) => {
  try {
    const { userId } = req.user; // From auth middleware

    const profile = await Profile.findOne({ userId: userId.toString() });

    if (!profile || !profile.faceDescriptor || profile.faceDescriptor.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No face data found for this user",
      });
    }

    // Clear face descriptor from profile
    profile.faceDescriptor = [];
    await profile.save();

    res.status(200).json({
      success: true,
      message: "Face data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting face data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete face data",
      error: error.message,
    });
  }
};

module.exports = {
  registerFace,
  getFaceData,
  verifyFace,
  deleteFaceData,
};

