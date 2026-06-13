import {
  json,
  normalizeEmail,
  validateEmail
} from "../../_lib/auth";
import type {
  ActivateRequestBody,
  ActivationLookupRecord,
  ActivationUserRecord,
  Env
} from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let payload: ActivateRequestBody;
  try {
    payload = (await context.request.json()) as ActivateRequestBody;
  } catch {
    return json({ error: "Invalid request body." });
  }

  const email = normalizeEmail(payload.email);
  const code = String(payload.code || "").trim();

  if (!email || !code) {
    return json({ error: "Email and activation code are required." });
  }

  if (!validateEmail(email)) {
    return json({ error: "Enter a valid email address." });
  }

  const user = await context.env.DB.prepare(
    `SELECT
        id,
        status,
        activated_date
      FROM users
      WHERE email = ?1`
  ).bind(email).first<ActivationUserRecord>();

  if (!user) {
    return json({ error: "Account was not found." });
  }

  const activationCode = await context.env.DB.prepare(
    `SELECT
        id AS activation_code_id,
        user_id,
        consumed_date
      FROM activation_codes
      WHERE code = ?1`
  ).bind(code).first<ActivationLookupRecord>();

  if (!activationCode) {
    return json({ error: "Activation code is invalid." });
  }

  if (activationCode.consumed_date) {
    return json({ error: "This activation code has already been used." });
  }

  if (activationCode.user_id && activationCode.user_id !== user.id) {
    return json({ error: "This activation code is assigned to another account." });
  }

  if (user.status === "active") {
    return json({ error: null, message: "Account is already active." });
  }

  const ACTIVATION_BONUS = 2_000_000;
  // The signing bonus is paid only on the first activation, so users
  // re-activated after a code removal do not collect it again.
  const firstActivation = user.activated_date === null;

  const now = new Date().toISOString();
  const statements = [
    context.env.DB.prepare(
      "UPDATE users SET status = 'active', activated_date = ?1 WHERE id = ?2"
    ).bind(now, user.id),
    context.env.DB.prepare(
      "UPDATE activation_codes SET user_id = ?1, consumed_date = ?2 WHERE id = ?3"
    ).bind(user.id, now, activationCode.activation_code_id)
  ];

  if (firstActivation) {
    statements.push(
      context.env.DB.prepare(
        "UPDATE users SET imf_coins_balance = imf_coins_balance + ?1 WHERE id = ?2"
      ).bind(ACTIVATION_BONUS, user.id),
      context.env.DB.prepare(
        "INSERT INTO imf_coin_history (user_id, amount, reason, created_date) VALUES (?1, ?2, ?3, ?4)"
      ).bind(user.id, ACTIVATION_BONUS, "Vstupní bonus IMF", now)
    );
  }

  await context.env.DB.batch(statements);

  return json({
    error: null,
    message: firstActivation
      ? `Account activated. Welcome to the IMF — a signing bonus of ${ACTIVATION_BONUS.toLocaleString("en-US")} coins is yours.`
      : "Account activated."
  });
}
