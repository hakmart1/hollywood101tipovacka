import {
  hashPassword,
  json,
  normalizeEmail,
  normalizeNicknameInput,
  validateEmail,
  validatePassword
} from "../../_lib/auth";
import type { Env, SignupRequestBody } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let payload: SignupRequestBody;
  try {
    payload = (await context.request.json()) as SignupRequestBody;
  } catch {
    return json({ error: "Invalid request body." });
  }

  const email = normalizeEmail(payload.email);
  const nickname = normalizeNicknameInput(payload.nickname);
  const password = payload.password;

  if (!email || !validateEmail(email)) {
    return json({ error: "Enter a valid email address." });
  }

  if (!nickname || nickname.length < 3 || nickname.length > 30) {
    return json({ error: "Nickname must be between 3 and 30 characters." });
  }

  if (!validatePassword(password)) {
    return json({ error: "Password must be at least 8 characters long." });
  }

  const existingUserByEmail = await context.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1"
  ).bind(email).first<{ id: number }>();

  if (existingUserByEmail) {
    return json({ error: "This email is already registered." });
  }

  const existingUserByNickname = await context.env.DB.prepare(
    "SELECT id FROM users WHERE nickname = ?1"
  ).bind(nickname).first<{ id: number }>();

  if (existingUserByNickname) {
    return json({ error: "This nickname is already taken." });
  }

  const passwordHash = await hashPassword(password);

  const createdUser = await context.env.DB.prepare(
    `INSERT INTO users
      (nickname, email, status, role, activated_date, last_login_date, imf_coins_balance)
     VALUES (?1, ?2, 'pending_activation', 'player', NULL, NULL, 0)
     RETURNING id`
  ).bind(nickname, email).first<{ id: number }>();

  if (!createdUser) {
    throw new Error("Failed to create user.");
  }

  await context.env.DB.prepare(
    `INSERT INTO user_auth_identities
      (user_id, provider, provider_user_id, email, password_hash)
     VALUES (?1, 'local', NULL, ?2, ?3)`
  ).bind(createdUser.id, email, passwordHash).run();

  return json(
    {
      error: null,
      message: "Account created in unactive state."
    }
  );
}
