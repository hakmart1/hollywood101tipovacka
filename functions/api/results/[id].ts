import { json } from "../../_lib/auth";
import { buildRoundResult } from "../../_lib/results";
import type { ResultRoundInput } from "../../_lib/results";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

// Full result (movies + standings) for one evaluated round.
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const roundId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(roundId) || roundId < 1) {
    return json({ error: "Neplatné ID tipovačky." });
  }

  const round = await context.env.DB.prepare(
    "SELECT id, title, date_from, date_to, evaluated_date, type, description FROM rounds WHERE id = ?1"
  ).bind(roundId).first<ResultRoundInput>();

  if (!round || !round.evaluated_date) {
    return json({ error: "Výsledek tipovačky není k dispozici." }, 404);
  }

  const result = await buildRoundResult(context.env, round);
  return json({ error: null, result });
}
