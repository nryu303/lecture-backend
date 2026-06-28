const stripe = require("../config/stripe");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../model/User");
const Profile = require("../model/Profile");
const Course = require("../model/Course");
const Notification = require("../model/Notification");
const Certificate = require("../model/Certificate");
const ExamAttempt = require("../model/ExamAttempt");
const ExamHistory = require("../model/ExamHistory");
const Order = require("../model/Order");
const Ticket = require("../model/Ticket");
const Enrollment = require("../model/Enrollment");
const { sendEmailWithPDF, sendEmail } = require("../utils/emailService");
const { generateMultiCourseTicketPDF, generateStudentTicketPDF } = require("../utils/pdfGenerator");

/**
 * Generate group ID: G + 7 random digits
 */
const generateGroupId = () => {
  const randomDigits = crypto.randomInt(1000000, 9999999).toString();
  return `G${randomDigits}`;
};

/**
 * Generate password: 10 random single-digit numbers
 */
const generatePassword = () => {
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += crypto.randomInt(0, 10).toString();
  }
  return result;
};

/**
 * Generate login ID: T + 7 random single-digit numbers
 */
const generateLoginId = () => {
  let result = "T";
  for (let i = 0; i < 7; i++) {
    result += crypto.randomInt(0, 10).toString();
  }
  return result;
};

/**
 * Generate order ID: O + 10 random digits
 */
const generateOrderId = () => {
  const randomDigits = crypto.randomInt(1000000000, 9999999999).toString();
  return `O${randomDigits}`;
};

/**
 * Generate ticket ID: T + 12 random alphanumeric characters
 */
const generateTicketId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "T";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
};

/**
 * Generate enrollment ID: E + 10 random digits
 */
const generateEnrollmentId = () => {
  const randomDigits = crypto.randomInt(1000000000, 9999999999).toString();
  return `E${randomDigits}`;
};

/**
 * Generate student ID: S + 7 random single-digit numbers
 */
const generateStudentId = () => {
  let result = "S";
  for (let i = 0; i < 7; i++) {
    result += crypto.randomInt(0, 10).toString();
  }
  return result;
};

/**
 * Create multi-course ticket purchase session (public endpoint)
 * @route POST /api/group-admin/create-multi-ticket-session-public
 */
