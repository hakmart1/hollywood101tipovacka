import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

// Rename a season.
export async function onRequestPatch(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const seasonId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(seasonId) || seasonId < 1) {
    return json({ error: "Neplatné ID sezóny." });
  }

  let payload: { name?: unknown };
  try {
    payload = (await context.request.json()) as { name?: unknown };
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const name = String(payload.name || "").trim();
  if (!name || name.length > 60) {
    return json({ error: "Zadejte název sezóny (max. 60 znaků)." });
  }

  const result = await context.env.DB.prepare(
    "UPDATE seasons SET name = ?1 WHERE id = ?2"
  ).bind(name, seasonId).run();

  if (result.meta.changes === 0) {
    return json({ error: "Sezóna nebyla nalezena." });
  }
  return json({ error: null, message: "Název sezóny uložen." });
}
