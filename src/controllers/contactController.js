const { sendEmail } = require("../utils/emailService");

/**
 * Send contact form email
 * @route POST /api/contact
 */
const sendContactEmail = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "すべての項目を入力してください",
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

    // Admin email (recipient)
    const adminEmail = process.env.ADMIN_EMAIL || "nakano@manabou.co.jp";

    // Email to admin (notification)
    const adminEmailSubject = `【お問い合わせ】${subject}`;
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">お問い合わせが届きました</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>お名前：</strong> ${name}</p>
          <p><strong>メールアドレス：</strong> ${email}</p>
          <p><strong>件名：</strong> ${subject}</p>
          <p><strong>お問い合わせ日時：</strong> ${new Date().toLocaleString("ja-JP")}</p>
        </div>
        <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #0066cc; margin-top: 0;">メッセージ内容</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `;

    // Send email to admin
    await sendEmail({
      to: adminEmail,
      subject: adminEmailSubject,
      html: adminEmailHtml,
    });

    // Confirmation email to user
    const userEmailSubject = "【学ぼう国際研修センター】お問い合わせを受け付けました";
    const userEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">お問い合わせありがとうございます</h2>
        <p>${name} 様</p>
        <p>この度は、学ぼう国際研修センターにお問い合わせいただき、誠にありがとうございます。</p>
        <p>以下の内容でお問い合わせを受け付けました。</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>件名：</strong> ${subject}</p>
          <p><strong>お問い合わせ日時：</strong> ${new Date().toLocaleString("ja-JP")}</p>
        </div>
        
        <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #0066cc; margin-top: 0;">お問い合わせ内容</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        
        <p style="margin-top: 20px;">担当者より、通常1-2営業日以内にご返信いたします。</p>
        <p>今しばらくお待ちください。</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            学ぼう国際研修センター<br>
            〒150-0001 東京都渋谷区神宮前1-1-1 学ぼうビル 3階<br>
            電話: +81 (0)3 1234 5678<br>
            メール: nakano@manabou.co.jp
          </p>
        </div>
      </div>
    `;

    // Send confirmation email to user
    await sendEmail({
      to: email,
      subject: userEmailSubject,
      html: userEmailHtml,
    });

    res.json({
      success: true,
      message: "お問い合わせを受け付けました。確認メールを送信しました。",
    });
  } catch (error) {
    console.error("Error sending contact email:", error);
    res.status(500).json({
      success: false,
      message: "メールの送信に失敗しました。しばらくしてから再度お試しください。",
    });
  }
};

module.exports = {
  sendContactEmail,
};