const createMultiTicketSessionPublic = async (req, res) => {
  try {
    const {
      courses,
      email,
      name,
      companyName,
      postalCode,
      prefecture,
      city,
      addressOther,
      phoneNumber,
    } = req.body;

    // Validate required fields
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "講座情報が必要です",
      });
    }

    if (!email || !name || !companyName) {
      return res.status(400).json({
        success: false,
        message: "メールアドレス、お名前、会社名は必須です",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "有効なメールアドレスを入力してください",
      });
    }

    // Validate courses
    for (const course of courses) {
      if (!course.courseId || !course.ticketCount || course.ticketCount < 1) {
        return res.status(400).json({
          success: false,
          message: "各講座のチケット数は1以上である必要があります",
        });
      }
    }

    // Search for existing group admin by email, phone, and postal code
    // All three must match to be considered the same group admin
    // This identifies if it's the same group admin making another purchase
    let existingProfile = await Profile.findOne({
      $and: [
        { postalCode: postalCode || "" },
        { phone: phoneNumber || "" },
      ],
    });

    // If profile found, check if the associated user has the same email
    let existingUser = null;
    if (existingProfile) {
      existingUser = await User.findById(existingProfile.userId);
      // If email doesn't match, treat as different group admin
      if (existingUser && existingUser.email !== email) {
        existingProfile = null;
        existingUser = null;
      }
    }

    let user;
    let userId;
    let plainPassword;
    let groupId;

    // If existing profile and user found with matching email, phone, and postal code
    if (existingProfile && existingUser && existingProfile.group_id) {
      // Found existing group admin - require login before purchasing another ticket
      return res.status(403).json({
        success: false,
        message: "既にチケットを購入されたグループ管理者です。再度購入するには、ログインしてください。",
        requiresLogin: true,
      });
    } else {
      // New group admin - email, phone, and postal code don't match any existing record
      // Create new user and profile
      // Check if user with email already exists (but different phone/postal code)
      user = await User.findOne({ email });
      
      if (user) {
        // User exists but with different phone/postal code - create new user with different email or use existing
        // Since email is unique, we need to check if we should create a new user
        // For now, we'll update the existing user but create a new profile
        userId = user._id.toString();
        // Generate new password for this purchase
        plainPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        user.password = hashedPassword;
        user.username = name;
        user.role = "group_admin";
        await user.save();
      } else {
        // Generate password for new user
        plainPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Create new user
        user = new User({
          email,
          username: name,
          password: hashedPassword,
          role: "group_admin",
        });

        await user.save();
        userId = user._id.toString();
      }

      // Generate group ID
      groupId = generateGroupId();
      
      // Ensure group_id is unique
      let duplicateProfile = await Profile.findOne({ group_id: groupId });
      while (duplicateProfile) {
        groupId = generateGroupId();
        duplicateProfile = await Profile.findOne({ group_id: groupId });
      }

      // Check if profile with this userId already exists (shouldn't happen, but safety check)
      let existingProfileForUser = await Profile.findOne({ userId });
      if (existingProfileForUser) {
        // Profile already exists for this userId - update it instead of creating new
        existingProfileForUser.companyName = companyName;
        existingProfileForUser.postalCode = postalCode || "";
        existingProfileForUser.prefecture = prefecture || "";
        existingProfileForUser.city = city || "";
        existingProfileForUser.addressOther = addressOther || "";
        existingProfileForUser.phone = phoneNumber || "";
        if (!existingProfileForUser.group_id) {
          existingProfileForUser.group_id = groupId;
        } else {
          groupId = existingProfileForUser.group_id;
        }
        await existingProfileForUser.save();
      } else {
        // Create new profile
        const profile = new Profile({
          userId,
          companyName,
          postalCode: postalCode || "",
          prefecture: prefecture || "",
          city: city || "",
          addressOther: addressOther || "",
          phone: phoneNumber || "",
          group_id: groupId,
        });
        await profile.save();
      }
    }

    // Course pricing (in yen) - same as paymentController
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

    // Prepare course details
    const courseDetails = [];
    let totalAmount = 0;

    for (const courseData of courses) {
      // Use price from frontend if provided, otherwise use hardcoded prices
      const coursePrice = courseData.price || coursePrices[courseData.courseId] || 0;
      const courseName = courseData.courseName || courseNames[courseData.courseId] || courseData.courseId;
      const ticketCount = parseInt(courseData.ticketCount, 10);
      const courseTotal = coursePrice * ticketCount;
      totalAmount += courseTotal;

      courseDetails.push({
        courseId: courseData.courseId,
        courseName: courseName,
        price: coursePrice,
        ticketCount,
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: courseDetails.map((course) => ({
        price_data: {
          currency: "jpy",
          product_data: {
            name: course.courseName,
            description: `${course.courseName} - ${course.ticketCount}枚`,
          },
          unit_amount: course.price, // JPY uses yen as the smallest unit (no conversion needed)
        },
        quantity: course.ticketCount,
      })),
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "https://manabou.co.jp"}/group-admin/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "https://manabou.co.jp"}/courses`,
      metadata: {
        userId: userId,
        email: email,
        name: name,
        companyName: companyName,
        postalCode: postalCode || "",
        prefecture: prefecture || "",
        city: city || "",
        addressOther: addressOther || "",
        phoneNumber: phoneNumber || "",
        groupId: groupId,
        password: plainPassword, // Store plain password in metadata for email
        isMultiCourse: "true",
        courses: JSON.stringify(courseDetails),
      },
    });

    res.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error("Error creating multi-ticket session:", error);
    res.status(500).json({
      success: false,
      message: error.message || "セッションの作成に失敗しました",
    });
  }
};

/**
 * Handle successful payment for multi-course purchase (public endpoint)
 * @route POST /api/group-admin/purchase-success-public
 */
const purchaseSuccessPublic = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session_id = sessionId; // Support both naming conventions

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "セッションIDが必要です",
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "支払いが完了していません",
      });
    }

    const metadata = session.metadata;
    const userId = metadata.userId;
    const email = metadata.email;
    const name = metadata.name;
    const companyName = metadata.companyName;
    const postalCode = metadata.postalCode || "";
    const prefecture = metadata.prefecture || "";
    const city = metadata.city || "";
    const addressOther = metadata.addressOther || "";
    const phoneNumber = metadata.phoneNumber || "";
    const groupId = metadata.groupId;
    const password = metadata.password; // Get password from metadata
    const courses = JSON.parse(metadata.courses);

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "ユーザーが見つかりません",
      });
    }

    // Update user if needed
    if (user.username !== name) {
      user.username = name;
      await user.save();
    }

    // Update profile if needed
    const profile = await Profile.findOne({ userId });
    // Use password from metadata (this is the plain text password saved during session creation)
    let displayPassword = password;
    
    // If password is empty (existing user case where we couldn't retrieve it), try to get it from first session
    if (!displayPassword || displayPassword === "") {
      try {
        // Search for the first purchase session for this user to get original password
        const sessionsPromise = stripe.checkout.sessions.list({
          limit: 100,
        });
        
        // Set a timeout of 5 seconds
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        
        const sessions = await Promise.race([sessionsPromise, timeoutPromise]);
        
        // Find the first paid session for this user with the same groupId
        if (sessions && sessions.data) {
          const firstSession = sessions.data.find(
            (s) => s.metadata && 
            s.metadata.userId === userId && 
            s.metadata.groupId === groupId &&
            s.metadata.password &&
            s.metadata.password !== "" &&
            s.payment_status === 'paid'
          );
          
          if (firstSession && firstSession.metadata.password) {
            displayPassword = firstSession.metadata.password;
          }
        }
      } catch (stripeError) {
        console.error("Error retrieving Stripe sessions for password (non-critical):", stripeError.message);
        // If we can't find it, use a placeholder message
        if (!displayPassword || displayPassword === "") {
          displayPassword = "既存のパスワードを使用してください";
        }
      }
    }
    
    if (profile) {
      profile.companyName = companyName;
      profile.postalCode = postalCode;
      profile.prefecture = prefecture;
      profile.city = city;
      profile.addressOther = addressOther;
      profile.phone = phoneNumber;
      if (!profile.group_id) {
        profile.group_id = groupId;
      }
      await profile.save();
    }

    // Create Orders and Tickets for each course
    const createdOrders = [];
    const createdTickets = [];

    for (const course of courses) {
      // Generate unique order_id for this course purchase
      let orderId = generateOrderId();
      let existingOrder = await Order.findOne({ order_id: orderId });
      while (existingOrder) {
        orderId = generateOrderId();
        existingOrder = await Order.findOne({ order_id: orderId });
      }

      // Create Order record
      const order = new Order({
        order_id: orderId,
        group_admin_id: userId.toString(), // Ensure string type
        purchase_date: new Date(),
        course_id: course.courseId,
        quantity: course.ticketCount,
        payment_id: session_id,
        status: "completed",
      });
      await order.save();
      createdOrders.push(order);

      // Create Tickets (unused) for this order
      for (let i = 0; i < course.ticketCount; i++) {
        // Generate unique ticket_id
        let ticketId = generateTicketId();
        let existingTicket = await Ticket.findOne({ ticket_id: ticketId });
        while (existingTicket) {
          ticketId = generateTicketId();
          existingTicket = await Ticket.findOne({ ticket_id: ticketId });
        }

        const ticket = new Ticket({
          ticket_id: ticketId,
          course_id: course.courseId,
          purchased_by: userId.toString(), // Ensure string type
          assigned_to: null,
          assigned_date: null,
          status: "unused",
          order_id: orderId,
        });
        await ticket.save();
        createdTickets.push(ticket);
      }
    }

    // Generate PDF
    const pdfBuffer = await generateMultiCourseTicketPDF({
      groupId,
      password: displayPassword,
      name,
      email,
      companyName,
      postalCode,
      prefecture,
      city,
      addressOther,
      phoneNumber,
      courses,
    });

    // Send email with PDF
    const emailSubject = "【学ぼう国際研修センター】複数講座チケット購入完了";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">複数講座チケット購入完了</h2>
        <p>${name}様</p>
        <p>この度は、学ぼう国際研修センターの複数講座チケットをご購入いただき、誠にありがとうございます。</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #0066cc; margin-top: 0;">購入情報</h3>
          <p><strong>グループID:</strong> ${groupId}</p>
          <p><strong>パスワード:</strong> ${displayPassword}</p>
          <p><strong>購入講座数:</strong> ${courses.length}講座</p>
        </div>

        <p>購入証明書をPDFファイルとして添付いたします。ご確認ください。</p>
        
        <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
        
        <p style="margin-top: 30px;">学ぼう国際研修センター</p>
      </div>
    `;

    let emailSent = false;
    try {
      await sendEmailWithPDF({
        to: email,
        subject: emailSubject,
        html: emailHtml,
        pdfBuffer,
        pdfFilename: `ticket-purchase-${groupId}.pdf`,
      });
      emailSent = true;
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Continue even if email fails
    }

    // Prepare response with created tickets
    const ticketGroupsMap = new Map();
    createdTickets.forEach(ticket => {
      const key = ticket.course_id;
      if (!ticketGroupsMap.has(key)) {
        const course = courses.find(c => c.courseId === key);
        ticketGroupsMap.set(key, {
          courseId: key,
          courseName: course?.courseName || key,
          price: course?.price || 0,
          ticketCount: 0,
          tickets: [],
        });
      }
      const group = ticketGroupsMap.get(key);
      group.ticketCount++;
      group.tickets.push({
        ticketId: ticket.ticket_id,
        status: ticket.status,
      });
    });

    const ticketGroups = Array.from(ticketGroupsMap.values());

    res.json({
      success: true,
      emailSent,
      isMultiCourse: true,
      ticketGroups,
      groupAdminCredentials: {
        email,
        groupId,
        password: displayPassword,
      },
    });
  } catch (error) {
    console.error("Error confirming multi-ticket purchase:", error);
    res.status(500).json({
      success: false,
      message: error.message || "購入確認の処理に失敗しました",
    });
  }
};

