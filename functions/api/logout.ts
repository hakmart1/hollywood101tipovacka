import { buildExpiredCookie, SESSION_COOKIE } from "../_lib/auth";

export async function onRequestPost(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": buildExpiredCookie(SESSION_COOKIE)
    }
  });
}
