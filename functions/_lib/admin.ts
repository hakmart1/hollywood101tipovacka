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

// Insert a fresh unassigned activation code, retrying on the (unlikely) UNIQUE
// collision. Returns the code, or null if it couldn't be created.
export async function createActivationCode(env: Env): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateActivationCode();
    try {
      await env.DB.prepare(
        "INSERT INTO activation_codes (code, user_id, consumed_date) VALUES (?1, NULL, NULL)"
      ).bind(code).run();
      return code;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("UNIQUE")) {
        console.error("Activation code insert failed", error);
        return null;
      }
    }
  }
  return null;
}
