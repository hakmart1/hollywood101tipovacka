import { json } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

const LOW_BALANCE_THRESHOLD = 200_000;
const GRANT_AMOUNT = 500_000;
// Exactly 14 x 24 hours in absolute time.
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "You must be logged in to ask for more Imfcoins." }, 401);
  }

  if (user.status !== "active") {
    return json({ error: "Only activated accounts can ask for a bailout." });
  }

  if (user.imf_coins_balance > LOW_BALANCE_THRESHOLD) {
    return json({ error: "You still have enough Imfcoins." });
  }

  if (user.last_coins_request_date) {
    const elapsedMs = Date.now() - Date.parse(user.last_coins_request_date);
    if (elapsedMs < COOLDOWN_MS) {
      const daysLeft = Math.ceil((COOLDOWN_MS - elapsedMs) / (24 * 60 * 60 * 1000));
      return json({
        error: `You can ask for more Imfcoins only once every 14 days. Try again in ${daysLeft} day(s).`
      });
    }
  }

  const now = new Date().toISOString();

  await context.env.DB.batch([
    context.env.DB.prepare(
      "UPDATE users SET imf_coins_balance = imf_coins_balance + ?1, last_coins_request_date = ?2 WHERE id = ?3"
    ).bind(GRANT_AMOUNT, now, user.id),
    context.env.DB.prepare(
      "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
    ).bind(user.id, GRANT_AMOUNT, "Záchranný balíček IMF", now)
  ]);

  return json({
    error: null,
    message: `The IMF approved your bailout — ${GRANT_AMOUNT.toLocaleString("en-US")} Imfcoins were added to your account.`
  });
}
