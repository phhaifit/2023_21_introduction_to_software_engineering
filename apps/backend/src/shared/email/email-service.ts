import nodemailer from 'nodemailer';

export interface EmailService {
  sendMail(to: string, subject: string, html: string): Promise<void>;
}

export type EmailConfig = {
  user?: string;
  pass?: string;
  fromAddress: string;
  host: string;
  port: number;
  secure: boolean;
  configured: boolean;
};

type EmailEnv = Record<string, string | undefined>;

export function getEmailConfig(env: EmailEnv = process.env): EmailConfig {
  const user = env.SMTP_USER || env.GMAIL_USER;
  const pass = env.SMTP_PASS || env.GMAIL_APP_PASSWORD;
  const fromAddress = env.SMTP_FROM || env.GMAIL_FROM || user || "no-reply@vcp.local";
  const host = env.SMTP_HOST || "smtp.gmail.com";
  const port = Number.parseInt(env.SMTP_PORT || "587", 10);
  const secure = env.SMTP_SECURE === "true";

  return {
    user,
    pass,
    fromAddress,
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    configured: Boolean(user && pass)
  };
}

export class NodemailerEmailService implements EmailService {
  private transporter: nodemailer.Transporter | null;
  private fromAddress: string;

  constructor() {
    const config = getEmailConfig();
    this.fromAddress = config.fromAddress;

    if (!config.configured) {
      this.transporter = null;
      console.warn("Nodemailer: SMTP credentials not configured; email delivery will fail until SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD are set.");
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      throw new Error("SMTP credentials are not configured. Set SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD to send email.");
    }

    try {
      await this.transporter.sendMail({
        from: `"Hệ thống VCP" <${this.fromAddress}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error(`[Email Failed] Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}
