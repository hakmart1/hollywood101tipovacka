import {
  createActivationCode,
  hashActivationCode,
  hashPassword,
  json,
  normalizeEmail,
  normalizeNicknameInput,
  validatePassword
} from "../../_lib/auth.js";

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const email = normalizeEmail(payload.email);
  const nickname = normalizeNicknameInput(payload.nickname);
  const password = payload.password;

  if (!email || !email.includes("@")) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  if (!nickname || nickname.length < 3 || nickname.length > 30) {
    return json({ error: "Nickname must be between 3 and 30 characters." }, 400);
  }

  if (!validatePassword(password)) {
    return json({ error: "Password must be at least 8 characters long." }, 400);
  }

  const existingUserByEmail = await context.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1"
  ).bind(email).first();

  if (existingUserByEmail) {
    return json({ error: "This email is already registered." }, 409);
  }

  const existingUserByNickname = await context.env.DB.prepare(
    "SELECT id FROM users WHERE nickname = ?1"
  ).bind(nickname).first();

  if (existingUserByNickname) {
    return json({ error: "This nickname is already taken." }, 409);
  }

  const userId = crypto.randomUUID();
  const authIdentityId = crypto.randomUUID();
  const activationCodeId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const activationCode = createActivationCode();
  const activationCodeHash = await hashActivationCode(activationCode);

  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO users
        (id, nickname, email, status, role, activated_date, last_login_date, imf_coins_balance)
       VALUES (?1, ?2, ?3, 'pending_activation', 'player', NULL, NULL, 0)`
    ).bind(userId, nickname, email),
    context.env.DB.prepare(
      `INSERT INTO user_auth_identities
        (id, user_id, provider, provider_user_id, email, password_hash)
       VALUES (?1, ?2, 'local', NULL, ?3, ?4)`
    ).bind(authIdentityId, userId, email, passwordHash),
    context.env.DB.prepare(
      `INSERT INTO activation_codes
        (id, user_id, code_hash, consumed_date)
       VALUES (?1, ?2, ?3, NULL)`
    ).bind(activationCodeId, userId, activationCodeHash)
  ]);

  return json({
    ok: true,
    message: "Account created in unactive state.",
    debugActivationCode: context.env.DEBUG_AUTH_CODES === "true" ? activationCode : undefined
  }, 201);
}
