const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

// Japanese font paths
const FONT_DIR = path.join(__dirname, "../../fonts");
const REGULAR_FONT = path.join(FONT_DIR, "NotoSansCJK-Regular.ttf");
const BOLD_FONT = path.join(FONT_DIR, "NotoSansCJK-Bold.ttf");

// Check if Japanese fonts are available
const hasJapaneseFonts = fs.existsSync(REGULAR_FONT) && fs.existsSync(BOLD_FONT);

/**
 * Generate PDF for multi-course ticket purchase
 * @param {Object} data - Purchase data
 * @param {string} data.groupId - Group ID (G + 7 digits)
 * @param {string} data.password - Password (10 digits)
 * @param {string} data.name - User name
 * @param {string} data.email - User email
 * @param {string} data.companyName - Company name
 * @param {string} data.postalCode - Postal code
 * @param {string} data.prefecture - Prefecture
 * @param {string} data.city - City
 * @param {string} data.addressOther - Other address
 * @param {string} data.phoneNumber - Phone number
 * @param {Array} data.courses - Array of course objects with courseId, courseName, price, ticketCount
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateMultiCourseTicketPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        autoFirstPage: true,
      });

      // Register Japanese fonts if available
      if (hasJapaneseFonts) {
        doc.registerFont("NotoSansCJK-Regular", REGULAR_FONT);
        doc.registerFont("NotoSansCJK-Bold", BOLD_FONT);
      }

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // Use Japanese fonts if available, otherwise fallback to Helvetica
      const regularFont = hasJapaneseFonts ? "NotoSansCJK-Regular" : "Helvetica";
      const boldFont = hasJapaneseFonts ? "NotoSansCJK-Bold" : "Helvetica-Bold";

      // Header
      doc.fontSize(20).font(boldFont).text("学ぼう国際研修センター", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font(regularFont).text("複数講座チケット購入証明書", { align: "center" });
      doc.moveDown(1);

      // Group Information
      doc.fontSize(14).font(boldFont).text("グループ情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);
      doc.text(`グループID: ${data.groupId}`, { indent: 20 });
      doc.text(`パスワード: ${data.password}`, { indent: 20 });
      doc.moveDown(1);

      // User Information
      doc.fontSize(14).font(boldFont).text("購入者情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);
      doc.text(`お名前: ${data.name}`, { indent: 20 });
      doc.text(`メールアドレス: ${data.email}`, { indent: 20 });
      doc.text(`電話番号: ${data.phoneNumber}`, { indent: 20 });
      doc.moveDown(0.5);

      // Company Information
      doc.fontSize(14).font(boldFont).text("会社情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);
      doc.text(`会社名: ${data.companyName}`, { indent: 20 });
      doc.text(`郵便番号: ${data.postalCode}`, { indent: 20 });
      doc.text(`都道府県: ${data.prefecture}`, { indent: 20 });
      doc.text(`市区町村: ${data.city}`, { indent: 20 });
      if (data.addressOther) {
        doc.text(`その他住所: ${data.addressOther}`, { indent: 20 });
      }
      doc.moveDown(1);

      // Course Information
      doc.fontSize(14).font(boldFont).text("購入講座情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);

      let totalAmount = 0;
      data.courses.forEach((course, index) => {
        const courseTotal = course.price * course.ticketCount;
        totalAmount += courseTotal;

        doc.text(`${index + 1}. ${course.courseName}`, { indent: 20 });
        doc.text(`   単価: ¥${course.price.toLocaleString()}`, { indent: 30 });
        doc.text(`   チケット数: ${course.ticketCount}枚`, { indent: 30 });
        doc.text(`   小計: ¥${courseTotal.toLocaleString()}`, { indent: 30 });
        doc.moveDown(0.3);
      });

      doc.moveDown(0.5);
      doc.fontSize(14).font(boldFont).text(`合計金額: ¥${totalAmount.toLocaleString()}`, { indent: 20 });
      doc.moveDown(1);

      // Footer
      doc.fontSize(10).font(regularFont).text(
        `発行日: ${new Date().toLocaleDateString("ja-JP")}`,
        { align: "right" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate PDF for student ticket assignment
 * @param {Object} data - Assignment data
 * @param {string} data.studentId - Student ID (S + 7 digits)
 * @param {string} data.password - Password (10 digits)
 * @param {string} data.name - Student name
 * @param {string} data.email - Student email
 * @param {Array} data.courses - Array of course objects with courseName, loginId, password
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateStudentTicketPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        autoFirstPage: true,
      });

      // Register Japanese fonts if available
      if (hasJapaneseFonts) {
        doc.registerFont("NotoSansCJK-Regular", REGULAR_FONT);
        doc.registerFont("NotoSansCJK-Bold", BOLD_FONT);
      }

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // Use Japanese fonts if available, otherwise fallback to Helvetica
      const regularFont = hasJapaneseFonts ? "NotoSansCJK-Regular" : "Helvetica";
      const boldFont = hasJapaneseFonts ? "NotoSansCJK-Bold" : "Helvetica-Bold";

      // Header
      doc.fontSize(20).font(boldFont).text("学ぼう国際研修センター", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font(regularFont).text("チケット割り当て証明書", { align: "center" });
      doc.moveDown(1);

      // Student Information
      doc.fontSize(14).font(boldFont).text("学生情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);
      doc.text(`学生ID: ${data.studentId}`, { indent: 20 });
      doc.text(`パスワード: ${data.password}`, { indent: 20 });
      doc.moveDown(1);

      // Student Details
      doc.fontSize(14).font(boldFont).text("受講者情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);
      doc.text(`お名前: ${data.name}`, { indent: 20 });
      doc.text(`メールアドレス: ${data.email}`, { indent: 20 });
      doc.moveDown(1);

      // Course Information
      doc.fontSize(14).font(boldFont).text("割り当て講座情報", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font(regularFont);

      data.courses.forEach((course, index) => {
        doc.text(`${index + 1}. ${course.courseName}`, { indent: 20 });
        doc.text(`   ログインID: ${course.loginId}`, { indent: 30 });
        doc.text(`   パスワード: ${course.password}`, { indent: 30 });
        doc.moveDown(0.3);
      });

      doc.moveDown(1);

      // Footer
      doc.fontSize(10).font(regularFont).text(
        `発行日: ${new Date().toLocaleDateString("ja-JP")}`,
        { align: "right" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateMultiCourseTicketPDF,
  generateStudentTicketPDF,
};
