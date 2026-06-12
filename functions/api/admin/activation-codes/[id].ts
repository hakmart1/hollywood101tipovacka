import { requireAdmin } from "../../../_lib/admin";
import { json } from "../../../_lib/auth";
import type { ActivationCodeDeleteRecord, Env } from "../../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
  params: { id: string };
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const admin = await requireAdmin(context.request, context.env);
  if (!admin) {
    return json({ error: "Admin access required." }, 403);
  }

  const codeId = Number.parseInt(context.params.id, 10);
  if (!Number.isInteger(codeId) || codeId < 1) {
    return json({ error: "Invalid activation code id." });
  }

  const activationCode = await context.env.DB.prepare(
    "SELECT id, user_id, consumed_date FROM activation_codes WHERE id = ?1"
  ).bind(codeId).first<ActivationCodeDeleteRecord>();

  if (!activationCode) {
    return json({ error: "Activation code was not found." });
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
      message: "Activation code removed. The user who redeemed it was deactivated."
    });
  }

  await context.env.DB.prepare(
    "DELETE FROM activation_codes WHERE id = ?1"
  ).bind(codeId).run();

  return json({ error: null, message: "Activation code removed." });
}
