// One-off backfill: replays the whole history through the live achievement
// rules and writes the result as SQL to run against D1. Runs locally on an
// export, so the free plan's per-request query limit doesn't matter.
//
//   1. apply migrations (0005, 0006) to the target DB
//   2. npx wrangler d1 export <db> --remote --output export.sql
//   3. yarn achievements:backfill export.sql backfill.sql [--reset]
//   4. npx wrangler d1 execute <db> --remote --file backfill.sql
//
// --reset first deletes all existing achievements (for a clean re-run).
// Without it, rows are INSERT OR IGNOREd, so already-awarded ones stay.
//
// Faithfulness: placings, accuracy, streaks and tip-based checks are exact.
// Payout-based ones (money truck, flop) use what the ledger actually paid.
// Bailout/broke come from the ledger. Leaderboard moves (ladder/snake) are
// reconstructed from ledger balances at each evaluation — close, not exact.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import {
  awardStatement,
  recountStatement,
  roundAchievementStatements
} from "../functions/_lib/achievements";
import { computeRoundScoring, GUESS_COST } from "../functions/_lib/scoring";

const [exportPath, outPath, ...flags] = process.argv.slice(2);
if (!exportPath || !outPath) {
  console.error("Usage: yarn achievements:backfill <export.sql> <out.sql> [--reset]");
  process.exit(1);
}
const reset = flags.includes("--reset");

const db = new DatabaseSync(":memory:");
// sqlite_sequence is internal; a plain sqlite .dump includes it, D1 exports don't.
db.exec(
  readFileSync(exportPath, "utf8")
    .split("\n")
    .filter((line) => !line.includes("sqlite_sequence"))
    .join("\n")
);

const columns = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'user_achievements'").get();
if (!hasTable || !columns.includes("achievements_diamond")) {
  console.error("The export lacks user_achievements / achievements_* — apply migrations 0005 and 0006 first.");
  process.exit(1);
}
db.exec("DELETE FROM user_achievements");

// Minimal D1 stand-in over node:sqlite (D1's ?1-style params bind positionally).
class Statement {
  params: unknown[] = [];
  constructor(readonly sql: string) {}
  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }
  async all() {
    return { results: db.prepare(this.sql).all(...(this.params as never[])) };
  }
  async first() {
    return db.prepare(this.sql).get(...(this.params as never[])) ?? null;
  }
  async run() {
    return db.prepare(this.sql).run(...(this.params as never[]));
  }
}
const env = {
  DB: {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      for (const statement of statements) {
        await statement.run();
      }
    }
  }
} as unknown as { DB: D1Database };
const run = (statements: unknown[]) => env.DB.batch(statements as D1PreparedStatement[]);

const users = db.prepare(
  "SELECT id, nickname, status, activated_date FROM users"
).all() as { id: number; nickname: string; status: string; activated_date: string | null }[];
const deleted = new Set(users.filter((user) => user.status === "deleted").map((user) => user.id));
const active = users.filter((user) => user.status !== "deleted");

const ledger = db.prepare(
  "SELECT user_id, amount, reason, created_date FROM imf_coin_history ORDER BY created_date, id"
).all() as { user_id: number; amount: number; reason: string | null; created_date: string }[];

const seasons = db.prepare(
  "SELECT id, name, started_date, ended_date FROM seasons ORDER BY id"
).all() as { id: number; name: string; started_date: string; ended_date: string | null }[];

const rounds = db.prepare(
  `SELECT id, title, type, evaluated_date FROM rounds
    WHERE evaluated_date IS NOT NULL ORDER BY evaluated_date`
).all() as { id: number; title: string; type: string; evaluated_date: string }[];

// Replay rounds in order, each seeing only the rounds evaluated before it.
db.exec("UPDATE rounds SET evaluated_date = NULL");
let previousRanks = new Map<number, number>();
let previousEvaluation = "";

