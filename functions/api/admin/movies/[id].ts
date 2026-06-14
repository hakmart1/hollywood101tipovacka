import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

interface UpdateMovieRequestBody {
  actual_revenue?: number | null;
  movie_title?: string;
  poster_url?: string | null;
  csfd_url?: string | null;
  imdb_url?: string | null;
}

function normalizeUrl(value: unknown): string | null {
  const url = String(value || "").trim();
  if (!url) {
    return null;
  }
  if (url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Don't force the user to type a scheme — assume https.
  return `https://${url}`;
}

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const movieId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(movieId) || movieId < 1) {
    return json({ error: "Neplatné ID filmu." });
  }

  let payload: UpdateMovieRequestBody;
  try {
    payload = (await context.request.json()) as UpdateMovieRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  // Partial update: only the columns present in the body are touched.
  const sets: string[] = [];
  const binds: (string | number | null)[] = [];

  if ("movie_title" in payload) {
    const title = String(payload.movie_title || "").trim();
    if (!title) {
      return json({ error: "Název filmu je povinný." });
    }
    sets.push(`movie_title = ?${sets.length + 1}`);
    binds.push(title);
  }

  if ("poster_url" in payload) {
    sets.push(`poster_url = ?${sets.length + 1}`);
    binds.push(normalizeUrl(payload.poster_url));
  }

  if ("csfd_url" in payload) {
    sets.push(`csfd_url = ?${sets.length + 1}`);
    binds.push(normalizeUrl(payload.csfd_url));
  }

  if ("imdb_url" in payload) {
    sets.push(`imdb_url = ?${sets.length + 1}`);
    binds.push(normalizeUrl(payload.imdb_url));
  }

  if ("actual_revenue" in payload) {
    const revenue = payload.actual_revenue;
    if (revenue !== null && (!Number.isInteger(revenue) || (revenue as number) < 0)) {
      return json({ error: "Tržby musí být nezáporné celé číslo (nebo prázdné pro vymazání)." });
    }
    if (revenue !== null && (revenue as number) > 9_999_900_000) {
      return json({ error: "Tržby mohou být nejvýše 9999,9 M." });
    }
    sets.push(`actual_revenue = ?${sets.length + 1}`);
    binds.push(revenue ?? null);
  }

  if (sets.length === 0) {
    return json({ error: "Není co uložit." });
  }

  binds.push(movieId);
  const result = await context.env.DB.prepare(
    `UPDATE movies SET ${sets.join(", ")} WHERE id = ?${binds.length}`
  ).bind(...binds).run();

  if (result.meta.changes === 0) {
    return json({ error: "Film nebyl nalezen." });
  }

  // Removing a box office result makes the round no longer evaluable, so cancel
  // any pending scheduled evaluation on its round.
  if ("actual_revenue" in payload && payload.actual_revenue === null) {
    await context.env.DB.prepare(
      `UPDATE rounds SET scheduled_evaluation_date = NULL
        WHERE id = (SELECT round_id FROM movies WHERE id = ?1)`
    ).bind(movieId).run();
  }

  return json({ error: null, message: "Film uložen." });
}
