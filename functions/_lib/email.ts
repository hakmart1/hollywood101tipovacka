import type { Env } from "./types";

const DEFAULT_SENDER = "tipovacka@hollywood101.cz";
const SENDER_NAME = "Hollywood 101 Tipovačka";
// The domain has no mailbox/MX, so point replies at a real inbox.
const REPLY_TO = "hollywood101tipovacka@gmail.com";

// Canonical public URL — used for links in e-mails (branded custom domain, not
// the pages.dev host or a Mailjet tracking redirect).
export const SITE_URL = "https://tipovacka.hollywood101.cz";

const DEFAULT_FOOTER = "Pokud jsi o nic nežádal(a), klidně ho ignoruj.";

// Wrap message content in a simple branded shell with a footer. A fuller,
// consistently-branded layout looks like legitimate transactional mail and
// scores better with spam filters than a bare code + link. `footerHtml`
// replaces the default "ignore it" line (e.g. with how to unsubscribe).
export function emailLayout(innerHtml: string, footerHtml: string = DEFAULT_FOOTER): string {
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2430;font-size:15px;line-height:1.6;max-width:520px;margin:0 auto;padding:8px 4px;">` +
    `<p style="font-size:18px;font-weight:bold;color:#111827;margin:0 0 16px;">🎬 Hollywood 101 Tipovačka</p>` +
    innerHtml +
    `<hr style="border:none;border-top:1px solid #e4e6eb;margin:24px 0 12px;">` +
    `<p style="color:#6b7280;font-size:12px;margin:0;">` +
    `Tento e-mail ti přišel ze hry na <a href="${SITE_URL}" style="color:#6b7280;">tipovacka.hollywood101.cz</a>. ` +
    footerHtml +
    `</p>` +
    `</div>`
  );
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type MailEnv = Pick<Env, "MAILJET_API_KEY" | "MAILJET_SECRET_KEY" | "EMAIL_FROM">;

// Mailjet's Send API v3.1 accepts up to 50 messages per request.
const MAILJET_BATCH = 50;

// Send a transactional email via Mailjet's Send API v3.1. Returns true on
// success; no-ops (false) when the keys aren't configured, e.g. in local dev.
export async function sendEmail(env: MailEnv, message: EmailMessage): Promise<boolean> {
  return sendEmails(env, [message]);
}

// Send several emails (one per recipient) in as few API calls as possible.
// Returns true only if every batch was accepted.
export async function sendEmails(env: MailEnv, messages: EmailMessage[]): Promise<boolean> {
  if (!env.MAILJET_API_KEY || !env.MAILJET_SECRET_KEY) {
    return false;
  }
  if (messages.length === 0) {
    return true;
  }

  const auth = btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_SECRET_KEY}`);
  let allSent = true;
  for (let start = 0; start < messages.length; start += MAILJET_BATCH) {
    const batch = messages.slice(start, start + MAILJET_BATCH);
    try {
      const response = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          Messages: batch.map((message) => ({
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
          }))
        })
      });

      if (!response.ok) {
        console.error("Mailjet send failed", response.status, await response.text());
        allSent = false;
      }
    } catch (error) {
      console.error("Mailjet send error", error);
      allSent = false;
    }
  }
  return allSent;
}
