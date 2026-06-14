import { computeRoundScoring } from "./scoring";
import type { Env, RoundType } from "./types";

export interface ResultRoundInput {
  id: number;
  title: string;
  date_from: string;
  date_to: string;
  evaluated_date: string | null;
  type: RoundType;
}

interface ResultMovieRow {
  id: number;
  movie_title: string;
  poster_url: string | null;
  actual_revenue: number;
}

interface ResultGuessRow {
  id: number;
  user_id: number;
  movie_id: number;
  guessed_revenue: number;
}

// Builds the public result view for a round: movies with their box office and
// the player standings, using the same scoring the evaluation paid out with.
export async function buildRoundResult(env: Env, round: ResultRoundInput) {
  const movies = await env.DB.prepare(
    "SELECT id, movie_title, poster_url, actual_revenue FROM movies WHERE round_id = ?1 ORDER BY id"
  ).bind(round.id).all<ResultMovieRow>();

  const guesses = await env.DB.prepare(
    "SELECT id, user_id, movie_id, guessed_revenue FROM guesses WHERE round_id = ?1"
  ).bind(round.id).all<ResultGuessRow>();

  const { standings, movieStandings } = computeRoundScoring(movies.results, guesses.results);

  // Nicknames for everyone who guessed (covers overall + per-movie standings).
  const nameById = new Map<number, string>();
  const guesserIds = [...new Set(guesses.results.map((guess) => guess.user_id))];
  if (guesserIds.length > 0) {
    const placeholders = guesserIds.map((_, index) => `?${index + 1}`).join(", ");
    const users = await env.DB.prepare(
      `SELECT id, nickname FROM users WHERE id IN (${placeholders})`
    ).bind(...guesserIds).all<{ id: number; nickname: string }>();
    for (const user of users.results) {
      nameById.set(user.id, user.nickname);
    }
  }

  return {
    id: round.id,
    title: round.title,
    date_from: round.date_from,
    date_to: round.date_to,
    evaluated_date: round.evaluated_date,
    type: round.type,
    movies: movies.results.map((movie) => ({
      id: movie.id,
      movie_title: movie.movie_title,
      poster_url: movie.poster_url,
      actual_revenue: movie.actual_revenue,
      standings: (movieStandings.get(movie.id) || []).map((entry) => ({
        rank: entry.rank,
        nickname: nameById.get(entry.userId) || "Unknown",
        guess: entry.guessedRevenue,
        accuracy: entry.accuracy,
        placement: entry.placement,
        coins_won: entry.coinsWon
      }))
    })),
    standings: standings.map((standing) => ({
      rank: standing.rank,
      nickname: nameById.get(standing.userId) || "Unknown",
      total_error: standing.totalAbsError,
      contest_bonus: standing.contestBonus,
      coins_won: standing.coinsWon
    }))
  };
}
