import { generateActivationCode, requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { ActivationCodeListRecord, Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

const PAGE_SIZE = 10;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const url = new URL(context.request.url);
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") || "0", 10) || 0);

  const totalRow = await context.env.DB.prepare(
    "SELECT COUNT(*) AS total FROM activation_codes"
  ).first<{ total: number }>();
  const total = totalRow?.total ?? 0;

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
      ORDER BY activation_codes.id DESC
      LIMIT ?1 OFFSET ?2`
  ).bind(PAGE_SIZE, page * PAGE_SIZE).all<ActivationCodeListRecord>();

  return json({ error: null, codes: result.results, page, page_size: PAGE_SIZE, total });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  // Retry on the (unlikely) UNIQUE collision of a generated code.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateActivationCode();
    try {
      await context.env.DB.prepare(
        "INSERT INTO activation_codes (code, user_id, consumed_date) VALUES (?1, NULL, NULL)"
      ).bind(code).run();
      return json({ error: null, message: `Aktivační kód ${code} vytvořen.`, code });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("UNIQUE")) {
        console.error("Activation code insert failed", error);
        return json({ error: "Aktivační kód se nepodařilo vytvořit." });
      }
    }
  }

  return json({ error: "Aktivační kód se nepodařilo vytvořit." });
}
