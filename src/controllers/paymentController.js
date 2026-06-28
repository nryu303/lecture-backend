const stripe = require("../config/stripe");
const User = require("../model/User");
const Profile = require("../model/Profile");
const Course = require("../model/Course");

/**
 * Create payment session for student course enrollment
 * @route POST /api/payment/create-session
 */
const createPaymentSession = async (req, res) => {
  try {
    const { courseId } = req.body;
    const user = req.user;
    const userId = user.userId;

    // Check for required environment variables
    if (!stripe) {
      console.error("❌ STRIPE_SECRET_KEY is not set");
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured",
      });
    }

    // Production frontend URL
    let frontendUrl = process.env.PROD_FRONTEND_URL || "https://manabou.co.jp";
    
    // Ensure HTTPS protocol
    if (!frontendUrl.startsWith("http")) {
      frontendUrl = `https://${frontendUrl}`;
    } else if (frontendUrl.startsWith("http://")) {
      frontendUrl = frontendUrl.replace("http://", "https://");
    }

    // Validate input
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "コースIDが必要です",
      });
    }
    
    // Verify user is a student
    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "学生のみがコースに登録できます",
      });
    }

    // Check if user is already enrolled in this course
    const existingEnrollment = await Course.findOne({
      userId: userId,
      courseId: courseId,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "このコースには既に登録されています",
        alreadyEnrolled: true,
        enrollment: {
          studentId: existingEnrollment.studentId,
          courseName: existingEnrollment.courseName,
          enrollmentAt: existingEnrollment.enrollmentAt,
          status: existingEnrollment.status,
        },
      });
    }

    // Course pricing (in yen)
    const coursePrices = {
      general: 4500,
      caregiving: 6500,
      "specified-care": 8500,
      "initial-care": 7500,
      jlpt: 5500,
      "business-manner": 4000,
    };

    const courseNames = {
      general: "一般講習",
      caregiving: "介護講習",
      "specified-care": "介護基礎研修（特定）",
      "initial-care": "介護職員初任者研修",
      jlpt: "日本語能力試験対策",
      "business-manner": "ビジネスマナー講習",
    };

    const price = coursePrices[courseId];
    const courseName = courseNames[courseId];

    if (!price) {
      return res.status(400).json({
        success: false,
        message: "無効なコースIDです",
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: courseName,
              description: `月額料金 - ${courseName}`,
            },
            unit_amount: price,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${frontendUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/courses`,
      metadata: {
        userId: userId,
        courseId: courseId,
        courseName: courseName,
        type: "student_course_enrollment",
      },
    });

    res.json({
      success: true,
      sessionUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("❌ ERROR CREATING PAYMENT SESSION");
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    console.error("Environment check:", {
      stripeConfigured: !!stripe,
      frontendUrl: process.env.FRONTEND_URL,
      nodeEnv: process.env.NODE_ENV,
    });

    res.status(500).json({
      success: false,
      message: "支払いセッションの作成に失敗しました",
      error: error.message,
    });
  }
};

/**
 * Handle successful payment for course enrollment
 * @route POST /api/payment/success
 */
const handlePaymentSuccess = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const user = req.user;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "セッションIDが必要です",
      });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "セッションが見つかりません",
      });
    }

    // Check if this session has already been processed
    if (session.metadata.processed === "true") {
      return res.status(400).json({
        success: false,
        message: "この支払いセッションは既に処理済みです",
      });
    }

    // Verify the session is for student course enrollment
    if (session.metadata.type !== "student_course_enrollment") {
      return res.status(400).json({
        success: false,
        message: "無効な支払いセッションです",
      });
    }

    // Verify the user matches the session
    if (session.metadata.userId !== user.userId) {
      return res.status(403).json({
        success: false,
        message: "認証エラーが発生しました",
      });
    }

    // Generate student credentials for this course
    const studentId = `student_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const studentPassword = Math.random().toString(36).substr(2, 12);

    // Get user email
    const userRecord = await User.findById(user.userId);
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: "ユーザーが見つかりません",
      });
    }

    // Check if user is already enrolled (double-check before creating)
    const existingCourse = await Course.findOne({
      userId: user.userId,
      courseId: session.metadata.courseId,
    });

    if (existingCourse) {
      return res.json({
        success: true,
        message: "既に登録済みのコースです",
        alreadyEnrolled: true,
        credentials: {
          id: existingCourse.studentId,
          password: existingCourse.password,
          email: userRecord.email,
          courseId: existingCourse.courseId,
          courseName: existingCourse.courseName,
        },
      });
    }

    // Create course enrollment record
    const courseEnrollment = new Course({
      userId: user.userId,
      courseId: session.metadata.courseId,
      courseName: session.metadata.courseName,
      studentId: studentId,
      password: studentPassword,
      enrollmentAt: new Date(),
      paymentId: sessionId,
      subscriptionId: session.subscription || null,
      paymentAmount: session.amount_total || 0,
      lectureProgress: [], // Legacy field for backward compatibility
      videoProgress: [], // Video progress with percentage
      documentProgress: [], // Document progress without percentage
      status: "active",
      lastAccessedAt: new Date(),
    });

    try {
      await courseEnrollment.save();
    } catch (err) {
      // Handle duplicate key error (E11000)
      if (err.code === 11000) {
        const existing = await Course.findOne({
          userId: user.userId,
          courseId: session.metadata.courseId,
        });

        if (existing) {
          return res.json({
            success: true,
            message: "既に登録済みのコースです",
            alreadyEnrolled: true,
            credentials: {
              id: existing.studentId,
              password: existing.password,
              email: userRecord.email,
              courseId: existing.courseId,
              courseName: existing.courseName,
            },
          });
        }
      }
      throw err; // Re-throw if it's a different error
    }

    // Mark the session as processed
    try {
      await stripe.checkout.sessions.update(sessionId, {
        metadata: {
          ...session.metadata,
          processed: "true",
        },
      });
    } catch (updateError) {
      console.warn(
        "⚠ Failed to mark session as processed:",
        updateError.message
      );
    }

    res.json({
      success: true,
      message: "コース登録が完了しました",
      credentials: {
        id: studentId,
        password: studentPassword,
        email: userRecord.email,
        courseId: session.metadata.courseId,
        courseName: session.metadata.courseName,
      },
    });
  } catch (error) {
    console.error("❌ ERROR HANDLING PAYMENT SUCCESS");
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "支払いの処理中にエラーが発生しました",
      error: error.message,
    });
  }
};

