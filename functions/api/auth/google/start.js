import {
  assertAuthConfig,
  buildCookie,
  GOOGLE_AUTH_URL,
  OAUTH_STATE_COOKIE
} from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  assertAuthConfig(context.env);

  const state = crypto.randomUUID();
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", context.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", context.env.GOOGLE_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = Response.redirect(authUrl.toString(), 302);
  response.headers.append(
    "Set-Cookie",
    buildCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 600
    })
  );
  return response;
}
