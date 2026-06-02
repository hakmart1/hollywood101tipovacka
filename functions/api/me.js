import {
  json,
  readCookie,
  SESSION_COOKIE,
  verifySession
} from "../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await verifySession(
    readCookie(context.request, SESSION_COOKIE),
    context.env.SESSION_SECRET
  );

  if (!session) {
    return json({ error: "Unauthorized" }, 401);
  }

  const user = await context.env.DB.prepare(
    "SELECT id, nickname, email, role, status, imf_coins_balance FROM users WHERE id = ?1"
  )
    .bind(session.userId)
    .first();

  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  return json({ user });
}
