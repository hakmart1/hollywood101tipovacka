import { json } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "You must be logged in to request an activation code." }, 401);
  }

  if (user.status !== "pending_activation" && user.status !== "deactivated") {
    return json({ error: "Your account does not need activation." });
  }

  // One request per calendar day (UTC), not a rolling 24-hour window.
  const today = new Date().toISOString().slice(0, 10);
  if (user.last_code_request_date && user.last_code_request_date.slice(0, 10) === today) {
    return json({
      error: "You already requested an activation code today. You can ask again tomorrow."
    });
  }

  // Codes are handed out by the admin; the request only records that this user
  // is waiting for one. Later this will also send a reminder email to the admin.
  await context.env.DB.prepare(
    "UPDATE users SET last_code_request_date = ?1 WHERE id = ?2"
  ).bind(new Date().toISOString(), user.id).run();

  return json({
    error: null,
    message:
      "Your request was recorded and the admin will be reminded to send you an activation code. Email delivery is not implemented yet."
  });
}
