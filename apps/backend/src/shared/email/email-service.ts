import nodemailer from 'nodemailer';

export interface EmailService {
  sendMail(to: string, subject: string, html: string): Promise<void>;
}

export class NodemailerEmailService implements EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Đọc biến môi trường, nếu không có thì dùng tài khoản bạn vừa cung cấp
    const user = process.env.SMTP_USER || 'mapmobile123456@gmail.com'; 
    const pass = process.env.SMTP_PASS || 'bpdj wgxq kclq uzvh';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || false, // false cho port 587, true cho 465
      auth: { user, pass },
    });
    
    console.log('Nodemailer: Configured to use real SMTP server (default: Gmail).');
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: '"Hệ thống VCP" <mapmobile123456@gmail.com>',
        to,
        subject,
        html,
      });

      console.log(`[Email Sent] To: ${to} | Subject: ${subject}`);
      // Lệnh getTestMessageUrl chỉ hoạt động với Ethereal, nên ta bỏ đi khi dùng mail thật.
    } catch (error) {
      console.error(`[Email Failed] Failed to send email to ${to}:`, error);
    }
  }
}
