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
}

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const movieId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(movieId) || movieId < 1) {
    return json({ error: "Invalid movie id." });
  }

  let payload: UpdateMovieRequestBody;
  try {
    payload = (await context.request.json()) as UpdateMovieRequestBody;
  } catch {
    return json({ error: "Invalid request body." });
  }

  const revenue = payload.actual_revenue;
  if (revenue !== null && (!Number.isInteger(revenue) || (revenue as number) < 0)) {
    return json({ error: "Box office result must be a non-negative whole number, or empty to clear it." });
  }

  const result = await context.env.DB.prepare(
    "UPDATE movies SET actual_revenue = ?1 WHERE id = ?2"
  ).bind(revenue, movieId).run();

  if (result.meta.changes === 0) {
    return json({ error: "Movie was not found." });
  }

  return json({
    error: null,
    message: revenue === null ? "Box office result cleared." : "Box office result saved."
  });
}
