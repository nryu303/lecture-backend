const express = require("express");
const router = express.Router();
const { getCertificate } = require("../../controllers/adminController");
const authenticateToken = require("../../middleware/auth");

// Apply authentication middleware to all certificate routes
router.use(authenticateToken);

// Get certificate for a user
router.get("/:userId", getCertificate);

module.exports = router;

