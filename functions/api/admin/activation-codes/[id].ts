import { requireAdmin } from "../../../_lib/admin";
import { json, normalizeEmail, validateEmail } from "../../../_lib/auth";
import { SITE_URL, emailLayout, sendEmail } from "../../../_lib/email";
import type { ActivationCodeDeleteRecord, Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

interface ReserveRequestBody {
  reserved?: boolean;
}

interface SendRequestBody {
  email?: unknown;
}

// E-mail an existing (unused) code to an address the admin types in, and mark it
// reserved — the flip side of the "copy" action, for handing a code out.
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const codeId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(codeId) || codeId < 1) {
    return json({ error: "Neplatné ID aktivačního kódu." });
  }

  let payload: SendRequestBody;
  try {
    payload = (await context.request.json()) as SendRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const email = normalizeEmail(payload.email);
  if (!email || !validateEmail(email)) {
    return json({ error: "Zadejte platný e-mail." });
  }

  const record = await context.env.DB.prepare(
    "SELECT code, consumed_date FROM activation_codes WHERE id = ?1"
  ).bind(codeId).first<{ code: string; consumed_date: string | null }>();

  if (!record) {
    return json({ error: "Aktivační kód nebyl nalezen." });
  }
  if (record.consumed_date) {
    return json({ error: "Tento kód už byl použit." });
  }

  const sent = await sendEmail(context.env, {
    to: email,
    subject: "Aktivační kód do Hollywood 101 Tipovačky",
    html: emailLayout(
      `<p>Ahoj,</p>` +
      `<p>vítej v tipovačce! Tvůj aktivační kód je:</p>` +
      `<p style="font-size:22px;font-weight:bold;letter-spacing:1px;color:#111827;margin:16px 0;">${record.code}</p>` +
      `<p>Po přihlášení na <a href="${SITE_URL}">${SITE_URL}</a> ho zadej v sekci aktivace účtu a můžeš začít tipovat.</p>`
    ),
    text:
      `Ahoj,\n\n` +
      `vítej v tipovačce! Tvůj aktivační kód je: ${record.code}\n\n` +
      `Po přihlášení na ${SITE_URL} ho zadej v sekci aktivace účtu a můžeš začít tipovat.`
  });

  if (!sent) {
    return json({ error: "E-mail se nepodařilo odeslat." });
  }

  // Sending it out means it's in play — reserve it (mirrors copy).
  await context.env.DB.prepare(
    "UPDATE activation_codes SET reserved_date = COALESCE(reserved_date, ?1) WHERE id = ?2"
  ).bind(new Date().toISOString(), codeId).run();

  return json({ error: null, message: `Kód odeslán na ${email}.` });
}

// Reserve / un-reserve a code (soft marker; a reserved code still works).
export async function onRequestPatch(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const codeId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(codeId) || codeId < 1) {
    return json({ error: "Neplatné ID aktivačního kódu." });
  }

  let payload: ReserveRequestBody;
  try {
    payload = (await context.request.json()) as ReserveRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  const reservedDate = payload.reserved ? new Date().toISOString() : null;
  const result = await context.env.DB.prepare(
    "UPDATE activation_codes SET reserved_date = ?1 WHERE id = ?2"
  ).bind(reservedDate, codeId).run();

  if (result.meta.changes === 0) {
    return json({ error: "Aktivační kód nebyl nalezen." });
  }

  return json({ error: null, message: payload.reserved ? "Kód rezervován." : "Rezervace zrušena." });
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Vyžaduje přístup administrátora." }, 403);
  }

  const codeId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(codeId) || codeId < 1) {
    return json({ error: "Neplatné ID aktivačního kódu." });
  }

  const activationCode = await context.env.DB.prepare(
    "SELECT id, user_id, consumed_date FROM activation_codes WHERE id = ?1"
  ).bind(codeId).first<ActivationCodeDeleteRecord>();

  if (!activationCode) {
    return json({ error: "Aktivační kód nebyl nalezen." });
  }

  const redeemedByUser = activationCode.user_id !== null && activationCode.consumed_date !== null;

  if (redeemedByUser) {
    // Removing a redeemed code revokes the activation it granted.
    await context.env.DB.batch([
      context.env.DB.prepare(
        "UPDATE users SET status = 'deactivated' WHERE id = ?1 AND status = 'active'"
      ).bind(activationCode.user_id),
      context.env.DB.prepare(
        "DELETE FROM activation_codes WHERE id = ?1"
      ).bind(codeId)
    ]);

    return json({
      error: null,
      message: "Kód odebrán. Uživatel, který ho použil, byl deaktivován."
    });
  }

  await context.env.DB.prepare(
    "DELETE FROM activation_codes WHERE id = ?1"
  ).bind(codeId).run();

  return json({ error: null, message: "Kód odebrán." });
}
