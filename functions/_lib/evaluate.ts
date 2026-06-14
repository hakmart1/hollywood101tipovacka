import { computeRoundScoring } from "./scoring";
import type { Env } from "./types";

interface EvaluateRoundRecord {
  id: number;
  title: string;
  date_to: string;
  evaluated_date: string | null;
}

interface EvalMovieRecord {
  id: number;
  movie_title: string;
  actual_revenue: number;
}

interface EvalGuessRecord {
  id: number;
  user_id: number;
  movie_id: number;
  guessed_revenue: number;
}

// Whether a round can be evaluated right now. Returns an error message, or null
// if it's good to go. Used both to gate scheduling and as the worker's
// race-condition re-check just before evaluating.
export async function checkRoundEvaluable(env: Env, roundId: number): Promise<string | null> {
  const round = await env.DB.prepare(
    "SELECT id, date_to, evaluated_date FROM rounds WHERE id = ?1"
  ).bind(roundId).first<{ date_to: string; evaluated_date: string | null }>();

  if (!round) {
    return "Round was not found.";
  }
  if (round.evaluated_date) {
    return "This round has already been evaluated.";
  }
  if (new Date().toISOString() <= round.date_to) {
    return "The round has not finished yet.";
  }

  const stats = await env.DB.prepare(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN actual_revenue IS NULL THEN 1 ELSE 0 END) AS missing
      FROM movies
      WHERE round_id = ?1`
  ).bind(roundId).first<{ total: number; missing: number }>();

  if (!stats || stats.total === 0) {
    return "This round has no movies to evaluate.";
  }
  if (stats.missing > 0) {
    return "Fill in the box office result for every movie first.";
  }
  return null;
}

// Evaluate a finished contest: pay out the scoring, freeze the leaderboard
// standings, and mark it evaluated. Re-checks prerequisites first so it's safe
// to call from the cron worker too. Returns a structured result.
export async function evaluateRound(
  env: Env,
  roundId: number
): Promise<{ error: string | null; message?: string }> {
  const problem = await checkRoundEvaluable(env, roundId);
  if (problem) {
    return { error: problem };
  }

  const round = await env.DB.prepare(
    "SELECT id, title, date_to, evaluated_date FROM rounds WHERE id = ?1"
  ).bind(roundId).first<EvaluateRoundRecord>();
  if (!round) {
    return { error: "Round was not found." };
  }

  const now = new Date().toISOString();

  const movies = await env.DB.prepare(
    "SELECT id, movie_title, actual_revenue FROM movies WHERE round_id = ?1"
  ).bind(roundId).all<EvalMovieRecord>();

  const guesses = await env.DB.prepare(
    "SELECT id, user_id, movie_id, guessed_revenue FROM guesses WHERE round_id = ?1"
  ).bind(roundId).all<EvalGuessRecord>();

  const { guessPayout, contestBonusByUser } = computeRoundScoring(movies.results, guesses.results);

  const movieTitleById = new Map(movies.results.map((movie) => [movie.id, movie.movie_title]));
  const userTotals = new Map<number, number>();
  const statements: D1PreparedStatement[] = [];

  for (const guess of guesses.results) {
    const payout = guessPayout.get(guess.id) || 0;
    if (payout <= 0) {
      continue;
    }
    userTotals.set(guess.user_id, (userTotals.get(guess.user_id) || 0) + payout);
    statements.push(
      env.DB.prepare(
        "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
      ).bind(guess.user_id, payout, `Odměna: ${round.title} – ${movieTitleById.get(guess.movie_id)}`, now)
    );
  }

  for (const [userId, bonus] of contestBonusByUser) {
    userTotals.set(userId, (userTotals.get(userId) || 0) + bonus);
    statements.push(
      env.DB.prepare(
        "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
      ).bind(userId, bonus, `Bonus za tipovačku: ${round.title}`, now)
    );
  }

  for (const [userId, total] of userTotals) {
    statements.push(
      env.DB.prepare(
        "UPDATE users SET imf_coins_balance = imf_coins_balance + ?1 WHERE id = ?2"
      ).bind(total, userId)
    );
  }

  // Freeze the leaderboard standings at evaluation: rank players by their
  // balance *after* this round's payouts. previous_rank keeps the prior rank for
  // the movement indicator. Everyone is ranked (including the admin); deleted
  // accounts are excluded.
  const playerRows = await env.DB.prepare(
    "SELECT id, nickname, imf_coins_balance, rank FROM users WHERE status != 'deleted'"
  ).all<{ id: number; nickname: string; imf_coins_balance: number; rank: number | null }>();

  const ranked = playerRows.results
    .map((player) => ({
      id: player.id,
      nickname: player.nickname,
      oldRank: player.rank,
      newBalance: player.imf_coins_balance + (userTotals.get(player.id) || 0)
    }))
    .sort((a, b) => b.newBalance - a.newBalance || a.nickname.localeCompare(b.nickname));

  ranked.forEach((player, index) => {
    statements.push(
      env.DB.prepare(
        "UPDATE users SET previous_rank = ?1, rank = ?2, rank_balance = ?3 WHERE id = ?4"
      ).bind(player.oldRank, index + 1, player.newBalance, player.id)
    );
  });

  statements.push(
    env.DB.prepare(
      "UPDATE rounds SET evaluated_date = ?1, scheduled_evaluation_date = NULL WHERE id = ?2"
    ).bind(now, roundId)
  );

  await env.DB.batch(statements);

  let totalPaid = 0;
  for (const total of userTotals.values()) {
    totalPaid += total;
  }

  return {
    error: null,
    message: `Round evaluated. Paid ${totalPaid.toLocaleString("en-US")} Imfcoins to ${userTotals.size} player(s).`
  };
}
