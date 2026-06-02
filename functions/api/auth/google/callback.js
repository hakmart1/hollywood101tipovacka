import {
  assertAuthConfig,
  buildCookie,
  buildExpiredCookie,
  findOrCreateGoogleUser,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  OAUTH_STATE_COOKIE,
  readCookie,
  redirectWithMessage,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession
} from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  assertAuthConfig(context.env);

  const url = new URL(context.request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const savedState = readCookie(context.request, OAUTH_STATE_COOKIE);

  if (!state || !savedState || state !== savedState) {
    return redirectWithMessage(context.request, "/", "oauth-state-mismatch", [
      buildExpiredCookie(OAUTH_STATE_COOKIE)
    ]);
  }

  if (!code) {
    return redirectWithMessage(context.request, "/", "missing-google-code", [
      buildExpiredCookie(OAUTH_STATE_COOKIE)
    ]);
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: context.env.GOOGLE_CLIENT_ID,
      client_secret: context.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: context.env.GOOGLE_REDIRECT_URI
    })
  });

  if (!tokenResponse.ok) {
    return redirectWithMessage(context.request, "/", "google-token-exchange-failed", [
      buildExpiredCookie(OAUTH_STATE_COOKIE)
    ]);
  }

  const tokenPayload = await tokenResponse.json();
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`
    }
  });

  if (!userInfoResponse.ok) {
    return redirectWithMessage(context.request, "/", "google-userinfo-failed", [
      buildExpiredCookie(OAUTH_STATE_COOKIE)
    ]);
  }

  const googleProfile = await userInfoResponse.json();

  if (!googleProfile.sub || !googleProfile.email) {
    return redirectWithMessage(context.request, "/", "google-profile-incomplete", [
      buildExpiredCookie(OAUTH_STATE_COOKIE)
    ]);
  }

  if (googleProfile.email_verified === false) {
    return redirectWithMessage(context.request, "/", "google-email-not-verified", [
      buildExpiredCookie(OAUTH_STATE_COOKIE)
    ]);
  }

  const user = await findOrCreateGoogleUser(context.env, googleProfile);
  const sessionToken = await signSession(
    {
      userId: user.id,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
    },
    context.env.SESSION_SECRET
  );

  return redirectWithMessage(context.request, "/", "login-success", [
    buildExpiredCookie(OAUTH_STATE_COOKIE),
    buildCookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS
    })
  ]);
}
