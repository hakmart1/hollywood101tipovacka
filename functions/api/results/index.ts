import { json } from "../../_lib/auth";
import { buildRoundResult } from "../../_lib/results";
import type { ResultRoundInput } from "../../_lib/results";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  // The last evaluated round of any type (standard or bonus). The home page
  // shows this one as the most recent contest; only this round is rendered.
  const latestRound = await context.env.DB.prepare(
    `SELECT id, title, date_from, date_to, evaluated_date, type, description
      FROM rounds
      WHERE evaluated_date IS NOT NULL
      ORDER BY evaluated_date DESC
      LIMIT 1`
  ).first<ResultRoundInput>();

  const results = latestRound ? [await buildRoundResult(context.env, latestRound)] : [];

  // Global ranking, frozen at the last evaluation (tips spent between rounds
  // don't move anyone). Includes the admin, who plays like any other player.
  // previous_rank gives the movement since the evaluation before that.
  const leaderboard = await context.env.DB.prepare(
    `SELECT id AS user_id, nickname, avatar_hash, avatar_url, rank, previous_rank, rank_balance,
            achievements_diamond, achievements_gold, achievements_silver, achievements_bronze,
            achievements_raspberry
      FROM users
      WHERE rank IS NOT NULL AND status != 'deleted'
      ORDER BY rank ASC
      LIMIT 100`
  ).all<{
    user_id: number;
    nickname: string;
    avatar_hash: string | null;
    avatar_url: string | null;
    rank: number;
    previous_rank: number | null;
    rank_balance: number | null;
    achievements_diamond: number;
    achievements_gold: number;
    achievements_silver: number;
    achievements_bronze: number;
    achievements_raspberry: number;
  }>();

  return json({
    error: null,
    results,
    leaderboard: leaderboard.results.map(
      ({
        achievements_diamond,
        achievements_gold,
        achievements_silver,
        achievements_bronze,
        achievements_raspberry,
        ...entry
      }) => ({
        ...entry,
        // Per-tier totals stored on the user, so no extra read here.
        achievements: {
          diamond: achievements_diamond,
          gold: achievements_gold,
          silver: achievements_silver,
          bronze: achievements_bronze,
          raspberry: achievements_raspberry
        }
      })
    )
  });
}
