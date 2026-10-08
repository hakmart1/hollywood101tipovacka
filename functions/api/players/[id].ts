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
    `SELECT id, nickname, avatar_hash, avatar_url, activated_date, imf_coins_balance, rank, previous_rank, rank_balance
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
    previous_rank: number | null;
    rank_balance: number | null;
  }>();

  if (!player) {
    return json({ error: "Hráč nebyl nalezen." }, 404);
  }

  // Same population as the leaderboard, for "4. z 45".
  const ranked = await context.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE rank IS NOT NULL AND status != 'deleted'"
  ).first<{ n: number }>();

  // Tip stats describe the player, not a season, so they span all seasons.
  // Only evaluated rounds — open contests stay hidden. Movies with zero
  // revenue have no meaningful relative error.
  const tips = await context.env.DB.prepare(
    `SELECT g.guessed_revenue AS guess, m.actual_revenue AS actual
       FROM guesses g
       JOIN rounds r ON r.id = g.round_id
       JOIN movies m ON m.id = g.movie_id
      WHERE g.user_id = ?1
        AND r.evaluated_date IS NOT NULL
        AND g.guessed_revenue IS NOT NULL
        AND m.actual_revenue > 0`
  ).bind(playerId).all<{ guess: number; actual: number }>();

  return json({
    error: null,
    player,
    ranked_players: ranked?.n ?? 0,
    stats: tipStats(tips.results)
  });
}

// Median rather than mean: one tiny movie tipped 5x too high would otherwise
// dominate the number.
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function tipStats(tips: { guess: number; actual: number }[]) {
  if (tips.length === 0) {
    return { tips: 0, median_error: null, over: 0, under: 0 };
  }
  return {
    tips: tips.length,
    median_error: median(tips.map((tip) => Math.abs(tip.guess - tip.actual) / tip.actual)),
    over: tips.filter((tip) => tip.guess > tip.actual).length,
    under: tips.filter((tip) => tip.guess < tip.actual).length
  };
}
