import { buildExpiredCookie, SESSION_COOKIE } from "../../_lib/auth";

export async function onRequestPost(): Promise<Response> {
  return new Response(JSON.stringify({ error: null, message: "Logged out." }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": buildExpiredCookie(SESSION_COOKIE)
    }
  });
}
