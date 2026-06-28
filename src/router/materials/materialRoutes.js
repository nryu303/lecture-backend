const express = require("express");
const router = express.Router();
const {
  getAllMaterials,
  getMaterialById,
  uploadVideoAndCreateMaterial,
  uploadPdfAndCreateMaterial,
  updateMaterial,
  deleteMaterial,
  checkTitleExists,
  upload,
  uploadPdf,
} = require("../../controllers/materialController");

// Get all materials (with optional courseId filter)
router.get("/", getAllMaterials);

// Check if title exists
router.get("/check-title", checkTitleExists);

// Get material by ID
router.get("/:id", getMaterialById);

// Upload video and create material
router.post("/upload", upload.single("video"), uploadVideoAndCreateMaterial);

// helper to normalize multer output to req.file
const pickFirstFile = (req, res, next) => {
  if (!req.file) {
    if (Array.isArray(req.files) && req.files.length > 0) {
      req.file = req.files[0];
    } else if (req.files && typeof req.files === "object") {
      const keys = Object.keys(req.files);
      for (const k of keys) {
        const arr = req.files[k];
        if (Array.isArray(arr) && arr.length > 0) {
          req.file = arr[0];
          break;
        }
      }
    }
  }
  next();
};

// Upload pdf and create material (accept any field name and normalize)
router.post(
  "/upload-pdf",
  (req, res, next) => uploadPdf.any()(req, res, next),
  pickFirstFile,
  uploadPdfAndCreateMaterial
);

// Document upload route removed (PDF only)

// Update material
router.put("/:id", updateMaterial);

// Delete material
router.delete("/:id", deleteMaterial);

module.exports = router;
