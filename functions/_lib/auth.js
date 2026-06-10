export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const OAUTH_STATE_COOKIE = "tipovacka_oauth_state";
export const SESSION_COOKIE = "tipovacka_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const PBKDF2_ITERATIONS = 120000;

export function assertAuthConfig(env) {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "SESSION_SECRET"
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required secret: ${key}`);
    }
  }
}

export function assertSessionConfig(env) {
  if (!env.SESSION_SECRET) {
    throw new Error("Missing required secret: SESSION_SECRET");
  }
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}

export function buildCookie(name, value, options = {}) {
  const segments = [`${name}=${value}`, "Path=/", "SameSite=Lax", "Secure"];

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.maxAge) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  return segments.join("; ");
}

export function buildExpiredCookie(name) {
  return `${name}=; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=0`;
}

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function redirectWithMessage(request, path, message, cookies = []) {
  const url = new URL(path, request.url);
  url.searchParams.set("auth", message);
  const response = Response.redirect(url.toString(), 302);
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export async function signSession(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await createHmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySession(token, secret) {
  if (!token || !secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = await createHmac(encodedPayload, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeNicknameInput(nickname) {
  return String(nickname || "").trim();
}

export function createActivationCode() {
  const randomNumber = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(randomNumber).padStart(6, "0");
}

export async function hashActivationCode(code) {
  const bytes = new TextEncoder().encode(String(code));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return hexEncode(new Uint8Array(digest));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordBytes(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${hexEncode(salt)}$${hexEncode(derived)}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = hexDecode(parts[2]);
  const expected = parts[3];
  const actual = hexEncode(await derivePasswordBytes(password, salt, iterations));
  return timingSafeEqual(actual, expected);
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export async function findOrCreateGoogleUser(env, googleProfile) {
  const now = new Date().toISOString();

  const existingIdentity = await env.DB.prepare(
    `SELECT
        users.id,
        users.nickname,
        users.email,
        users.role,
        users.status
      FROM user_auth_identities
      INNER JOIN users ON users.id = user_auth_identities.user_id
      WHERE user_auth_identities.provider = ?1
        AND user_auth_identities.provider_user_id = ?2`
  )
    .bind("google", googleProfile.sub)
    .first();

  if (existingIdentity) {
    await env.DB.prepare("UPDATE users SET last_login_date = ?1 WHERE id = ?2")
      .bind(now, existingIdentity.id)
      .run();

    return existingIdentity;
  }

  const existingUserByEmail = await env.DB.prepare(
    "SELECT id, nickname, email, role, status FROM users WHERE email = ?1"
  )
    .bind(googleProfile.email)
    .first();

  if (existingUserByEmail) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO user_auth_identities
          (id, user_id, provider, provider_user_id, email, password_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL)`
      ).bind(
        crypto.randomUUID(),
        existingUserByEmail.id,
        "google",
        googleProfile.sub,
        googleProfile.email
      ),
      env.DB.prepare("UPDATE users SET last_login_date = ?1 WHERE id = ?2")
        .bind(now, existingUserByEmail.id)
    ]);

    return existingUserByEmail;
  }

  const userId = crypto.randomUUID();
  const nickname = await createUniqueNickname(env, googleProfile);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users
        (id, nickname, email, status, role, activated_date, last_login_date, imf_coins_balance)
       VALUES (?1, ?2, ?3, 'active', 'player', ?4, ?4, 0)`
    ).bind(userId, nickname, googleProfile.email, now),
    env.DB.prepare(
      `INSERT INTO user_auth_identities
        (id, user_id, provider, provider_user_id, email, password_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL)`
    ).bind(
      crypto.randomUUID(),
      userId,
      "google",
      googleProfile.sub,
      googleProfile.email
    )
  ]);

  return {
    id: userId,
    nickname,
    email: googleProfile.email,
    role: "player",
    status: "active"
  };
}

async function createUniqueNickname(env, googleProfile) {
  const rawSource = googleProfile.given_name || googleProfile.name || googleProfile.email.split("@")[0];
  const base = normalizeNickname(rawSource);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const existing = await env.DB.prepare("SELECT id FROM users WHERE nickname = ?1")
      .bind(candidate)
      .first();

    if (!existing) {
      return candidate;
    }
  }

  return `player${Math.floor(Math.random() * 1000000)}`;
}

function normalizeNickname(input) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .slice(0, 20) || "player";
}

async function derivePasswordBytes(password, salt, iterations) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

async function createHmac(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function base64UrlEncode(input) {
  return base64UrlEncodeBytes(new TextEncoder().encode(input));
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hexEncode(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexDecode(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
