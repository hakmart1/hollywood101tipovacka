import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

// Users still waiting for an activation code — surfaced in the admin (and as a
// badge next to "Administrace") so requests get noticed without any email.
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const requests = await context.env.DB.prepare(
    `SELECT id, nickname, email, last_code_request_date
       FROM users
      WHERE status IN ('pending_activation', 'deactivated')
        AND last_code_request_date IS NOT NULL
      ORDER BY last_code_request_date DESC`
  ).all<{ id: number; nickname: string; email: string | null; last_code_request_date: string }>();

  return json({ error: null, requests: requests.results });
}
