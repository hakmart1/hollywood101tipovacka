import { generateActivationCode, requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { ActivationCodeListRecord, Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const result = await context.env.DB.prepare(
    `SELECT
        activation_codes.id,
        activation_codes.code,
        activation_codes.consumed_date,
        activation_codes.reserved_date,
        activation_codes.user_id,
        users.nickname AS user_nickname,
        users.email AS user_email,
        users.status AS user_status
      FROM activation_codes
      LEFT JOIN users ON users.id = activation_codes.user_id
      ORDER BY activation_codes.id DESC`
  ).all<ActivationCodeListRecord>();

  return json({ error: null, codes: result.results });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  // Retry on the (unlikely) UNIQUE collision of a generated code.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateActivationCode();
    try {
      await context.env.DB.prepare(
        "INSERT INTO activation_codes (code, user_id, consumed_date) VALUES (?1, NULL, NULL)"
      ).bind(code).run();
      return json({ error: null, message: `Activation code ${code} created.`, code });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("UNIQUE")) {
        console.error("Activation code insert failed", error);
        return json({ error: "Could not create activation code." });
      }
    }
  }

  return json({ error: "Could not create activation code." });
}