/**
 * Get ticket groups for authenticated group admin
 * @route GET /api/group-admin/ticket-groups
 */
const getTicketGroups = async (req, res) => {
  try {
    const user = req.user;
    const userId = user.userId;

    if (user.role !== "group_admin") {
      return res.status(403).json({
        success: false,
        message: "グループ管理者のみがアクセスできます",
      });
    }

    // Get all tickets for this group admin from Ticket collection
    // Convert userId to string to ensure type consistency
    const userIdString = userId.toString();
    console.log("🔍 Getting tickets for group admin:", userIdString);
    
    const tickets = await Ticket.find({ purchased_by: userIdString }).sort({ createdAt: -1 });
    console.log(`📊 Found ${tickets.length} tickets for group admin ${userIdString}`);

    if (tickets.length === 0) {
      console.log("⚠️ No tickets found for group admin");
      return res.json({
        success: true,
        ticketGroups: [],
      });
    }

    // Get course names
    const courseNames = {
      general: "一般講習",
      caregiving: "介護講習",
      "specified-care": "介護基礎研修（特定）",
      "initial-care": "介護職員初任者研修",
      jlpt: "日本語能力試験対策",
      "business-manner": "ビジネスマナー講習",
    };

    // Get orders for purchase dates - map order_id to purchase_date
    const orders = await Order.find({ group_admin_id: userIdString }).sort({ purchase_date: -1 });
    const orderDateMap = new Map();
    orders.forEach(order => {
      orderDateMap.set(order.order_id, order.purchase_date);
    });

    // Get ticket orders to map ticket_id to order_id and purchase_date
    const ticketOrderMap = new Map();
    for (const ticket of tickets) {
      if (ticket.order_id) {
        const order = await Order.findOne({ order_id: ticket.order_id });
        if (order) {
          ticketOrderMap.set(ticket.ticket_id, {
            orderId: order.order_id,
            purchaseDate: order.purchase_date,
          });
        }
      }
    }

    // Group tickets by courseId
    const courseGroups = new Map();
    
    for (const ticket of tickets) {
      const key = ticket.course_id;
      if (!courseGroups.has(key)) {
        courseGroups.set(key, {
          courseId: ticket.course_id,
          courseName: courseNames[ticket.course_id] || ticket.course_id,
          tickets: [],
        });
      }
      
      const group = courseGroups.get(key);
      
      // Get student info if ticket is assigned
      let studentInfo = null;
      if (ticket.assigned_to) {
        const student = await User.findById(ticket.assigned_to);
        const studentProfile = await Profile.findOne({ userId: ticket.assigned_to });
        if (student) {
          studentInfo = {
            name: student.username,
            email: student.email,
            birthday: studentProfile?.birthday || null,
          };
        }
      }

      // Get enrollment status if assigned
      let enrollmentStatus = null;
      if (ticket.assigned_to) {
        const enrollment = await Enrollment.findOne({ 
          ticket_id: ticket.ticket_id,
          student_id: ticket.assigned_to
        });
        if (enrollment) {
          enrollmentStatus = enrollment.progress_status;
        }
      }

      // Determine ticket status
      let ticketStatus = ticket.status;
      if (ticket.status === "assigned" && enrollmentStatus === "in_progress") {
        ticketStatus = "in_use";
      } else if (ticket.status === "assigned" && enrollmentStatus === "completed") {
        ticketStatus = "completed";
      }

      // Get purchase date for this ticket
      const ticketOrderInfo = ticketOrderMap.get(ticket.ticket_id);
      let purchaseDate = null;
      if (ticketOrderInfo) {
        purchaseDate = ticketOrderInfo.purchaseDate.toISOString();
      } else if (ticket.createdAt) {
        purchaseDate = ticket.createdAt.toISOString();
      } else {
        purchaseDate = new Date().toISOString();
      }

      group.tickets.push({
        ticketId: ticket.ticket_id,
        loginId: ticket.assigned_to || null,
        password: null, // Password is not stored in Ticket collection (will be generated when assigned)
        status: ticketStatus,
        usedBy: ticket.assigned_to || undefined,
        usedAt: ticket.assigned_date || undefined,
        purchaseDate: purchaseDate,
        studentInfo: studentInfo,
      });
    }

    // Convert to array format
    const ticketGroups = Array.from(courseGroups.values()).map((group) => {
      const groupTickets = group.tickets || [];
      const usedCount = groupTickets.filter((t) => t.status === "in_use" || t.status === "completed").length;
      const unusedCount = groupTickets.filter((t) => t.status === "unused").length;
      const assignedCount = groupTickets.filter((t) => t.status === "assigned").length;
      
      // Get earliest purchase date for this course
      const coursePurchaseDates = groupTickets
        .map(t => t.purchaseDate ? new Date(t.purchaseDate) : null)
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());
      const coursePurchaseDate = coursePurchaseDates.length > 0 
        ? coursePurchaseDates[0].toISOString()
        : new Date().toISOString();
      
      return {
        id: `${userId}-${group.courseId}`,
        courseId: group.courseId,
        courseName: group.courseName,
        ticketCount: groupTickets.length,
        usedCount: usedCount + assignedCount,
        unusedCount,
        purchaseDate: coursePurchaseDate,
        status: unusedCount > 0 ? "active" : "used",
        tickets: groupTickets,
      };
    });

    res.json({
      success: true,
      ticketGroups,
    });
  } catch (error) {
    console.error("Error getting ticket groups:", error);
    res.status(500).json({
      success: false,
      message: error.message || "チケットグループの取得に失敗しました",
    });
  }
};

