// Script to clean up test purchase data
require("dotenv").config();
const mongoose = require("mongoose");

const cleanup = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.PROD_MONGODB_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Get collections
    const User = require("./src/model/User");
    const Profile = require("./src/model/Profile");
    // GroupTicket model has been removed

    // Delete test group admin users
    const deletedUsers = await User.deleteMany({
      email: { $regex: "@groupadmin.local$" },
    });
    console.log(`🗑️  Deleted ${deletedUsers.deletedCount} test group admin users`);

    // Delete profiles for deleted users
    const deletedProfiles = await Profile.deleteMany({
      userId: { $nin: await User.find().distinct("_id").then(ids => ids.map(String)) },
    });
    console.log(`🗑️  Deleted ${deletedProfiles.deletedCount} orphaned profiles`);

    // GroupTicket deletion removed (model no longer exists)

    console.log("✅ Cleanup complete! You can now test fresh purchases.");
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
};

cleanup();

