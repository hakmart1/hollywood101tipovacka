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
    `SELECT id, title, date_from, date_to, evaluated_date, type
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
    `SELECT nickname, avatar_hash, rank, previous_rank, rank_balance
      FROM users
      WHERE rank IS NOT NULL AND status != 'deleted'
      ORDER BY rank ASC
      LIMIT 100`
  ).all<{
    nickname: string;
    avatar_hash: string | null;
    rank: number;
    previous_rank: number | null;
    rank_balance: number | null;
  }>();

  return json({ error: null, results, leaderboard: leaderboard.results });
}
