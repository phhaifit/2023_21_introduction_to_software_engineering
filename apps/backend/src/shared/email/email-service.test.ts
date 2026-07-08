import { afterEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock
  }
}));

describe("NodemailerEmailService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    createTransportMock.mockClear();
    sendMailMock.mockClear();
    vi.resetModules();
  });

  it("uses SMTP_USER and SMTP_PASS when configured", async () => {
    process.env.VCP_DISABLE_MODULE_EMAIL_ENV = "true";
    process.env.SMTP_USER = "smtp@example.com";
    process.env.SMTP_PASS = "app-password";
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    const { NodemailerEmailService } = await import("./email-service.ts");

    const service = new NodemailerEmailService();

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      auth: { user: "smtp@example.com", pass: "app-password" }
    }));
    await service.sendMail("member@example.com", "Subject", "<p>Hello</p>");
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Hệ thống VCP" <smtp@example.com>',
      to: "member@example.com"
    }));
  });

  it("uses Gmail env variable names when SMTP_* variables are absent", async () => {
    process.env.VCP_DISABLE_MODULE_EMAIL_ENV = "true";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.GMAIL_USER = "gmail@example.com";
    process.env.GMAIL_APP_PASSWORD = "gmail-password";
    const { NodemailerEmailService } = await import("./email-service.ts");

    new NodemailerEmailService();

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      auth: { user: "gmail@example.com", pass: "gmail-password" }
    }));
  });

  it("throws a clear error when SMTP credentials are missing", async () => {
    process.env.VCP_DISABLE_MODULE_EMAIL_ENV = "true";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    const { NodemailerEmailService } = await import("./email-service.ts");

    const service = new NodemailerEmailService();

    expect(createTransportMock).not.toHaveBeenCalled();
    await expect(service.sendMail("member@example.com", "Subject", "<p>Hello</p>"))
      .rejects.toThrow("SMTP credentials are not configured");
  });
});
