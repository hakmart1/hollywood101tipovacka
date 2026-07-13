import type { Env } from "./types";

const DEFAULT_SENDER = "tipovacka@hollywood101.cz";
const SENDER_NAME = "Hollywood 101 Tipovačka";
// The domain has no mailbox/MX, so point replies at a real inbox.
const REPLY_TO = "hollywood101tipovacka@gmail.com";

// Canonical public URL — used for links in e-mails (branded custom domain, not
// the pages.dev host or a Mailjet tracking redirect).
export const SITE_URL = "https://tipovacka.hollywood101.cz";

// Wrap message content in a simple branded shell with a footer. A fuller,
// consistently-branded layout looks like legitimate transactional mail and
// scores better with spam filters than a bare code + link.
export function emailLayout(innerHtml: string): string {
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2430;font-size:15px;line-height:1.6;max-width:520px;margin:0 auto;padding:8px 4px;">` +
    `<p style="font-size:18px;font-weight:bold;color:#111827;margin:0 0 16px;">🎬 Hollywood 101 Tipovačka</p>` +
    innerHtml +
    `<hr style="border:none;border-top:1px solid #e4e6eb;margin:24px 0 12px;">` +
    `<p style="color:#6b7280;font-size:12px;margin:0;">` +
    `Tento e-mail ti přišel ze hry na <a href="${SITE_URL}" style="color:#6b7280;">tipovacka.hollywood101.cz</a>. ` +
    `Pokud jsi o nic nežádal(a), klidně ho ignoruj.` +
    `</p>` +
    `</div>`
  );
}

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
            ReplyTo: { Email: REPLY_TO },
            To: [{ Email: message.to }],
            Subject: message.subject,
            TextPart: message.text,
            HTMLPart: message.html,
            // Keep links as clean hollywood101.cz URLs instead of Mailjet
            // tracking redirects — better for deliverability and trust.
            TrackOpens: "disabled",
            TrackClicks: "disabled"
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
