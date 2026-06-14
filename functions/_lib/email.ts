import type { Env } from "./types";

const DEFAULT_SENDER = "hollywood101tipovacka@gmail.com";
const SENDER_NAME = "Hollywood 101 Tipovačka";

// Send a transactional email via Mailjet's Send API v3.1 (works from Pages
// Functions, no domain needed — just a verified single sender). Returns true on
// success; no-ops (false) when the keys aren't configured, e.g. in local dev.
export async function sendEmail(
  env: Env,
  message: { to: string; subject: string; html: string; text: string }
): Promise<boolean> {
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    return false;
  }

  try {
    const auth = btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_SECRET_KEY}`);
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: env.EMAIL_FROM || DEFAULT_SENDER, Name: SENDER_NAME },
            To: [{ Email: message.to }],
            Subject: message.subject,
            TextPart: message.text,
            HTMLPart: message.html
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("Mailjet send failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Mailjet send error", error);
    return false;
  }
}
