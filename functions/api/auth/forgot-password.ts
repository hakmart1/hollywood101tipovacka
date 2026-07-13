import { createPasswordResetToken, json, normalizeEmail, validateEmail } from "../../_lib/auth";
import { SITE_URL, emailLayout, sendEmail } from "../../_lib/email";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface ForgotPasswordRequestBody {
  email?: unknown;
}

// Always returns the same generic message regardless of whether the account
// exists, to avoid leaking which e-mails are registered.
const GENERIC =
  "Pokud k tomuto e-mailu existuje účet, poslali jsme na něj odkaz pro obnovení hesla.";

// Don't re-send a reset link to the same account more often than this — silently
// skips (still returns GENERIC) so it can't be used to flood an inbox.
const RESET_COOLDOWN_MS = 10 * 60 * 1000;

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let payload: ForgotPasswordRequestBody;
  try {
    payload = (await context.request.json()) as ForgotPasswordRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const email = normalizeEmail(payload.email);
  if (!email || !validateEmail(email)) {
    return json({ error: "Zadejte platný e-mail." });
  }

  const account = await context.env.DB.prepare(
    `SELECT users.id, users.nickname, users.last_password_reset_date,
            user_auth_identities.password_hash
       FROM users
       INNER JOIN user_auth_identities ON user_auth_identities.user_id = users.id
      WHERE user_auth_identities.provider = 'local'
        AND users.email = ?1
        AND users.status != 'deleted'`
  ).bind(email).first<{
    id: number;
    nickname: string;
    last_password_reset_date: string | null;
    password_hash: string;
  }>();

  // Only do real work when the account exists, the secret is configured, and the
  // per-account cooldown has passed. The response is identical in every case.
  const throttled =
    account?.last_password_reset_date != null &&
    Date.now() - Date.parse(account.last_password_reset_date) < RESET_COOLDOWN_MS;

  if (account && context.env.SESSION_SECRET && !throttled) {
    const token = await createPasswordResetToken(
      account.id,
      account.password_hash,
      context.env.SESSION_SECRET
    );
    const resetUrl = `${SITE_URL}/#/reset?token=${encodeURIComponent(token)}`;
    const sent = await sendEmail(context.env, {
      to: email,
      subject: "Obnovení hesla – Hollywood 101 Tipovačka",
      html: emailLayout(
        `<p>Ahoj ${escapeHtml(account.nickname)},</p>` +
        `<p>Pro nastavení nového hesla klikni na tlačítko (odkaz platí 1 hodinu):</p>` +
        `<p style="margin:16px 0;"><a href="${resetUrl}" style="background:#e6b800;color:#111827;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;display:inline-block;">Obnovit heslo</a></p>` +
        `<p style="font-size:13px;color:#6b7280;word-break:break-all;">Nebo otevři tento odkaz: ${resetUrl}</p>`
      ),
      text:
        `Ahoj ${account.nickname},\n\n` +
        `Pro nastavení nového hesla otevři tento odkaz (platí 1 hodinu):\n${resetUrl}\n\n` +
        `Pokud jsi o obnovení nežádal(a), e-mail ignoruj.`
    });
    // Start the cooldown only once an email actually went out.
    if (sent) {
      await context.env.DB.prepare(
        "UPDATE users SET last_password_reset_date = ?1 WHERE id = ?2"
      ).bind(new Date().toISOString(), account.id).run();
    }
  }

  return json({ error: null, message: GENERIC });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
