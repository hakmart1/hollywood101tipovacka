import {
  hashPassword,
  json,
  readPasswordResetUserId,
  validatePassword,
  verifyPasswordResetToken
} from "../../_lib/auth";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface ResetPasswordRequestBody {
  token?: unknown;
  new_password?: unknown;
}

const INVALID_TOKEN = "Odkaz pro obnovení hesla je neplatný nebo vypršel.";

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let payload: ResetPasswordRequestBody;
  try {
    payload = (await context.request.json()) as ResetPasswordRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const token = typeof payload.token === "string" ? payload.token : "";
  if (!token) {
    return json({ error: INVALID_TOKEN });
  }

  if (!validatePassword(payload.new_password)) {
    return json({ error: "Nové heslo musí mít 8 až 128 znaků." });
  }
  const newPassword = payload.new_password;

  const userId = readPasswordResetUserId(token);
  if (userId === null) {
    return json({ error: INVALID_TOKEN });
  }

  const identity = await context.env.DB.prepare(
    `SELECT password_hash FROM user_auth_identities
      WHERE provider = 'local' AND user_id = ?1`
  ).bind(userId).first<{ password_hash: string }>();

  if (!identity) {
    return json({ error: INVALID_TOKEN });
  }

  const verified = await verifyPasswordResetToken(
    token,
    identity.password_hash,
    context.env.SESSION_SECRET
  );
  if (verified !== userId) {
    return json({ error: INVALID_TOKEN });
  }

  const newHash = await hashPassword(newPassword);
  await context.env.DB.prepare(
    "UPDATE user_auth_identities SET password_hash = ?1 WHERE provider = 'local' AND user_id = ?2"
  ).bind(newHash, userId).run();

  return json({ error: null, message: "Heslo bylo změněno. Můžeš se přihlásit." });
}