/**
 * Create multi-course ticket purchase session (authenticated endpoint)
 * @route POST /api/group-admin/create-multi-ticket-session
 */
const createMultiTicketSession = async (req, res) => {
  try {
    const user = req.user;
    const userId = user.userId;
    const { courses } = req.body;

    if (user.role !== "group_admin") {
      return res.status(403).json({
        success: false,
        message: "グループ管理者のみがアクセスできます",
      });
    }

    // Validate required fields
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "講座情報が必要です",
      });
    }

    // Validate courses
    for (const course of courses) {
      if (!course.courseId || !course.ticketCount || course.ticketCount < 1) {
        return res.status(400).json({
          success: false,
          message: "各講座のチケット数は1以上である必要があります",
        });
      }
    }

    // Get user and profile
    const userRecord = await User.findById(userId);
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: "ユーザーが見つかりません",
      });
    }

    let profile = await Profile.findOne({ userId });
    let groupId;
    let plainPassword = "";

    if (profile && profile.group_id) {
      // Use existing group_id
      groupId = profile.group_id;
      
      // Try to get password from first Stripe session
      try {
        const sessionsPromise = stripe.checkout.sessions.list({
          limit: 100,
        });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
        );
        const sessions = await Promise.race([sessionsPromise, timeoutPromise]);
        
        if (sessions && sessions.data) {
          const firstSession = sessions.data.find(
            (s) => s.metadata && 
            s.metadata.userId === userId && 
            s.metadata.groupId === groupId &&
            s.metadata.password &&
            s.metadata.password !== "" &&
            s.payment_status === 'paid'
          );
          
          if (firstSession && firstSession.metadata.password) {
            plainPassword = firstSession.metadata.password;
          }
        }
      } catch (stripeError) {
        console.error("Error retrieving Stripe sessions (non-critical):", stripeError.message);
      }

      // Update profile with latest info
      profile.companyName = req.body.companyName || profile.companyName || "";
      profile.postalCode = req.body.postalCode || profile.postalCode || "";
      profile.prefecture = req.body.prefecture || profile.prefecture || "";
      profile.city = req.body.city || profile.city || "";
      profile.addressOther = req.body.addressOther || profile.addressOther || "";
      profile.phone = req.body.phoneNumber || profile.phone || "";
      await profile.save();
    } else {
      // Create new profile if doesn't exist
      groupId = generateGroupId();
      
      // Ensure group_id is unique
      let duplicateProfile = await Profile.findOne({ group_id: groupId });
      while (duplicateProfile) {
        groupId = generateGroupId();
        duplicateProfile = await Profile.findOne({ group_id: groupId });
      }

      plainPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      userRecord.password = hashedPassword;
      await userRecord.save();

      profile = new Profile({
        userId,
        companyName: req.body.companyName || "",
        postalCode: req.body.postalCode || "",
        prefecture: req.body.prefecture || "",
        city: req.body.city || "",
        addressOther: req.body.addressOther || "",
        phone: req.body.phoneNumber || "",
        group_id: groupId,
      });
      await profile.save();
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

    const courseDetails = [];
    let totalAmount = 0;

    for (const courseData of courses) {
      const coursePrice = courseData.price || coursePrices[courseData.courseId] || 0;
      const courseName = courseData.courseName || courseNames[courseData.courseId] || courseData.courseId;
      const ticketCount = parseInt(courseData.ticketCount, 10);
      const courseTotal = coursePrice * ticketCount;
      totalAmount += courseTotal;

      courseDetails.push({
        courseId: courseData.courseId,
        courseName: courseName,
        price: coursePrice,
        ticketCount,
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: courseDetails.map((course) => ({
        price_data: {
          currency: "jpy",
          product_data: {
            name: course.courseName,
            description: `${course.courseName} - ${course.ticketCount}枚`,
          },
          unit_amount: course.price, // JPY uses yen as the smallest unit (no conversion needed)
        },
        quantity: course.ticketCount,
      })),
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "https://manabou.co.jp"}/group-admin/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "https://manabou.co.jp"}/courses`,
      metadata: {
        userId: userId,
        email: userRecord.email,
        name: userRecord.username,
        companyName: profile.companyName || "",
        postalCode: profile.postalCode || "",
        prefecture: profile.prefecture || "",
        city: profile.city || "",
        addressOther: profile.addressOther || "",
        phoneNumber: profile.phone || "",
        groupId: groupId,
        password: plainPassword,
        isMultiCourse: "true",
        courses: JSON.stringify(courseDetails),
      },
    });

    res.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error("Error creating multi-ticket session:", error);
    res.status(500).json({
      success: false,
      message: error.message || "セッションの作成に失敗しました",
    });
  }
};

/**
 * Get all group admins (admin only)
 * @route GET /api/group-admin/admin/all
 */
const getAllGroupAdmins = async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "管理者のみがアクセスできます",
      });
    }

    // Get all users with role "group_admin"
    const groupAdminUsers = await User.find({ role: "group_admin" }).select("-password");
    
    // Get all profiles for group admins
    const profiles = await Profile.find({
      userId: { $in: groupAdminUsers.map(u => u._id.toString()) }
    });

    // Get all tickets for group admins from Ticket collection
    const allTickets = await Ticket.find({
      purchased_by: { $in: groupAdminUsers.map(u => u._id.toString()) }
    });

    // Get all orders for group admins
    const allOrders = await Order.find({
      group_admin_id: { $in: groupAdminUsers.map(u => u._id.toString()) }
    });

    // Get course names
    const courseNames = {
      general: "一般講習",
      caregiving: "介護講習",
      "specified-care": "介護基礎研修（特定）",
      "initial-care": "介護職員初任者研修",
      jlpt: "日本語能力試験対策",
      "business-manner": "ビジネスマナー講習",
    };

    // Build group admin data with stats
    const groupAdmins = await Promise.all(
      groupAdminUsers.map(async (user) => {
        const profile = profiles.find(p => p.userId === user._id.toString());
        const userTickets = allTickets.filter(t => t.purchased_by === user._id.toString());
        const userOrders = allOrders.filter(o => o.group_admin_id === user._id.toString());
        
        // Calculate stats
        const totalTickets = userTickets.length;
        const usedTickets = userTickets.filter(t => 
          t.status === "assigned" || t.status === "in_use" || t.status === "completed"
        ).length;
        const unusedTickets = userTickets.filter(t => t.status === "unused").length;
        
        // Calculate total spent from orders
        const totalSpent = userOrders.reduce((sum, order) => {
          const coursePrice = {
            general: 4500,
            caregiving: 6500,
            "specified-care": 8500,
            "initial-care": 7500,
            jlpt: 5500,
            "business-manner": 4000,
          }[order.course_id] || 0;
          return sum + (coursePrice * order.quantity);
        }, 0);

        // Get unique purchase dates
        const purchaseDates = [...new Set(
          userOrders.map(o => o.purchase_date?.toISOString().split('T')[0]).filter(Boolean)
        )];
        const totalPurchases = purchaseDates.length;

        // Group tickets by course
        const courseGroups = new Map();
        for (const ticket of userTickets) {
          const key = ticket.course_id;
          if (!courseGroups.has(key)) {
            courseGroups.set(key, {
              courseId: ticket.course_id,
              courseName: courseNames[ticket.course_id] || ticket.course_id,
              tickets: [],
            });
          }
          
          const group = courseGroups.get(key);
          
          // Get student info if ticket is assigned
          let studentInfo = null;
          if (ticket.assigned_to) {
            const student = await User.findById(ticket.assigned_to);
            if (student) {
              studentInfo = {
                name: student.username,
                email: student.email,
              };
            }
          }
          
          group.tickets.push({
            ticketId: ticket.ticket_id,
            loginId: ticket.assigned_to || null,
            password: null,
            status: ticket.status,
            usedBy: ticket.assigned_to || undefined,
            usedAt: ticket.assigned_date || undefined,
            studentInfo: studentInfo,
          });
        }

        const ticketsList = Array.from(courseGroups.values()).flatMap(group => group.tickets);
        const students = ticketsList
          .filter(t => t.status === "assigned" || t.status === "in_use" || t.status === "completed")
          .map(t => ({
            studentId: t.loginId,
            ticketId: t.ticketId,
            courseId: ticketsList.find(t2 => t2.ticketId === t.ticketId)?.courseId || "",
          }));

        return {
          groupAdminId: user._id.toString(),
          username: user.username,
          email: user.email,
          groupId: profile?.group_id || "",
          createdAt: user.createdAt,
          stats: {
            totalTickets,
            usedTickets,
            unusedTickets,
            totalSpent,
            totalPurchases,
          },
          allTickets,
          students,
        };
      })
    );

    res.json({
      success: true,
      groupAdmins,
    });
  } catch (error) {
    console.error("Error getting all group admins:", error);
    res.status(500).json({
      success: false,
      message: error.message || "グループ管理者の取得に失敗しました",
    });
  }
};

/**
 * Delete a group admin (admin only)
 * @route DELETE /api/group-admin/admin/:userId
 */
const deleteGroupAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.userId;

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "管理者のみがアクセスできます",
      });
    }

    // Check if admin is trying to delete themselves
    if (adminId === userId) {
      return res.status(400).json({
        success: false,
        message: "自分自身を削除することはできません",
      });
    }

    // Find the user to delete
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: "ユーザーが見つかりません",
      });
    }

    // Verify it's a group admin
    if (userToDelete.role !== "group_admin") {
      return res.status(400).json({
        success: false,
        message: "このユーザーはグループ管理者ではありません",
      });
    }

    // Delete all related data first (in order)
    // 1. Delete all tickets associated with this group admin
    await Ticket.deleteMany({ purchased_by: userId.toString() }); // Ensure string type

    // 2. Delete all orders associated with this group admin
    await Order.deleteMany({ group_admin_id: userId.toString() }); // Ensure string type

    // 3. Delete all enrollments for tickets purchased by this group admin
    const ticketsToDelete = await Ticket.find({ purchased_by: userId.toString() }); // Ensure string type
    const ticketIds = ticketsToDelete.map(t => t.ticket_id);
    await Enrollment.deleteMany({ ticket_id: { $in: ticketIds } });

    // 4. Delete all courses (for backward compatibility)
    await Course.deleteMany({ userId });

    // 5. Delete all certificates associated with this user
    await Certificate.deleteMany({ userId });

    // 6. Delete face data if exists (face_data.userId stores the user's uuid)
    const FaceData = require("../model/FaceData");
    await FaceData.deleteMany({ userId });

    // 7. Delete user profile
    await Profile.findOneAndDelete({ userId });

    // 8. Delete the user (must be last)
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: "グループ管理者を削除しました",
    });
  } catch (error) {
    console.error("Error deleting group admin:", error);
    res.status(500).json({
      success: false,
      message: error.message || "グループ管理者の削除に失敗しました",
    });
  }
};

/**
 * Assign tickets to student (group admin only)
 * @route POST /api/group-admin/assign-student-info
 */
const assignStudentInfo = async (req, res) => {
  try {
    const user = req.user;
    const userId = user.userId;

    if (user.role !== "group_admin") {
      return res.status(403).json({
        success: false,
        message: "グループ管理者のみがアクセスできます",
      });
    }

    const { ticketIds, studentInfo } = req.body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "チケットIDが必要です",
      });
    }

    if (!studentInfo || !studentInfo.name || !studentInfo.email) {
      return res.status(400).json({
        success: false,
        message: "学生情報（名前、メールアドレス）が必要です",
      });
    }

    // Validate: one ticket per course
    const tickets = await Ticket.find({ 
      ticket_id: { $in: ticketIds },
      purchased_by: userId.toString(), // Ensure string type
      status: "unused"
    });

    if (tickets.length !== ticketIds.length) {
      return res.status(400).json({
        success: false,
        message: "無効なチケットIDが含まれています",
      });
    }

    // Check for duplicate courses
    const courseIds = tickets.map(t => t.course_id);
    const uniqueCourseIds = [...new Set(courseIds)];
    if (courseIds.length !== uniqueCourseIds.length) {
      return res.status(400).json({
        success: false,
        message: "1つのコースにつき1つのチケットのみ割り当て可能です",
      });
    }

    // Check if student already has enrollment for any of these courses
    const existingStudent = await User.findOne({ 
      email: studentInfo.email,
      role: "student"
    });

    let studentUserId;
    let studentPassword = null;
    
    if (existingStudent) {
      studentUserId = existingStudent._id.toString();
      
      // Get existing student profile
      const studentProfile = await Profile.findOne({ userId: studentUserId });
      
      // Check if name, birthday, or face descriptor mismatch
      const nameMismatch = existingStudent.username !== studentInfo.name;
      let birthdayMismatch = false;
      if (studentInfo.birthday && studentProfile?.birthday) {
        const existingBirthday = new Date(studentProfile.birthday).toISOString().split('T')[0];
        const inputBirthday = new Date(studentInfo.birthday).toISOString().split('T')[0];
        birthdayMismatch = existingBirthday !== inputBirthday;
      } else if (studentInfo.birthday && !studentProfile?.birthday) {
        // Input has birthday but existing profile doesn't - this is okay, we'll update it
        birthdayMismatch = false;
      } else if (!studentInfo.birthday && studentProfile?.birthday) {
        // Existing has birthday but input doesn't - this is okay, we'll keep existing
        birthdayMismatch = false;
      }
      
      // If name or birthday mismatch, return error
      if (nameMismatch || birthdayMismatch) {
        return res.status(400).json({
          success: false,
          message: "学生情報を正確に入力してください。",
        });
      }
      
      // Check for existing enrollments
      const existingEnrollments = await Enrollment.find({
        student_id: studentUserId,
        course_id: { $in: courseIds }
      });

      if (existingEnrollments.length > 0) {
        return res.status(400).json({
          success: false,
          message: "この学生は既に該当する講座に登録されています。",
        });
      }

      // Update existing student profile with face descriptor if provided
      // Note: student_id is only set once and never changed
      let studentIdValue = null;
      if (studentProfile) {
        if (studentInfo.faceDescriptor && Array.isArray(studentInfo.faceDescriptor)) {
          studentProfile.faceDescriptor = studentInfo.faceDescriptor;
        }
        if (studentInfo.birthday) {
          studentProfile.birthday = new Date(studentInfo.birthday);
        }
        // Only set student_id if it doesn't exist (initial assignment only)
        if (!studentProfile.student_id) {
          let studentId = generateStudentId();
          let existingProfile = await Profile.findOne({ student_id: studentId });
          while (existingProfile) {
            studentId = generateStudentId();
            existingProfile = await Profile.findOne({ student_id: studentId });
          }
          studentProfile.student_id = studentId;
          studentIdValue = studentId;
        } else {
          studentIdValue = studentProfile.student_id;
        }
        await studentProfile.save();
      }
    } else {
      // Create new student account
      studentPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(studentPassword, 10);

      const newStudent = new User({
        email: studentInfo.email,
        username: studentInfo.name,
        password: hashedPassword,
        role: "student",
      });

      await newStudent.save();
      studentUserId = newStudent._id.toString();

      // Generate unique student_id
      let studentId = generateStudentId();
      let existingProfile = await Profile.findOne({ student_id: studentId });
      while (existingProfile) {
        studentId = generateStudentId();
        existingProfile = await Profile.findOne({ student_id: studentId });
      }

      // Create student profile with student_id
      const studentProfile = new Profile({
        userId: studentUserId,
        gender: "男性", // Default
        birthday: studentInfo.birthday ? new Date(studentInfo.birthday) : null,
        student_id: studentId, // S + 7 random single-digit numbers
      });

      // Store face descriptor if provided
      if (studentInfo.faceDescriptor && Array.isArray(studentInfo.faceDescriptor)) {
        studentProfile.faceDescriptor = studentInfo.faceDescriptor;
      }

      await studentProfile.save();
      studentIdValue = studentId;
    }

    // Get student_id from profile if not set yet
    if (!studentIdValue) {
      const finalProfile = await Profile.findOne({ userId: studentUserId });
      studentIdValue = finalProfile?.student_id || null;
    }

    // Get course names
    const courseNames = {
      general: "一般講習",
      caregiving: "介護講習",
      "specified-care": "介護基礎研修（特定）",
      "initial-care": "介護職員初任者研修",
      jlpt: "日本語能力試験対策",
      "business-manner": "ビジネスマナー講習",
    };

    // Assign tickets and create enrollments
    const assignedTickets = [];
    const enrollments = [];
    const createdCourses = [];

    for (const ticket of tickets) {
      // Update ticket
      ticket.assigned_to = studentUserId;
      ticket.assigned_date = new Date();
      ticket.status = "assigned";
      await ticket.save();
      assignedTickets.push(ticket);

      // Create enrollment
      let enrollmentId = generateEnrollmentId();
      let existingEnrollment = await Enrollment.findOne({ enrollment_id: enrollmentId });
      while (existingEnrollment) {
        enrollmentId = generateEnrollmentId();
        existingEnrollment = await Enrollment.findOne({ enrollment_id: enrollmentId });
      }

      const enrollment = new Enrollment({
        enrollment_id: enrollmentId,
        student_id: studentUserId,
        course_id: ticket.course_id,
        ticket_id: ticket.ticket_id,
        enrolled_date: new Date(),
        progress_status: "not_started",
      });

      await enrollment.save();
      enrollments.push(enrollment);

      // Create Course entry for backward compatibility with existing system
      // Generate login ID (T + 7 random single-digit numbers) and password (10 random single-digit numbers)
      const loginId = generateLoginId(); // T + 7 random single-digit numbers
      const coursePassword = generatePassword(); // 10 random single-digit numbers
      const coursePasswordHash = await bcrypt.hash(coursePassword, 10);

      // Check if Course entry already exists
      const existingCourse = await Course.findOne({
        userId: studentUserId,
        courseId: ticket.course_id,
      });

      if (!existingCourse) {
        const courseEntry = new Course({
          userId: studentUserId,
          courseId: ticket.course_id,
          courseName: courseNames[ticket.course_id] || ticket.course_id,
          studentId: loginId, // Login ID (T + 7 random single-digit numbers)
          password: coursePasswordHash,
          enrollmentAt: new Date(),
          videoProgress: [],
          documentProgress: [],
          lectureProgress: [],
          status: "active",
          lastAccessedAt: new Date(),
        });

        await courseEntry.save();
        createdCourses.push({
          courseId: ticket.course_id,
          courseName: courseNames[ticket.course_id] || ticket.course_id,
          loginId: loginId, // Login ID (T + 7 random single-digit numbers)
          password: coursePassword, // 10 random single-digit numbers
        });
      }
    }

    // Prepare course information for email
    const assignedCourses = createdCourses.map(c => ({
      courseId: c.courseId,
      courseName: c.courseName,
      loginId: c.loginId,
      password: c.password,
    }));

    // Get student login info (email and password if new student)
    const studentLoginEmail = studentInfo.email;
    const studentLoginPassword = studentPassword || "既存のパスワードを使用してください";

    const emailSubject = "【学ぼう国際研修センター】チケット割り当て完了";
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">チケット割り当て完了</h2>
        <p>${studentInfo.name}様</p>
        <p>この度は、学ぼう国際研修センターの講座チケットが割り当てられました。</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #0066cc; margin-top: 0;">ログイン情報</h3>
          <p><strong>学生ID:</strong> ${studentIdValue || "未設定"}</p>
          <p><strong>メールアドレス:</strong> ${studentLoginEmail}</p>
          ${studentPassword ? `<p><strong>パスワード:</strong> ${studentLoginPassword}</p>` : '<p><strong>パスワード:</strong> 既存のパスワードを使用してください</p>'}
          <p style="margin-top: 10px; font-size: 12px; color: #666;">※ 学生IDまたはメールアドレスでログインできます</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #0066cc; margin-top: 0;">割り当て講座</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #e0e0e0;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">講座名</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">学生ID</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">パスワード</th>
              </tr>
            </thead>
            <tbody>
              ${assignedCourses.map(c => `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${c.courseName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${c.loginId}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${c.password}</td>
                  </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <p>上記のログイン情報と各講座のログインID・パスワードを使用してログインしてください。</p>
        
        <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
        
        <p style="margin-top: 30px;">学ぼう国際研修センター</p>
      </div>
    `;

    // Generate PDF for student ticket assignment
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateStudentTicketPDF({
        studentId: studentIdValue || "未設定",
        password: studentLoginPassword,
        name: studentInfo.name,
        email: studentInfo.email,
        courses: assignedCourses,
      });
    } catch (pdfError) {
      console.error("Error generating student ticket PDF:", pdfError);
      // Continue even if PDF generation fails
    }

    // Send email with PDF attachment
    try {
      if (pdfBuffer) {
        await sendEmailWithPDF({
          to: studentInfo.email,
          subject: emailSubject,
          html: emailHtml,
          pdfBuffer,
          pdfFilename: `ticket-assignment-${studentIdValue || studentInfo.email}.pdf`,
        });
      } else {
        // Fallback to email without PDF if PDF generation failed
        await sendEmail({
          to: studentInfo.email,
          subject: emailSubject,
          html: emailHtml,
        });
      }
    } catch (emailError) {
      console.error("Error sending email to student:", emailError);
      // Continue even if email fails
    }

    res.json({
      success: true,
      message: `${assignedTickets.length}件のチケットを割り当てました`,
      updatedCount: assignedTickets.length,
    });
  } catch (error) {
    console.error("Error assigning student info:", error);
    
    // Check for duplicate key error (E11000)
    if (error.code === 11000 || error.message?.includes("duplicate key")) {
      return res.status(400).json({
        success: false,
        message: "学生情報を正確に入力してください。",
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || "チケット割り当てに失敗しました",
    });
  }
};

module.exports = {
  createMultiTicketSessionPublic,
  purchaseSuccessPublic,
  getTicketGroups,
  createMultiTicketSession,
  getAllGroupAdmins,
  deleteGroupAdmin,
  assignStudentInfo,
};