/**
 * Get all student's enrolled courses
 * @route GET /api/payment/courses
 */
const getStudentCourses = async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "学生のみがアクセスできます",
      });
    }

    // Find all courses for this user
    const courses = await Course.find({ userId: user.userId }).sort({
      enrollmentAt: -1,
    });

    if (!courses || courses.length === 0) {
      return res.json({
        success: true,
        enrolled: false,
        courses: [],
        message: "登録されているコースがありません",
      });
    }

    // Return course details
    const courseList = courses.map((course) => ({
      id: course._id.toString(),
      courseId: course.courseId,
      courseName: course.courseName,
      studentId: course.studentId,
      password: course.password,
      enrollmentAt: course.enrollmentAt,
      lectureProgress: course.lectureProgress,
      status: course.status,
      lastAccessedAt: course.lastAccessedAt,
      completedAt: course.completedAt,
    }));

    res.json({
      success: true,
      enrolled: true,
      courses: courseList,
    });
  } catch (error) {
    console.error("❌ Error getting student courses:", error);
    res.status(500).json({
      success: false,
      message: "コース情報の取得に失敗しました",
      error: error.message,
    });
  }
};

/**
 * Handle Stripe webhooks
 * @route POST /api/payment/webhook
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("Stripe webhook secret not configured");
    return res.status(400).send("Webhook secret not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      // Handle successful payment here
      break;
    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      // Handle failed payment here
      break;
    default:
    // Unhandled event type
  }

  res.json({ received: true });
};

module.exports = {
  createPaymentSession,
  handlePaymentSuccess,
  getStudentCourses,
  handleWebhook,
};
