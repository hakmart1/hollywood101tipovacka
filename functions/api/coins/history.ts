import { json } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { CoinHistoryRecord, Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

const PAGE_SIZE = 10;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "You must be logged in." }, 401);
  }

  const url = new URL(context.request.url);
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0);

  const totalRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM imf_coin_history WHERE user_id = ?1"
  ).bind(user.id).first<{ count: number }>();
  const total = totalRow?.count ?? 0;

  const result = await context.env.DB.prepare(
    `SELECT id, amount, reason, created_date
      FROM imf_coin_history
      WHERE user_id = ?1
      ORDER BY created_date DESC, id DESC
      LIMIT ?2 OFFSET ?3`
  ).bind(user.id, PAGE_SIZE, page * PAGE_SIZE).all<CoinHistoryRecord>();

  return json({
    error: null,
    history: result.results,
    page,
    page_size: PAGE_SIZE,
    total
  });
}
