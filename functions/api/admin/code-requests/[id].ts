import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

// Dismiss a pending request by clearing the user's last_code_request_date. The
// user can request again later; this just removes it from the admin's list.
export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const userId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(userId) || userId < 1) {
    return json({ error: "Neplatné ID uživatele." });
  }

  await context.env.DB.prepare(
    "UPDATE users SET last_code_request_date = NULL WHERE id = ?1"
  ).bind(userId).run();

  return json({ error: null, message: "Žádost odebrána." });
}
