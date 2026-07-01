import { describe, expect, it } from "vitest";

import { getEmailConfig } from "./email-service.ts";

describe("email configuration", () => {
  it("uses existing SMTP_* variables when present", () => {
    expect(getEmailConfig({
      SMTP_USER: "smtp@example.com",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "from@example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "2525",
      SMTP_SECURE: "true"
    })).toMatchObject({
      user: "smtp@example.com",
      pass: "smtp-pass",
      fromAddress: "from@example.com",
      host: "smtp.example.com",
      port: 2525,
      secure: true,
      configured: true
    });
  });

  it("accepts the module-level Gmail env variable names", () => {
    expect(getEmailConfig({
      GMAIL_USER: "gmail@example.com",
      GMAIL_APP_PASSWORD: "gmail-app-password"
    })).toMatchObject({
      user: "gmail@example.com",
      pass: "gmail-app-password",
      fromAddress: "gmail@example.com",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      configured: true
    });
  });
});
