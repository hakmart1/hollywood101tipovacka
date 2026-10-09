import { requireAdmin } from "../../../_lib/admin";
import { seasonAchievementStatements } from "../../../_lib/achievements";
import { json } from "../../../_lib/auth";
import type { Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

// Every activated player starts a new season with the same budget as a newly
// activated account (see ACTIVATION_BONUS in auth/activate.ts).
const SEASON_START_BALANCE = 2_000_000;

// End the current season and start a new one, atomically: snapshot the
// leaderboard, close the season, open the next one, reset balances (with a
// ledger entry so imf_coin_history keeps summing to the balance) and clear the
// frozen ranks — the new season's leaderboard appears after its first evaluation.
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  let payload: { name?: unknown };
  try {
    payload = (await context.request.json()) as { name?: unknown };
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const name = String(payload.name || "").trim();
  if (!name || name.length > 60) {
    return json({ error: "Zadejte název nové sezóny (max. 60 znaků)." });
  }

  const current = await context.env.DB.prepare(
    "SELECT id, name FROM seasons WHERE ended_date IS NULL ORDER BY id DESC LIMIT 1"
  ).first<{ id: number; name: string }>();
  if (!current) {
    return json({ error: "Žádná sezóna právě neběží." });
  }

  const now = new Date().toISOString();

  // A started contest must be evaluated first, so the snapshot is complete and
  // no payouts land in the wrong season. Future (not yet started) contests are
  // fine — they'll simply be played in the new season.
  const open = await context.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM rounds WHERE evaluated_date IS NULL AND date_from <= ?1"
  ).bind(now).first<{ n: number }>();
  if (open && open.n > 0) {
    return json({
      error: `Sezónu nelze ukončit: ${open.n === 1 ? "1 tipovačka ještě není vyhodnocená" : `${open.n} tipovačky ještě nejsou vyhodnocené`}.`
    });
  }

  const ranked = await context.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE rank IS NOT NULL AND status != 'deleted'"
  ).first<{ n: number }>();

  // Podium achievements, from the final standings (before ranks are reset).
  const seasonAwards = await seasonAchievementStatements(context.env, current, now);

  const reason = `Nová sezóna „${name}": start s 2 000 000 Imfcoiny`;

  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO season_standings (season_id, user_id, rank, nickname, balance)
       SELECT ?1, id, rank, nickname, COALESCE(rank_balance, imf_coins_balance)
         FROM users
        WHERE rank IS NOT NULL AND status != 'deleted'`
    ).bind(current.id),
    ...seasonAwards,
    context.env.DB.prepare(
      "UPDATE seasons SET ended_date = ?1 WHERE id = ?2 AND ended_date IS NULL"
    ).bind(now, current.id),
    context.env.DB.prepare(
      "INSERT INTO seasons (name, started_date) VALUES (?1, ?2)"
    ).bind(name, now),
    context.env.DB.prepare(
      `INSERT INTO imf_coin_history (user_id, amount, reason, created_date)
       SELECT id, ?1 - imf_coins_balance, ?2, ?3
         FROM users
        WHERE activated_date IS NOT NULL AND status != 'deleted' AND imf_coins_balance != ?1`
    ).bind(SEASON_START_BALANCE, reason, now),
    context.env.DB.prepare(
      "UPDATE users SET imf_coins_balance = ?1 WHERE activated_date IS NOT NULL AND status != 'deleted'"
    ).bind(SEASON_START_BALANCE),
    context.env.DB.prepare(
      "UPDATE users SET rank = NULL, previous_rank = NULL, rank_balance = NULL"
    )
  ]);

  return json({
    error: null,
    message: `Sezóna „${current.name}" ukončena (${ranked?.n ?? 0} hráčů v pořadí). Začala sezóna „${name}".`
  });
}
