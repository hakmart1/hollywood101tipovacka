import { json } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { Env, GuessRecord, MovieRecord, RoundRecord } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  // Every round that hasn't been evaluated yet — already started ones (open or
  // locked-and-waiting) plus upcoming ones (shown as a teaser on the home page).
  const rounds = await context.env.DB.prepare(
    `SELECT id, title, date_from, date_to, description, type, scheduled_evaluation_date
      FROM rounds
      WHERE evaluated_date IS NULL
      ORDER BY date_to ASC, id ASC`
  ).all<RoundRecord & { scheduled_evaluation_date: string | null }>();

  if (rounds.results.length === 0) {
    return json({ error: null, contests: [] });
  }

  const roundIds = rounds.results.map((round) => round.id);
  const placeholders = roundIds.map((_, index) => `?${index + 1}`).join(", ");

  const movies = await context.env.DB.prepare(
    `SELECT id, round_id, movie_title, poster_url, csfd_url, imdb_url, actual_revenue
      FROM movies
      WHERE round_id IN (${placeholders})
      ORDER BY id`
  ).bind(...roundIds).all<MovieRecord>();

  // Attach the logged-in user's existing guesses, if any.
  const guessByMovie = new Map<number, number>();
  const user = await getSessionUser(context.request, context.env);
  if (user) {
    const guesses = await context.env.DB.prepare(
      "SELECT movie_id, guessed_revenue FROM guesses WHERE user_id = ?1"
    ).bind(user.id).all<GuessRecord>();

    for (const guess of guesses.results) {
      guessByMovie.set(guess.movie_id, guess.guessed_revenue);
    }
  }

  const moviesByRound = new Map<number, MovieRecord[]>();
  for (const movie of movies.results) {
    const list = moviesByRound.get(movie.round_id) || [];
    list.push(movie);
    moviesByRound.set(movie.round_id, list);
  }

  return json({
    error: null,
    contests: rounds.results.map((round) => ({
      id: round.id,
      title: round.title,
      date_from: round.date_from,
      date_to: round.date_to,
      description: round.description,
      type: round.type,
      scheduled_evaluation_date: round.scheduled_evaluation_date,
      movies: (moviesByRound.get(round.id) || []).map((movie) => ({
        id: movie.id,
        movie_title: movie.movie_title,
        poster_url: movie.poster_url,
        csfd_url: movie.csfd_url,
        imdb_url: movie.imdb_url,
        my_guess: guessByMovie.has(movie.id) ? guessByMovie.get(movie.id) : null
      }))
    }))
  });
}
