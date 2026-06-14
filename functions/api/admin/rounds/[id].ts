import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import { checkRoundEvaluable, evaluateRound } from "../../../_lib/evaluate";
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

  const title = String(payload.title || "").trim();
  const dateFrom = String(payload.date_from || "").trim();
  const dateTo = String(payload.date_to || "").trim();

  if (!title) {
    return json({ error: "Název tipovačky je povinný." });
  }

  if (!DATETIME_REGEX.test(dateFrom) || !DATETIME_REGEX.test(dateTo)) {
    return json({ error: "Start and end date-times are required." });
  }

  if (dateFrom > dateTo) {
    return json({ error: "The start must not be after the end." });
  }

  const result = await context.env.DB.prepare(
    "UPDATE rounds SET title = ?1, date_from = ?2, date_to = ?3 WHERE id = ?4"
  ).bind(title, dateFrom, dateTo, roundId).run();

  if (result.meta.changes === 0) {
    return json({ error: "Round was not found." });
  }

  return json({ error: null, message: "Round dates updated." });
}

interface EvaluateRequestBody {
  // present (string) = schedule for that time; null = cancel schedule;
  // absent = evaluate now.
  scheduled_evaluation_date?: string | null;
}

// POST does one of three things based on the body:
//   { scheduled_evaluation_date: "<iso>" } → schedule auto-evaluation
//   { scheduled_evaluation_date: null }     → cancel a schedule
//   (no body)                               → evaluate now
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const roundId = parseRoundId(context.params.id);
  if (roundId === null) {
    return json({ error: "Invalid round id." });
  }

  let body: EvaluateRequestBody = {};
  try {
    body = (await context.request.json()) as EvaluateRequestBody;
  } catch {
    // No body → evaluate now.
  }

  // Cancel a scheduled evaluation.
  if (body.scheduled_evaluation_date === null) {
    await context.env.DB.prepare(
      "UPDATE rounds SET scheduled_evaluation_date = NULL WHERE id = ?1"
    ).bind(roundId).run();
    return json({ error: null, message: "Naplánované vyhodnocení zrušeno." });
  }

  // Schedule an evaluation — only allowed when the round could be evaluated now
  // (finished, all box office results filled). The worker re-checks at the time.
  if (typeof body.scheduled_evaluation_date === "string") {
    const when = body.scheduled_evaluation_date.trim();
    if (!DATETIME_REGEX.test(when)) {
      return json({ error: "Neplatný čas vyhodnocení." });
    }
    const problem = await checkRoundEvaluable(context.env, roundId);
    if (problem) {
      return json({ error: problem });
    }
    await context.env.DB.prepare(
      "UPDATE rounds SET scheduled_evaluation_date = ?1 WHERE id = ?2"
    ).bind(when, roundId).run();
    return json({ error: null, message: "Vyhodnocení naplánováno." });
  }

  // Evaluate now.
  const result = await evaluateRound(context.env, roundId);
  return json(result);
}
