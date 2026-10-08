import { json } from "../../_lib/auth";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  params: { id: string };
}

// Final standings snapshot of an ended season (the current season's live
// leaderboard comes from /api/results).
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const seasonId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(seasonId) || seasonId < 1) {
    return json({ error: "Neplatné ID sezóny." });
  }

  const season = await context.env.DB.prepare(
    "SELECT id, name, started_date, ended_date FROM seasons WHERE id = ?1"
  ).bind(seasonId).first<{ id: number; name: string; started_date: string; ended_date: string | null }>();

  if (!season) {
    return json({ error: "Sezóna nebyla nalezena." }, 404);
  }

  const standings = await context.env.DB.prepare(
    `SELECT s.rank, s.nickname, s.balance, u.avatar_hash, u.avatar_url
       FROM season_standings s
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.season_id = ?1
      ORDER BY s.rank ASC, s.nickname ASC`
  ).bind(seasonId).all<{
    rank: number;
    nickname: string;
    balance: number;
    avatar_hash: string | null;
    avatar_url: string | null;
  }>();

  return json({ error: null, season, standings: standings.results });
}
