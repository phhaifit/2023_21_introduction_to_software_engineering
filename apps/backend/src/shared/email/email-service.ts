import nodemailer from 'nodemailer';
import { existsSync, readFileSync } from 'node:fs';

export interface EmailService {
  sendMail(to: string, subject: string, html: string): Promise<void>;
}

export class NodemailerEmailService implements EmailService {
  private transporter: nodemailer.Transporter | null;
  private fromAddress: string | null;

  constructor() {
    loadWorkspaceUserManagementEmailEnv();

    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      this.transporter = null;
      this.fromAddress = null;
      console.warn(
        "Nodemailer: SMTP credentials are not configured. Set SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD to send email."
      );
      return;
    }

    this.fromAddress = user;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
    
    console.log(`Nodemailer: Configured SMTP transport for ${maskEmail(user)}.`);
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      throw new Error("SMTP credentials are not configured. Set SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD to send email.");
    }

    await this.transporter.sendMail({
      from: `"Hệ thống VCP" <${this.fromAddress}>`,
      to,
      subject,
      html,
    });

    console.log(`[Email Sent] To: ${to} | Subject: ${subject}`);
  }
}

function loadWorkspaceUserManagementEmailEnv(): void {
  if (process.env.VCP_DISABLE_MODULE_EMAIL_ENV === "true") {
    return;
  }

  const envUrl = new URL("../../modules/workspace-user-management/.env", import.meta.url);
  if (!existsSync(envUrl)) {
    return;
  }

  const contents = readFileSync(envUrl, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripEnvQuotes(line.slice(separatorIndex + 1).trim());
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function stripEnvQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}
