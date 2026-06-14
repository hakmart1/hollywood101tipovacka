import type {
  Env,
  SessionPayload
} from "./types";

export const SESSION_COOKIE = "tipovacka_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Cloudflare Workers WebCrypto rejects PBKDF2 iteration counts above 100,000.
const PBKDF2_ITERATIONS = 100000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertSessionConfig(env: Env): void {
  if (!env.SESSION_SECRET) {
    throw new Error("Missing required secret: SESSION_SECRET");
  }
}

export function readCookie(request: Request, name: string): string | null {
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

export function buildCookie(
  name: string,
  value: string,
  options: { httpOnly?: boolean; maxAge?: number } = {}
): string {
  const segments = [`${name}=${value}`, "Path=/", "SameSite=Lax", "Secure"];

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.maxAge) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  return segments.join("; ");
}

export function buildExpiredCookie(name: string): string {
  return `${name}=; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=0`;
}

export function json<T>(payload: T, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function redirectWithMessage(
  request: Request,
  path: string,
  message: string,
  cookies: string[] = []
): Response {
  const url = new URL(path, request.url);
  url.searchParams.set("auth", message);
  const response = Response.redirect(url.toString(), 302);
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await createHmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySession(
  token: string | null,
  secret: string | undefined
): Promise<SessionPayload | null> {
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

  let payload: SessionPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

// Stateless password-reset token: HMAC over userId+expiry+current password hash.
// No DB table needed, and it self-invalidates once the password changes (the
// hash in the signature no longer matches) or the expiry passes.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function createPasswordResetToken(
  userId: number,
  passwordHash: string,
  secret: string
): Promise<string> {
  const exp = Date.now() + PASSWORD_RESET_TTL_MS;
  const payload = `${userId}.${exp}`;
  const signature = await createHmac(`${payload}.${passwordHash}`, secret);
  return `${payload}.${signature}`;
}

// Verifies the token against the user's current password hash. Returns the user
// id if valid and unexpired, otherwise null.
export async function verifyPasswordResetToken(
  token: string,
  passwordHash: string,
  secret: string | undefined
): Promise<number | null> {
  if (!secret) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [userIdStr, expStr, signature] = parts;
  const userId = Number.parseInt(userIdStr, 10);
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isInteger(userId) || !Number.isInteger(exp) || Date.now() > exp) {
    return null;
  }
  const expected = await createHmac(`${userIdStr}.${expStr}.${passwordHash}`, secret);
  return timingSafeEqual(signature, expected) ? userId : null;
}

// Just the user id from a (possibly invalid) token — used to look up the hash
// before the signature is verified. Returns null if the shape is wrong.
export function readPasswordResetUserId(token: string): number | null {
  const userId = Number.parseInt(token.split(".")[0] || "", 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function normalizeNicknameInput(nickname: unknown): string {
  return String(nickname || "").trim();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordBytes(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${hexEncode(salt)}$${hexEncode(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
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

export function validatePassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

async function derivePasswordBytes(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
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
      salt: salt.slice(),
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

async function createHmac(value: string, secret: string): Promise<string> {
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

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function base64UrlEncode(input: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(input));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}
