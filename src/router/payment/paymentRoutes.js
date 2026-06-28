const express = require("express");
const { verifyToken } = require("../../controllers/authController");
const {
  createPaymentSession,
  handlePaymentSuccess,
  getStudentCourses,
  handleWebhook,
} = require("../../controllers/paymentController");

const router = express.Router();

// Create payment session for course enrollment (protected)
router.post("/create-session", verifyToken, createPaymentSession);

// Handle successful payment (protected)
router.post("/success", verifyToken, handlePaymentSuccess);

// Get all student's enrolled courses (protected)
router.get("/courses", verifyToken, getStudentCourses);

// Webhook endpoint (for Stripe to send events) - NOT protected (Stripe calls this)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

module.exports = router;
