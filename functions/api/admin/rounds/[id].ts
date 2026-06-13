import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import { computeRoundScoring } from "../../../_lib/scoring";
import type { Env, UpdateRoundRequestBody } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

// Full ISO datetime, e.g. 2026-06-12T18:00:00.000Z (hour precision required).
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function parseRoundId(value: string): number | null {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const roundId = parseRoundId(context.params.id);
  if (roundId === null) {
    return json({ error: "Invalid round id." });
  }

  const round = await context.env.DB.prepare(
    "SELECT id FROM rounds WHERE id = ?1"
  ).bind(roundId).first<{ id: number }>();

  if (!round) {
    return json({ error: "Round was not found." });
  }

  const guesses = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM guesses WHERE round_id = ?1"
  ).bind(roundId).first<{ count: number }>();

  if (guesses && guesses.count > 0) {
    return json({ error: "Cannot delete a round that already has guesses." });
  }

  // No guesses, so only the movies depend on this round; remove them explicitly.
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM movies WHERE round_id = ?1").bind(roundId),
    context.env.DB.prepare("DELETE FROM rounds WHERE id = ?1").bind(roundId)
  ]);

  return json({ error: null, message: "Round removed." });
}

// Edit the contest's start/end date-times (correcting a mistaken entry).
export async function onRequestPatch(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const roundId = parseRoundId(context.params.id);
  if (roundId === null) {
    return json({ error: "Invalid round id." });
  }

  let payload: UpdateRoundRequestBody;
  try {
    payload = (await context.request.json()) as UpdateRoundRequestBody;
  } catch {
    return json({ error: "Invalid request body." });
  }

  const dateFrom = String(payload.date_from || "").trim();
  const dateTo = String(payload.date_to || "").trim();

  if (!DATETIME_REGEX.test(dateFrom) || !DATETIME_REGEX.test(dateTo)) {
    return json({ error: "Start and end date-times are required." });
  }

  if (dateFrom > dateTo) {
    return json({ error: "The start must not be after the end." });
  }

  const result = await context.env.DB.prepare(
    "UPDATE rounds SET date_from = ?1, date_to = ?2 WHERE id = ?3"
  ).bind(dateFrom, dateTo, roundId).run();

  if (result.meta.changes === 0) {
    return json({ error: "Round was not found." });
  }

  return json({ error: null, message: "Round dates updated." });
}

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

// Evaluate a finished contest. Allowed only once the end date has passed and
// every movie has a box office result. Reward/scoring logic will be added here.
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const roundId = parseRoundId(context.params.id);
  if (roundId === null) {
    return json({ error: "Invalid round id." });
  }

  const round = await context.env.DB.prepare(
    "SELECT id, title, date_to, evaluated_date FROM rounds WHERE id = ?1"
  ).bind(roundId).first<EvaluateRoundRecord>();

  if (!round) {
    return json({ error: "Round was not found." });
  }

  if (round.evaluated_date) {
    return json({ error: "This round has already been evaluated." });
  }

  const now = new Date().toISOString();
  if (now <= round.date_to) {
    return json({ error: "The round has not finished yet." });
  }

  const movieStats = await context.env.DB.prepare(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN actual_revenue IS NULL THEN 1 ELSE 0 END) AS missing
      FROM movies
      WHERE round_id = ?1`
  ).bind(roundId).first<{ total: number; missing: number }>();

  if (!movieStats || movieStats.total === 0) {
    return json({ error: "This round has no movies to evaluate." });
  }

  if (movieStats.missing > 0) {
    return json({ error: "Fill in the box office result for every movie first." });
  }

  const movies = await context.env.DB.prepare(
    "SELECT id, movie_title, actual_revenue FROM movies WHERE round_id = ?1"
  ).bind(roundId).all<EvalMovieRecord>();

  const guesses = await context.env.DB.prepare(
    "SELECT id, user_id, movie_id, guessed_revenue FROM guesses WHERE round_id = ?1"
  ).bind(roundId).all<EvalGuessRecord>();

  const { guessPayout, contestBonusByUser } = computeRoundScoring(
    movies.results,
    guesses.results
  );

  const movieTitleById = new Map(movies.results.map((movie) => [movie.id, movie.movie_title]));
  const userTotals = new Map<number, number>();
  const statements: ReturnType<typeof context.env.DB.prepare>[] = [];

  for (const guess of guesses.results) {
    const payout = guessPayout.get(guess.id) || 0;
    if (payout <= 0) {
      continue;
    }
    userTotals.set(guess.user_id, (userTotals.get(guess.user_id) || 0) + payout);
    statements.push(
      context.env.DB.prepare(
        "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
      ).bind(guess.user_id, payout, `Odměna: ${round.title} – ${movieTitleById.get(guess.movie_id)}`, now)
    );
  }

  for (const [userId, bonus] of contestBonusByUser) {
    userTotals.set(userId, (userTotals.get(userId) || 0) + bonus);
    statements.push(
      context.env.DB.prepare(
        "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
      ).bind(userId, bonus, `Bonus za tipovačku: ${round.title}`, now)
    );
  }

  for (const [userId, total] of userTotals) {
    statements.push(
      context.env.DB.prepare(
        "UPDATE users SET imf_coins_balance = imf_coins_balance + ?1 WHERE id = ?2"
      ).bind(total, userId)
    );
  }

  // Freeze the leaderboard standings at evaluation: rank players by their
  // balance *after* this round's payouts. Spending on tips between rounds does
  // not move anyone — only an evaluation updates the standings. previous_rank
  // keeps the rank from the prior evaluation, for the movement indicator.
  // Everyone is ranked, including the admin — he plays like any other player
  // (we rely on his honesty), on top of running the rounds.
  const playerRows = await context.env.DB.prepare(
    "SELECT id, nickname, imf_coins_balance, rank FROM users"
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
      context.env.DB.prepare(
        "UPDATE users SET previous_rank = ?1, rank = ?2, rank_balance = ?3 WHERE id = ?4"
      ).bind(player.oldRank, index + 1, player.newBalance, player.id)
    );
  });

  statements.push(
    context.env.DB.prepare("UPDATE rounds SET evaluated_date = ?1 WHERE id = ?2").bind(now, roundId)
  );

  await context.env.DB.batch(statements);

  let totalPaid = 0;
  for (const total of userTotals.values()) {
    totalPaid += total;
  }

  return json({
    error: null,
    message: `Round evaluated. Paid ${totalPaid.toLocaleString("en-US")} coins to ${userTotals.size} player(s).`
  });
}
