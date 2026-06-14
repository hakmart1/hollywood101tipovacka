import {
  json,
  readCookie,
  SESSION_COOKIE,
  verifySession
} from "../_lib/auth";
import { getSessionUser } from "../_lib/session";
import type { Env, UserRecord } from "../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface UpdateMeRequestBody {
  timezone?: string;
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
    "SELECT id, nickname, email, role, status, imf_coins_balance, timezone FROM users WHERE id = ?1"
  )
    .bind(session.userId)
    .first<UserRecord>();

  if (!user) {
    return json({ user: null, error: null });
  }

  return json({ user, error: null });
}

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "Musíš být přihlášen(a)." }, 401);
  }

  let payload: UpdateMeRequestBody;
  try {
    payload = (await context.request.json()) as UpdateMeRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const timezone = String(payload.timezone || "").trim();

  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return json({ error: "Neznámá časová zóna." });
    }
  }

  await context.env.DB.prepare(
    "UPDATE users SET timezone = ?1 WHERE id = ?2"
  ).bind(timezone || null, user.id).run();

  return json({
    error: null,
    message: timezone ? `Time zone set to ${timezone}.` : "Time zone reset to browser default."
  });
}
