import {
  assertSessionConfig,
  buildCookie,
  json,
  normalizeEmail,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  validateEmail,
  verifyPassword
} from "../../_lib/auth";
import type { Env, LoginAccountRecord, LoginRequestBody } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  assertSessionConfig(context.env);

  let payload: LoginRequestBody;
  try {
    payload = (await context.request.json()) as LoginRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const email = normalizeEmail(payload.email);
  const password = payload.password;

  if (!email || !password) {
    return json({ error: "Vyplňte e-mail a heslo." });
  }

  if (!validateEmail(email)) {
    return json({ error: "Zadejte platný e-mail." });
  }

  const account = await context.env.DB.prepare(
    `SELECT
        users.id,
        users.nickname,
        users.email,
        users.role,
        users.status,
        users.imf_coins_balance,
        users.timezone,
        user_auth_identities.password_hash
      FROM users
      INNER JOIN user_auth_identities ON user_auth_identities.user_id = users.id
      WHERE user_auth_identities.provider = 'local'
        AND users.email = ?1`
  ).bind(email).first<LoginAccountRecord>();

  if (!account) {
    return json({ error: "Nesprávný e-mail nebo heslo." });
  }

  const passwordValid = await verifyPassword(password, account.password_hash);
  if (!passwordValid) {
    return json({ error: "Nesprávný e-mail nebo heslo." });
  }

  const now = new Date().toISOString();
  await context.env.DB.prepare(
    "UPDATE users SET last_login_date = ?1 WHERE id = ?2"
  ).bind(now, account.id).run();

  const sessionToken = await signSession(
    {
      userId: account.id,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
    },
    context.env.SESSION_SECRET!
  );

  return new Response(
    JSON.stringify({
      error: null,
      message: "Přihlášení proběhlo úspěšně.",
      user: {
        id: account.id,
        nickname: account.nickname,
        email: account.email,
        role: account.role,
        status: account.status,
        imf_coins_balance: account.imf_coins_balance,
        timezone: account.timezone
      }
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": buildCookie(SESSION_COOKIE, sessionToken, {
          httpOnly: true,
          maxAge: SESSION_MAX_AGE_SECONDS
        })
      }
    }
  );
}
