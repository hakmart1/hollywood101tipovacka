import {
  hashPassword,
  json,
  normalizeEmail,
  normalizeNicknameInput,
  validateEmail,
  validatePassword
} from "../../_lib/auth";
import { gravatarHash } from "../../_lib/gravatar";
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
    return json({ error: "Neplatný požadavek." });
  }

  const email = normalizeEmail(payload.email);
  const nickname = normalizeNicknameInput(payload.nickname);
  const password = payload.password;

  if (!email || !validateEmail(email)) {
    return json({ error: "Zadejte platný e-mail." });
  }

  if (!nickname || nickname.length < 3 || nickname.length > 30) {
    return json({ error: "Přezdívka musí mít 3 až 30 znaků." });
  }

  if (!validatePassword(password)) {
    return json({ error: "Heslo musí mít alespoň 8 znaků." });
  }

  const existingUserByEmail = await context.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1"
  ).bind(email).first<{ id: number }>();

  if (existingUserByEmail) {
    return json({ error: "Tento e-mail už je registrovaný." });
  }

  const existingUserByNickname = await context.env.DB.prepare(
    "SELECT id FROM users WHERE nickname = ?1"
  ).bind(nickname).first<{ id: number }>();

  if (existingUserByNickname) {
    return json({ error: "Tato přezdívka je už obsazená." });
  }

  try {
    const passwordHash = await hashPassword(password);
    const avatarHash = await gravatarHash(email);

    const insertUserResult = await context.env.DB.prepare(
      `INSERT INTO users
        (nickname, email, status, role, activated_date, last_login_date, imf_coins_balance, avatar_hash)
       VALUES (?1, ?2, 'pending_activation', 'player', NULL, NULL, 0, ?3)`
    ).bind(nickname, email, avatarHash).run();

    const insertedUserId =
      typeof insertUserResult.meta.last_row_id === "number"
        ? insertUserResult.meta.last_row_id
        : (await context.env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(email).first<{ id: number }>())
            ?.id;

    if (!insertedUserId) {
      console.error("Signup insert succeeded but no user id was returned", { email });
      return json({ error: "Účet se teď nepodařilo vytvořit." });
    }

    await context.env.DB.prepare(
      `INSERT INTO user_auth_identities
        (user_id, provider, provider_user_id, email, password_hash)
       VALUES (?1, 'local', NULL, ?2, ?3)`
    ).bind(insertedUserId, email, passwordHash).run();
  } catch (error) {
    console.error("Signup failed", error);
    return json({ error: "Účet se teď nepodařilo vytvořit." });
  }

  return json(
    {
      error: null,
      message: "Účet byl vytvořen. Nyní ho aktivuj."
    }
  );
}
