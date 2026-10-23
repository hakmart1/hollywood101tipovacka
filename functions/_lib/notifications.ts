import { SITE_URL, emailLayout, sendEmails } from "./email";
import type { EmailMessage } from "./email";
import type { Env } from "./types";

// Opt-in round notifications, sent by the cron worker:
//  - "start": a round has opened for tipping,
//  - "closing": 24 hours left — only to players who haven't tipped every movie.
// Each round records when a notification went out (rounds.start_notified_date /
// closing_notified_date), so it's sent once. If Mailjet fails, the round stays
// unmarked and the next cron run retries.

type NotifyEnv = Pick<Env, "DB" | "MAILJET_API_KEY" | "MAILJET_SECRET_KEY" | "EMAIL_FROM">;

const CLOSING_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEZONE = "Europe/Prague";

interface NotifyRound {
  id: number;
  title: string;
  date_to: string;
}

interface Recipient {
  id: number;
  email: string;
  timezone: string | null;
}

const FOOTER =
  `Upozornění si můžeš kdykoli vypnout v <a href="${SITE_URL}/#/user" style="color:#6b7280;">Můj účet</a>.`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "středa 21. 10. 21:59" in the player's timezone (used after a label, so the
// nominative weekday reads fine).
function formatDeadline(iso: string, timezone: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
  try {
    return new Date(iso).toLocaleString("cs-CZ", { ...options, timeZone: timezone || DEFAULT_TIMEZONE });
  } catch {
    return new Date(iso).toLocaleString("cs-CZ", { ...options, timeZone: DEFAULT_TIMEZONE });
  }
}

function movieListHtml(titles: string[]): string {
  return `<ul style="margin:8px 0 16px;padding-left:20px;">${titles
    .map((title) => `<li>${escapeHtml(title)}</li>`)
    .join("")}</ul>`;
}

function startMessage(round: NotifyRound, movies: string[], recipient: Recipient): EmailMessage {
  const deadline = formatDeadline(round.date_to, recipient.timezone);
  return {
    to: recipient.email,
    subject: `Nová tipovačka: ${round.title}`,
    html: emailLayout(
      `<p>Ahoj,</p>` +
        `<p>začala nová tipovačka <strong>${escapeHtml(round.title)}</strong>. Tipuje se na tyto filmy:</p>` +
        movieListHtml(movies) +
        `<p>Uzávěrka tipů: <strong>${deadline}</strong></p>` +
        `<p><a href="${SITE_URL}" style="display:inline-block;background:#f0c419;color:#17181f;font-weight:bold;padding:10px 18px;border-radius:8px;text-decoration:none;">Jdu tipovat</a></p>`,
      FOOTER
    ),
    text:
      `Ahoj,\n\nzačala nová tipovačka ${round.title}. Tipuje se na tyto filmy:\n` +
      movies.map((title) => `- ${title}`).join("\n") +
      `\n\nUzávěrka tipů: ${deadline}\n${SITE_URL}\n\n` +
      `Upozornění si můžeš vypnout v Můj účet: ${SITE_URL}/#/user`
  };
}

function closingMessage(round: NotifyRound, missing: string[], recipient: Recipient): EmailMessage {
  const deadline = formatDeadline(round.date_to, recipient.timezone);
  return {
    to: recipient.email,
    subject: `Zbývá 24 hodin: ${round.title}`,
    html: emailLayout(
      `<p>Ahoj,</p>` +
        `<p>tipovačka <strong>${escapeHtml(round.title)}</strong> se za 24 hodin uzavírá ` +
        `(uzávěrka: <strong>${deadline}</strong>). Ještě ti chybí tip na:</p>` +
        movieListHtml(missing) +
        `<p><a href="${SITE_URL}" style="display:inline-block;background:#f0c419;color:#17181f;font-weight:bold;padding:10px 18px;border-radius:8px;text-decoration:none;">Doplnit tipy</a></p>`,
      FOOTER
    ),
    text:
      `Ahoj,\n\ntipovačka ${round.title} se za 24 hodin uzavírá (uzávěrka: ${deadline}). Ještě ti chybí tip na:\n` +
      missing.map((title) => `- ${title}`).join("\n") +
      `\n\n${SITE_URL}\n\n` +
      `Upozornění si můžeš vypnout v Můj účet: ${SITE_URL}/#/user`
  };
}