for (const round of rounds) {
  const now = round.evaluated_date;
  const movies = db.prepare(
    "SELECT id, movie_title, actual_revenue FROM movies WHERE round_id = ?1"
  ).all(round.id) as { id: number; movie_title: string; actual_revenue: number }[];
  const guesses = db.prepare(
    "SELECT id, user_id, movie_id, guessed_revenue FROM guesses WHERE round_id = ?1"
  ).all(round.id) as { id: number; user_id: number; movie_id: number; guessed_revenue: number }[];
  const scoring = computeRoundScoring(movies, guesses);

  // What this round actually paid out, per player.
  const payoutByUser = new Map<number, number>();
  for (const entry of ledger) {
    const reason = entry.reason ?? "";
    if (reason.startsWith(`Odměna: ${round.title} – `) || reason === `Bonus za tipovačku: ${round.title}`) {
      payoutByUser.set(entry.user_id, (payoutByUser.get(entry.user_id) ?? 0) + entry.amount);
    }
  }

  // Leaderboard as it stood right after this evaluation: ledger balances at
  // that moment, ordered like evaluateRound does.
  const balance = new Map<number, number>();
  for (const entry of ledger) {
    if (entry.created_date <= now) {
      balance.set(entry.user_id, (balance.get(entry.user_id) ?? 0) + entry.amount);
    }
  }
  const ranked = active
    .filter((user) => user.activated_date && user.activated_date <= now)
    .map((user) => ({ id: user.id, nickname: user.nickname, balance: balance.get(user.id) ?? 0 }))
    .sort((a, b) => b.balance - a.balance || a.nickname.localeCompare(b.nickname));
  // A season starting in between resets everyone's rank.
  if (seasons.some((season) => season.started_date > previousEvaluation && season.started_date <= now && previousEvaluation)) {
    previousRanks = new Map();
  }
  const rankMoves = ranked.map((player, index) => ({
    userId: player.id,
    oldRank: previousRanks.get(player.id) ?? null,
    newRank: index + 1
  }));

  await run(
    await roundAchievementStatements(env, {
      round,
      movies,
      guesses,
      scoring,
      payoutByUser,
      rankMoves,
      activeUserIds: new Set(active.map((user) => user.id)),
      now
    })
  );

  previousRanks = new Map(rankMoves.map((move) => [move.userId, move.newRank]));
  previousEvaluation = now;
  db.prepare("UPDATE rounds SET evaluated_date = ?1 WHERE id = ?2").run(now, round.id);
}

// Bailout and broke, from the ledger.
const running = new Map<number, number>();
for (const entry of ledger) {
  const reason = entry.reason ?? "";
  const after = (running.get(entry.user_id) ?? 0) + entry.amount;
  running.set(entry.user_id, after);
  if (reason === "Záchranný balíček IMF") {
    await run([awardStatement(env, entry.user_id, "bailout", "", null, entry.created_date)]);
  }
  if (reason.startsWith("Tip: ") && after < GUESS_COST) {
    const roundTitle = reason.slice("Tip: ".length).split(" – ")[0];
    await run([awardStatement(env, entry.user_id, "broke", "", roundTitle, entry.created_date)]);
  }
}

// Podium of every ended season.
const podiumKeys = ["season_champion", "season_second", "season_third"];
for (const season of seasons.filter((s) => s.ended_date)) {
  const podium = db.prepare(
    "SELECT user_id, rank FROM season_standings WHERE season_id = ?1 AND rank BETWEEN 1 AND 3"
  ).all(season.id) as { user_id: number; rank: number }[];
  for (const row of podium) {
    await run([
      awardStatement(env, row.user_id, podiumKeys[row.rank - 1], `season:${season.id}`, season.name, season.ended_date!)
    ]);
  }
}

// Write the SQL: rows of non-deleted players, then recount everyone's totals.
const rows = db.prepare(
  "SELECT user_id, achievement_key, source, detail, earned_date FROM user_achievements ORDER BY earned_date, id"
).all() as { user_id: number; achievement_key: string; source: string; detail: string | null; earned_date: string }[];
const kept = rows.filter((row) => !deleted.has(row.user_id));
const quote = (value: string | null) => (value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`);
const lines = [
  ...(reset ? ["DELETE FROM user_achievements;"] : []),
  ...kept.map(
    (row) =>
      `INSERT OR IGNORE INTO user_achievements (user_id, achievement_key, source, detail, earned_date) VALUES (${row.user_id}, ${quote(row.achievement_key)}, ${quote(row.source)}, ${quote(row.detail)}, ${quote(row.earned_date)});`
  ),
  `${(recountStatement(env) as unknown as Statement).sql};`
];
writeFileSync(outPath, `${lines.join("\n")}\n`);

const perKey = new Map<string, { awards: number; players: Set<number> }>();
for (const row of kept) {
  const stat = perKey.get(row.achievement_key) ?? { awards: 0, players: new Set<number>() };
  stat.awards += 1;
  stat.players.add(row.user_id);
  perKey.set(row.achievement_key, stat);
}
console.log(`${rounds.length} rounds replayed, ${kept.length} achievements → ${outPath}${reset ? " (with reset)" : ""}`);
for (const [key, stat] of [...perKey].sort((a, b) => b[1].awards - a[1].awards)) {
  console.log(`  ${key.padEnd(18)} ${String(stat.awards).padStart(4)} awards, ${stat.players.size} players`);
}
