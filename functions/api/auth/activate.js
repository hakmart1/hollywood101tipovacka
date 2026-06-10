import {
  hashActivationCode,
  json,
  normalizeEmail
} from "../../_lib/auth.js";

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const email = normalizeEmail(payload.email);
  const code = String(payload.code || "").trim();

  if (!email || !code) {
    return json({ error: "Email and activation code are required." }, 400);
  }

  const codeHash = await hashActivationCode(code);
  const userWithCode = await context.env.DB.prepare(
    `SELECT
        users.id,
        users.status,
        activation_codes.id AS activation_code_id,
        activation_codes.consumed_date
      FROM users
      INNER JOIN activation_codes ON activation_codes.user_id = users.id
      WHERE users.email = ?1
        AND activation_codes.code_hash = ?2`
  ).bind(email, codeHash).first();

  if (!userWithCode) {
    return json({ error: "Activation code is invalid." }, 404);
  }

  if (userWithCode.consumed_date) {
    return json({ error: "This activation code has already been used." }, 409);
  }

  if (userWithCode.status === "active") {
    return json({ ok: true, message: "Account is already active." });
  }

  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      "UPDATE users SET status = 'active', activated_date = ?1 WHERE id = ?2"
    ).bind(now, userWithCode.id),
    context.env.DB.prepare(
      "UPDATE activation_codes SET consumed_date = ?1 WHERE id = ?2"
    ).bind(now, userWithCode.activation_code_id)
  ]);

  return json({
    ok: true,
    message: "Account activated. You can log in now."
  });
}
