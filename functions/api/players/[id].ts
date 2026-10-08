import { json } from "../../_lib/auth";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  params: { id: string };
}

// Public player profile. Only data that's already public elsewhere (leaderboard,
// results) — never the e-mail. Deleted accounts don't have a profile.
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const playerId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(playerId) || playerId < 1) {
    return json({ error: "Neplatné ID hráče." });
  }

  const player = await context.env.DB.prepare(
    `SELECT id, nickname, avatar_hash, avatar_url, activated_date, imf_coins_balance, rank, rank_balance
       FROM users
      WHERE id = ?1 AND status != 'deleted'`
  ).bind(playerId).first<{
    id: number;
    nickname: string;
    avatar_hash: string | null;
    avatar_url: string | null;
    activated_date: string | null;
    imf_coins_balance: number;
    rank: number | null;
    rank_balance: number | null;
  }>();

  if (!player) {
    return json({ error: "Hráč nebyl nalezen." }, 404);
  }

  const season = await context.env.DB.prepare(
    "SELECT name FROM seasons WHERE ended_date IS NULL ORDER BY id DESC LIMIT 1"
  ).first<{ name: string }>();

  return json({ error: null, player, season_name: season?.name ?? null });
}
