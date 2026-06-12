import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type {
  CreateRoundMovieInput,
  CreateRoundRequestBody,
  Env,
  MovieRecord,
  RoundRecord
} from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

// Full ISO datetime, e.g. 2026-06-12T18:00:00.000Z (hour precision required).
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function normalizeUrl(value: unknown): string | null {
  const url = String(value || "").trim();
  if (!url) {
    return null;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }
  return url;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const rounds = await context.env.DB.prepare(
    "SELECT id, season_key, title, date_from, date_to, description FROM rounds ORDER BY date_from DESC, id DESC"
  ).all<RoundRecord>();

  const movies = await context.env.DB.prepare(
    "SELECT id, round_id, movie_title, poster_url, csfd_url, imdb_url, actual_revenue FROM movies ORDER BY id"
  ).all<MovieRecord>();

  const moviesByRound = new Map<number, MovieRecord[]>();
  for (const movie of movies.results) {
    const list = moviesByRound.get(movie.round_id) || [];
    list.push(movie);
    moviesByRound.set(movie.round_id, list);
  }

  return json({
    error: null,
    rounds: rounds.results.map((round) => ({
      ...round,
      movies: moviesByRound.get(round.id) || []
    }))
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  let payload: CreateRoundRequestBody;
  try {
    payload = (await context.request.json()) as CreateRoundRequestBody;
  } catch {
    return json({ error: "Invalid request body." });
  }

  const title = String(payload.title || "").trim();
  const dateFrom = String(payload.date_from || "").trim();
  const dateTo = String(payload.date_to || "").trim();
  const description = String(payload.description || "").trim() || null;
  const seasonKey = String(payload.season_key || "").trim() || slugify(title);

  if (!title) {
    return json({ error: "Contest title is required." });
  }

  if (!DATETIME_REGEX.test(dateFrom) || !DATETIME_REGEX.test(dateTo)) {
    return json({ error: "Start and end date-times are required." });
  }

  if (dateFrom > dateTo) {
    return json({ error: "The start must not be after the end." });
  }

  if (!seasonKey) {
    return json({ error: "Season key could not be derived from the title. Enter it manually." });
  }

  const movieInputs: CreateRoundMovieInput[] = Array.isArray(payload.movies) ? payload.movies : [];
  const movies = movieInputs
    .map((movie) => ({
      movie_title: String(movie.movie_title || "").trim(),
      poster_url: normalizeUrl(movie.poster_url),
      csfd_url: normalizeUrl(movie.csfd_url),
      imdb_url: normalizeUrl(movie.imdb_url)
    }))
    .filter((movie) => movie.movie_title.length > 0);

  if (movies.length === 0) {
    return json({ error: "Add at least one movie with a title." });
  }

  try {
    const roundInsert = await context.env.DB.prepare(
      "INSERT INTO rounds (season_key, title, date_from, date_to, description) VALUES (?1, ?2, ?3, ?4, ?5)"
    ).bind(seasonKey, title, dateFrom, dateTo, description).run();

    const roundId = roundInsert.meta.last_row_id;

    await context.env.DB.batch(
      movies.map((movie) =>
        context.env.DB.prepare(
          "INSERT INTO movies (round_id, movie_title, poster_url, csfd_url, imdb_url, actual_revenue) VALUES (?1, ?2, ?3, ?4, ?5, NULL)"
        ).bind(roundId, movie.movie_title, movie.poster_url, movie.csfd_url, movie.imdb_url)
      )
    );

    return json({
      error: null,
      message: `Contest "${title}" created with ${movies.length} movie(s).`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE")) {
      return json({ error: `Season key "${seasonKey}" already exists. Choose a different one.` });
    }
    console.error("Round creation failed", error);
    return json({ error: "Could not create the contest right now." });
  }
}
