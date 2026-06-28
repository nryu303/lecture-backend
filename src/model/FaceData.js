const { createModel } = require("../db/adapter");

// face_data table (one row per user; userId references users.id)
const FaceData = createModel("face_data", {
  columns: [
    "userId",
    "descriptor",
    "imageData",
    "registeredAt",
    "lastVerifiedAt",
    "verificationCount",
    "failedVerificationCount",
  ],
  refs: { userId: "users" },
});

module.exports = FaceData;
