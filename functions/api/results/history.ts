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

// Lightweight list of every evaluated round (newest first), for the archive.
// Standings are fetched per round on demand via /api/results/:id.
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const rounds = await context.env.DB.prepare(
    `SELECT id, title, date_from, date_to, evaluated_date, type
      FROM rounds
      WHERE evaluated_date IS NOT NULL
      ORDER BY evaluated_date DESC`
  ).all<HistoryRoundRow>();

  return json({ error: null, rounds: rounds.results });
}
