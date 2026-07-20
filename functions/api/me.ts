import {
  json,
  readCookie,
  SESSION_COOKIE,
  verifySession
} from "../_lib/auth";
import { getSessionUser } from "../_lib/session";
import { normalizeUrl } from "../_lib/url";
import type { Env, UserRecord } from "../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface UpdateMeRequestBody {
  timezone?: string;
  avatar_url?: string | null;
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
    "SELECT id, nickname, email, role, status, imf_coins_balance, timezone, avatar_url FROM users WHERE id = ?1"
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

  // Update only the fields actually present in the payload, so a partial update
  // (e.g. just the avatar) can't reset the other.
  const columns: string[] = [];
  const values: (string | number | null)[] = [];

  if (Object.prototype.hasOwnProperty.call(payload, "timezone")) {
    const timezone = String(payload.timezone || "").trim();
    if (timezone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      } catch {
        return json({ error: "Neznámá časová zóna." });
      }
    }
    columns.push("timezone");
    values.push(timezone || null);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "avatar_url")) {
    // Same rules as movie posters (see _lib/url): scheme optional (assumes
    // https), data:image/ and http(s) allowed. Cap the length so a user can't
    // store a huge inline data-URI that bloats every leaderboard response.
    const avatarUrl = normalizeUrl(payload.avatar_url);
    if (avatarUrl && avatarUrl.length > 2048) {
      return json({ error: "Odkaz na obrázek je příliš dlouhý." });
    }
    columns.push("avatar_url");
    values.push(avatarUrl);
  }

  if (columns.length === 0) {
    return json({ error: null, message: "Nic ke změně." });
  }

  const assignments = columns.map((column, index) => `${column} = ?${index + 1}`).join(", ");
  values.push(user.id);
  await context.env.DB.prepare(
    `UPDATE users SET ${assignments} WHERE id = ?${values.length}`
  ).bind(...values).run();

  return json({ error: null, message: "Uloženo." });
}
