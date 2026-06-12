import {
  readCookie,
  SESSION_COOKIE,
  verifySession
} from "./auth";
import type { Env, UserRecord } from "./types";

export async function requireAdmin(request: Request, env: Env): Promise<UserRecord | null> {
  const session = await verifySession(
    readCookie(request, SESSION_COOKIE),
    env.SESSION_SECRET
  );

  if (!session) {
    return null;
  }

  const user = await env.DB.prepare(
    "SELECT id, nickname, email, role, status, imf_coins_balance, timezone FROM users WHERE id = ?1"
  ).bind(session.userId).first<UserRecord>();

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateActivationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, (byte) => CODE_CHARSET[byte % CODE_CHARSET.length]);
  const groups = [];
  for (let index = 0; index < chars.length; index += 4) {
    groups.push(chars.slice(index, index + 4).join(""));
  }
  return groups.join("-");
}
