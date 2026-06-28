const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../public/uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: avatar_userId_timestamp_randomhex.ext
    const userId = req.user?.userId || "unknown";
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 18);
    const ext = path.extname(file.originalname);
    const filename = `avatar_${userId}_${timestamp}_${randomHex}${ext}`;
    cb(null, filename);
  },
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
      ),
      false
    );
  }
};

// Configure upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

module.exports = upload;
