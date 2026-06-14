import { json } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { Env, GuessRequestBody, GuessTargetRecord } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

const GUESS_COST = 100_000;

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "You must be logged in to participate." }, 401);
  }

  if (user.status !== "active") {
    return json({ error: "Only activated accounts can participate." });
  }

  let payload: GuessRequestBody;
  try {
    payload = (await context.request.json()) as GuessRequestBody;
  } catch {
    return json({ error: "Invalid request body." });
  }

  const movieId = Number(payload.movie_id);
  if (!Number.isInteger(movieId) || movieId < 1) {
    return json({ error: "Invalid movie." });
  }

  const millions = Number(payload.guessed_millions);
  if (!Number.isFinite(millions) || millions < 0) {
    return json({ error: "Zadejte tip v milionech, např. 10,1." });
  }
  if (millions > 9999.9) {
    return json({ error: "Tip může být nejvýše 9999,9 M." });
  }
  // Guesses are entered in millions with 1 decimal place (0.1M = 100,000).
  const guessedRevenue = Math.round(millions * 10) * 100_000;

  const movie = await context.env.DB.prepare(
    `SELECT
        movies.id,
        movies.movie_title,
        movies.round_id,
        rounds.title AS round_title,
        rounds.date_from,
        rounds.date_to
      FROM movies
      INNER JOIN rounds ON rounds.id = movies.round_id
      WHERE movies.id = ?1`
  ).bind(movieId).first<GuessTargetRecord>();

  if (!movie) {
    return json({ error: "Movie was not found." });
  }

  const now = new Date().toISOString();
  if (now < movie.date_from) {
    return json({ error: "Tipování této tipovačky ještě nezačalo." });
  }
  if (now > movie.date_to) {
    return json({ error: "Tipování této tipovačky už skončilo." });
  }

  const existing = await context.env.DB.prepare(
    "SELECT id FROM guesses WHERE round_id = ?1 AND user_id = ?2 AND movie_id = ?3"
  ).bind(movie.round_id, user.id, movieId).first<{ id: number }>();

  if (existing) {
    return json({ error: "You have already placed a guess for this movie." });
  }

  if (user.imf_coins_balance < GUESS_COST) {
    return json({
      error: `You need ${GUESS_COST.toLocaleString("en-US")} coins to guess, but have ${user.imf_coins_balance.toLocaleString("en-US")}.`
    });
  }

  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        "INSERT INTO guesses (round_id, user_id, movie_id, guessed_revenue) VALUES (?1, ?2, ?3, ?4)"
      ).bind(movie.round_id, user.id, movieId, guessedRevenue),
      context.env.DB.prepare(
        "UPDATE users SET imf_coins_balance = imf_coins_balance - ?1 WHERE id = ?2"
      ).bind(GUESS_COST, user.id),
      context.env.DB.prepare(
        "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
      ).bind(user.id, -GUESS_COST, `Tip: ${movie.round_title} – ${movie.movie_title}`, now)
    ]);
  } catch (error) {
    console.error("Guess insert failed", error);
    return json({ error: "Could not place your guess right now." });
  }

  return json({
    error: null,
    message: `Guess placed for ${movie.movie_title}. ${GUESS_COST.toLocaleString("en-US")} Imfcoins were spent.`
  });
}
