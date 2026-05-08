import "server-only";

import nodemailer from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function emailConfigured() {
  return Boolean(
    process.env.BASECAMP_SMTP_HOST?.trim() &&
      process.env.BASECAMP_SMTP_USER?.trim() &&
      process.env.BASECAMP_SMTP_PASS?.trim()
  );
}

export async function sendTransactionalEmail(input: MailInput) {
  if (!emailConfigured()) {
    return {
      delivered: false,
      reason: "SMTP is not configured."
    };
  }

  const host = process.env.BASECAMP_SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.BASECAMP_SMTP_PORT ?? "587");
  const secure = process.env.BASECAMP_SMTP_SECURE === "true";
  const requireTLS = process.env.BASECAMP_SMTP_REQUIRE_TLS !== "false";
  const rejectUnauthorized = process.env.BASECAMP_SMTP_TLS_REJECT_UNAUTHORIZED !== "false";
  const user = process.env.BASECAMP_SMTP_USER?.trim() ?? "";
  const pass = process.env.BASECAMP_SMTP_PASS?.trim() ?? "";
  const fromAddress = process.env.BASECAMP_EMAIL_FROM?.trim() || user;
  const fromName = process.env.BASECAMP_EMAIL_FROM_NAME?.trim() || "Basecamp";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    tls: {
      rejectUnauthorized
    },
    auth: {
      user,
      pass
    }
  });

  await transporter.sendMail({
    from: `"${fromName.replace(/"/g, "'")}" <${fromAddress}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html
  });

  return {
    delivered: true,
    reason: "sent"
  };
}
