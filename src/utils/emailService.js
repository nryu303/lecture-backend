const nodemailer = require("nodemailer");

/**
 * Create email transporter
 */
const createTransporter = () => {
  // Gmail SMTP設定（環境変数から取得）
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send email with PDF attachment
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {Buffer} options.pdfBuffer - PDF file buffer
 * @param {string} options.pdfFilename - PDF filename
 */
const sendEmailWithPDF = async ({ to, subject, html, pdfBuffer, pdfFilename }) => {
  try {
    console.log(`📧 Sending email to: ${to}`);
    
    const transporter = createTransporter();

    const mailOptions = {
      from: `"学ぼう国際研修センター" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

/**
 * Send plain email without attachments
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email plain text content (optional)
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log(`📧 Sending email to: ${to}`);
    
    const transporter = createTransporter();

    const mailOptions = {
      from: `"学ぼう国際研修センター" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Fallback to plain text if not provided
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

module.exports = {
  sendEmailWithPDF,
  sendEmail,
};

