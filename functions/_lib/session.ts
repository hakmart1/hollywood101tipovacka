import {
  readCookie,
  SESSION_COOKIE,
  verifySession
} from "./auth";
import type { Env, SessionUserRecord } from "./types";

export async function getSessionUser(
  request: Request,
  env: Env
): Promise<SessionUserRecord | null> {
  const session = await verifySession(
    readCookie(request, SESSION_COOKIE),
    env.SESSION_SECRET
  );

  if (!session) {
    return null;
  }

  const user = await env.DB.prepare(
    `SELECT
        id,
        nickname,
        email,
        role,
        status,
        imf_coins_balance,
        timezone,
        last_code_request_date,
        last_coins_request_date
      FROM users
      WHERE id = ?1`
  ).bind(session.userId).first<SessionUserRecord>();

  if (!user || user.status === "deleted") {
    return null;
  }

  return user;
}
