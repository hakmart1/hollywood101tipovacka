import { json } from "../../_lib/auth";
import { buildRoundResult } from "../../_lib/results";
import type { ResultRoundInput } from "../../_lib/results";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

const RESULT_WINDOW_DAYS = 14;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const windowStart = new Date(
    Date.now() - RESULT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const resultRounds: ResultRoundInput[] = [];

  // The last evaluated standard round.
  const standardRound = await context.env.DB.prepare(
    `SELECT id, title, date_from, date_to, evaluated_date, type
      FROM rounds
      WHERE type = 'standard' AND evaluated_date IS NOT NULL
      ORDER BY evaluated_date DESC
      LIMIT 1`
  ).first<ResultRoundInput>();
  if (standardRound) {
    resultRounds.push(standardRound);
  }

  // Bonus rounds evaluated within the last 14 days.
  const bonusRounds = await context.env.DB.prepare(
    `SELECT id, title, date_from, date_to, evaluated_date, type
      FROM rounds
      WHERE type = 'bonus' AND evaluated_date IS NOT NULL AND evaluated_date > ?1
      ORDER BY evaluated_date DESC`
  ).bind(windowStart).all<ResultRoundInput>();
  resultRounds.push(...bonusRounds.results);

  const results = [];
  for (const round of resultRounds) {
    results.push(await buildRoundResult(context.env, round));
  }

  // Global ranking, frozen at the last evaluation (tips spent between rounds
  // don't move anyone). Includes the admin, who plays like any other player.
  // previous_rank gives the movement since the evaluation before that.
  const leaderboard = await context.env.DB.prepare(
    `SELECT nickname, rank, previous_rank, rank_balance
      FROM users
      WHERE rank IS NOT NULL
      ORDER BY rank ASC
      LIMIT 100`
  ).all<{ nickname: string; rank: number; previous_rank: number | null; rank_balance: number | null }>();

  return json({ error: null, results, leaderboard: leaderboard.results });
}
