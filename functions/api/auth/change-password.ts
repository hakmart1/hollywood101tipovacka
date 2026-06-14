import { hashPassword, json, validatePassword, verifyPassword } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface ChangePasswordRequestBody {
  current_password?: unknown;
  new_password?: unknown;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "Pro změnu hesla se musíte přihlásit." }, 401);
  }

  let payload: ChangePasswordRequestBody;
  try {
    payload = (await context.request.json()) as ChangePasswordRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const currentPassword = payload.current_password;
  if (typeof currentPassword !== "string" || currentPassword === "") {
    return json({ error: "Zadejte současné heslo." });
  }

  if (!validatePassword(payload.new_password)) {
    return json({ error: "Nové heslo musí mít 8 až 128 znaků." });
  }
  const newPassword = payload.new_password;

  const identity = await context.env.DB.prepare(
    `SELECT password_hash
       FROM user_auth_identities
      WHERE provider = 'local' AND user_id = ?1`
  ).bind(user.id).first<{ password_hash: string }>();

  if (!identity) {
    return json({ error: "Účet nepodporuje změnu hesla." });
  }

  const currentValid = await verifyPassword(currentPassword, identity.password_hash);
  if (!currentValid) {
    return json({ error: "Současné heslo není správné." });
  }

  if (await verifyPassword(newPassword, identity.password_hash)) {
    return json({ error: "Nové heslo se musí lišit od současného." });
  }

  const newHash = await hashPassword(newPassword);
  await context.env.DB.prepare(
    "UPDATE user_auth_identities SET password_hash = ?1 WHERE provider = 'local' AND user_id = ?2"
  ).bind(newHash, user.id).run();

  return json({ error: null, message: "Heslo bylo změněno." });
}
