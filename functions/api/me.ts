import {
  json,
  readCookie,
  SESSION_COOKIE,
  verifySession
} from "../_lib/auth";
import type { Env, UserRecord } from "../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const session = await verifySession(
    readCookie(context.request, SESSION_COOKIE),
    context.env.SESSION_SECRET
  );

  if (!session) {
    return json({ user: null, error: null });
  }

  const user = await context.env.DB.prepare(
    "SELECT id, nickname, email, role, status, imf_coins_balance FROM users WHERE id = ?1"
  )
    .bind(session.userId)
    .first<UserRecord>();

  if (!user) {
    return json({ user: null, error: null });
  }

  return json({ user, error: null });
}