async function movieTitles(env: NotifyEnv, roundId: number): Promise<{ id: number; movie_title: string }[]> {
  const movies = await env.DB.prepare(
    "SELECT id, movie_title FROM movies WHERE round_id = ?1 ORDER BY id"
  ).bind(roundId).all<{ id: number; movie_title: string }>();
  return movies.results;
}

async function recipients(env: NotifyEnv, column: "notify_round_start" | "notify_round_closing"): Promise<Recipient[]> {
  const rows = await env.DB.prepare(
    `SELECT id, email, timezone FROM users
      WHERE ${column} = 1 AND status = 'active' AND email IS NOT NULL`
  ).all<Recipient>();
  return rows.results;
}

// Sends whatever notifications are due right now. Returns log lines.
export async function sendRoundNotifications(env: NotifyEnv, now: Date = new Date()): Promise<string[]> {
  const log: string[] = [];
  const nowIso = now.toISOString();
  const closingIso = new Date(now.getTime() + CLOSING_WINDOW_MS).toISOString();

  // Rounds that have opened (and are still open) but weren't announced yet.
  const starting = await env.DB.prepare(
    `SELECT id, title, date_to FROM rounds
      WHERE start_notified_date IS NULL AND date_from <= ?1 AND date_to > ?1`
  ).bind(nowIso).all<NotifyRound>();

  for (const round of starting.results) {
    const movies = await movieTitles(env, round.id);
    if (movies.length === 0) {
      continue; // nothing to tip yet — announce once the movies are in
    }
    const list = await recipients(env, "notify_round_start");
    const sent = await sendEmails(env, list.map((r) => startMessage(round, movies.map((m) => m.movie_title), r)));
    if (sent) {
      await env.DB.prepare("UPDATE rounds SET start_notified_date = ?1 WHERE id = ?2").bind(nowIso, round.id).run();
      log.push(`Round ${round.id}: start notification sent to ${list.length}.`);
    } else {
      log.push(`Round ${round.id}: start notification not sent (will retry).`);
    }
  }

  // Rounds closing within 24 hours, reminder not sent yet.
  const closing = await env.DB.prepare(
    `SELECT id, title, date_to FROM rounds
      WHERE closing_notified_date IS NULL AND date_from <= ?1 AND date_to > ?1 AND date_to <= ?2`
  ).bind(nowIso, closingIso).all<NotifyRound>();

  for (const round of closing.results) {
    const movies = await movieTitles(env, round.id);
    if (movies.length === 0) {
      continue;
    }
    const tipped = await env.DB.prepare(
      "SELECT user_id, movie_id FROM guesses WHERE round_id = ?1"
    ).bind(round.id).all<{ user_id: number; movie_id: number }>();
    const tippedSet = new Set(tipped.results.map((row) => `${row.user_id}:${row.movie_id}`));

    const messages: EmailMessage[] = [];
    for (const recipient of await recipients(env, "notify_round_closing")) {
      const missing = movies.filter((movie) => !tippedSet.has(`${recipient.id}:${movie.id}`));
      if (missing.length > 0) {
        messages.push(closingMessage(round, missing.map((movie) => movie.movie_title), recipient));
      }
    }
    const sent = await sendEmails(env, messages);
    if (sent) {
      await env.DB.prepare("UPDATE rounds SET closing_notified_date = ?1 WHERE id = ?2").bind(nowIso, round.id).run();
      log.push(`Round ${round.id}: closing reminder sent to ${messages.length}.`);
    } else {
      log.push(`Round ${round.id}: closing reminder not sent (will retry).`);
    }
  }

  return log;
}
