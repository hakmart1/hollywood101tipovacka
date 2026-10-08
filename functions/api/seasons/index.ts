import { json } from "../../_lib/auth";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
}

// All seasons, newest first. The one with ended_date = null is the current one.
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const seasons = await context.env.DB.prepare(
    "SELECT id, name, started_date, ended_date FROM seasons ORDER BY id DESC"
  ).all<{ id: number; name: string; started_date: string; ended_date: string | null }>();

  return json({ error: null, seasons: seasons.results });
}
