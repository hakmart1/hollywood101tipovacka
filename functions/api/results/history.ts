import { json } from "../../_lib/auth";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface HistoryRoundRow {
  id: number;
  title: string;
  date_from: string;
  date_to: string;
  evaluated_date: string;
  type: string;
}

const PAGE_SIZE = 10;

// Lightweight, paginated list of every evaluated round (newest first), for the
// archive. Standings are fetched per round on demand via /api/results/:id.
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0);

  const totalRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM rounds WHERE evaluated_date IS NOT NULL"
  ).first<{ total: number }>();
  const total = totalRow?.total ?? 0;

  const rounds = await context.env.DB.prepare(
    `SELECT id, title, date_from, date_to, evaluated_date, type
      FROM rounds
      WHERE evaluated_date IS NOT NULL
      ORDER BY evaluated_date DESC
      LIMIT ?1 OFFSET ?2`
  ).bind(PAGE_SIZE, page * PAGE_SIZE).all<HistoryRoundRow>();

  return json({ error: null, rounds: rounds.results, page, page_size: PAGE_SIZE, total });
}
