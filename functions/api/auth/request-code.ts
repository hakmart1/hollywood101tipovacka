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
    return json({ error: "Pro vyžádání aktivačního kódu musíte být přihlášeni." }, 401);
  }

  if (user.status !== "pending_activation" && user.status !== "deactivated") {
    return json({ error: "Váš účet nepotřebuje aktivaci." });
  }

  // One request per calendar day (UTC), not a rolling 24-hour window.
  const today = new Date().toISOString().slice(0, 10);
  if (user.last_code_request_date && user.last_code_request_date.slice(0, 10) === today) {
    return json({
      error: "O aktivační kód jste dnes již požádali. Zkuste to znovu zítra."
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
      "Vaše žádost byla zaznamenána a administrátor bude upozorněn, aby vám poslal aktivační kód. Odesílání e-mailů zatím není zprovozněno."
  });
}
