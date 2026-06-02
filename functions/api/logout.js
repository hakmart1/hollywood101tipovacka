import { buildExpiredCookie, SESSION_COOKIE } from "../_lib/auth.js";

export async function onRequestPost() {
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": buildExpiredCookie(SESSION_COOKIE)
    }
  });
}
