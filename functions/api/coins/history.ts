import { json } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { CoinHistoryRecord, Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "You must be logged in." }, 401);
  }

  const result = await context.env.DB.prepare(
    `SELECT id, amount, reason, created_date
      FROM imf_coin_history
      WHERE user_id = ?1
      ORDER BY created_date DESC, id DESC
      LIMIT 100`
  ).bind(user.id).all<CoinHistoryRecord>();

  return json({ error: null, history: result.results });
}
