import { buildExpiredCookie, json, SESSION_COOKIE } from "../../_lib/auth";
import { getSessionUser } from "../../_lib/session";
import type { Env } from "../../_lib/types";

interface PagesContext {
  env: Env;
  request: Request;
}

interface DeleteAccountRequestBody {
  confirm?: unknown;
}

const CONFIRM_WORD = "Smazat";

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const user = await getSessionUser(context.request, context.env);
  if (!user) {
    return json({ error: "Pro smazání účtu se musíte přihlásit." }, 401);
  }

  let payload: DeleteAccountRequestBody;
  try {
    payload = (await context.request.json()) as DeleteAccountRequestBody;
  } catch {
    return json({ error: "Neplatný požadavek." });
  }

  if (String(payload.confirm || "").trim() !== CONFIRM_WORD) {
    return json({ error: `Pro potvrzení napište „${CONFIRM_WORD}".` });
  }

  // Anonymize the account: drop the login methods, clear personal data and the
  // ranking snapshot (so it no longer appears in any leaderboard), and mark it
  // as deleted. Guesses/history stay for the integrity of past evaluations, but
  // are no longer tied to an identifiable person.
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM user_auth_identities WHERE user_id = ?1").bind(user.id),
    context.env.DB.prepare(
      `UPDATE users
          SET status = 'deleted',
              email = NULL,
              nickname = ?1,
              avatar_hash = NULL,
              avatar_url = NULL,
              previous_rank = NULL,
              rank = NULL,
              rank_balance = NULL
        WHERE id = ?2`
    ).bind(`Smazaný uživatel #${user.id}`, user.id)
  ]);

  // The account is gone — end the session too.
  return new Response(
    JSON.stringify({ error: null, message: "Účet byl smazán." }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": buildExpiredCookie(SESSION_COOKIE)
      }
    }
  );
}
