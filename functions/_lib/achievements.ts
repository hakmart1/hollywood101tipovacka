import { computeRoundScoring, guessError, GUESS_COST, QUALIFY_MARGIN } from "./scoring";
import type { RoundScoring, ScoringGuess } from "./scoring";
import type { Env } from "./types";

// Achievements. Definitions live here (names, tiers, rules); the DB only stores
// who earned what (user_achievements). Positive achievements are repeatable —
// one row per event, keyed by `source` — while raspberries (the funny/negative
// ones) can be earned once. Everything is awarded with INSERT OR IGNORE, so a
// check can safely run twice.
//
// Achievements start with the first season after launch (see firstSeason):
// nothing is awarded before it, and streaks/hattricks only look at rounds
// evaluated since it started, so older data never mixes in. Streaks
// then carry on across later seasons.

export type AchievementTier = "diamond" | "gold" | "silver" | "bronze" | "raspberry";

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "season_champion", tier: "diamond", icon: "⭐", name: "Hvězda na chodníku slávy", description: "1. místo v sezóně" },
  { key: "crystal_ball", tier: "diamond", icon: "🔮", name: "Křišťálová koule", description: "Celková odchylka v tipovačce pod 5 %" },
  { key: "clean_sweep", tier: "diamond", icon: "🧹", name: "Čistý stůl", description: "1. místo u všech filmů jedné tipovačky" },
  { key: "hattrick", tier: "diamond", icon: "🎩", name: "Hattrick", description: "Vyhrát 3 tipovačky v řadě" },
  { key: "money_truck", tier: "diamond", icon: "🚚", name: "Dodávka s penězi", description: "Čistý zisk z tipovačky aspoň 1 M" },
  { key: "season_pass", tier: "diamond", icon: "🎟️", name: "Permanentka", description: "50 tipovaček v řadě" },
  { key: "perfect_weekend", tier: "diamond", icon: "✨", name: "Dokonalý víkend", description: "Všechny tipy v tipovačce s odchylkou pod 20 %" },
  { key: "superstar", tier: "gold", icon: "🌟", name: "Superstar", description: "1. místo v tipovačce" },
  { key: "season_second", tier: "gold", icon: "🎞️", name: "Druhý v titulcích", description: "2. místo v sezóně" },
  { key: "season_third", tier: "gold", icon: "📸", name: "Na červeném koberci", description: "3. místo v sezóně" },
  { key: "nostradamus", tier: "gold", icon: "🎯", name: "Nostradamus", description: "Tip přesně na skutečné tržby" },
  { key: "silver_screen", tier: "silver", icon: "🎬", name: "Stříbrné plátno", description: "2. místo v tipovačce" },
  { key: "lead_role", tier: "silver", icon: "🎭", name: "Hlavní role", description: "1. místo u filmu" },
  { key: "bonus_hunter", tier: "silver", icon: "🏹", name: "Lovec bonusů", description: "Vyhrát bonusovou tipovačku" },
  { key: "subscriber", tier: "silver", icon: "📺", name: "Předplatitel", description: "10 tipovaček v řadě" },
  { key: "bronze_clapper", tier: "bronze", icon: "🎬", name: "Bronzová klapka", description: "3. místo v tipovačce" },
  { key: "supporting_role", tier: "bronze", icon: "🎭", name: "Vedlejší role", description: "2. místo u filmu" },
  { key: "extra", tier: "bronze", icon: "👥", name: "Komparz", description: "3. místo u filmu" },
  { key: "regular_viewer", tier: "bronze", icon: "🍿", name: "Pravidelný divák", description: "3 tipovačky v řadě" },
  { key: "ladder", tier: "bronze", icon: "🪜", name: "Žebřík", description: "Posun v žebříčku o víc než 3 místa" },
  { key: "bailout", tier: "raspberry", icon: "🥫", name: "Na dávkách", description: "Požádat Měnový fond o výpomoc" },
  { key: "broke", tier: "raspberry", icon: "🪫", name: "Na mizině", description: "Zůstatek nestačí ani na jeden tip" },
  { key: "box_office_flop", tier: "raspberry", icon: "📉", name: "Kasovní propadák", description: "Prodělat na tipovačce aspoň 250 000" },
  { key: "forgetful", tier: "raspberry", icon: "🙈", name: "Zapomnětlivec", description: "Vynechat tipovačku po sérii aspoň 10" },
  { key: "snake", tier: "raspberry", icon: "🐍", name: "Had", description: "Propad v žebříčku o víc než 3 místa" },
  { key: "way_off", tier: "raspberry", icon: "🚀", name: "Mimo mísu", description: "Tip aspoň 5× vyšší než skutečné tržby" },
  { key: "optimist", tier: "raspberry", icon: "🌈", name: "Optimista bez hranic", description: "Všechny tipy v tipovačce nad skutečností, průměrně víc než 30 % vedle" },
  { key: "pessimist", tier: "raspberry", icon: "🌧️", name: "Věčný pesimista", description: "Všechny tipy v tipovačce pod skutečností, průměrně víc než 30 % vedle" }
];

// Production starts with season 2; the preview (test data) overrides it via the
// ACHIEVEMENTS_FROM_SEASON var to have achievements over the whole history.
const DEFAULT_ACHIEVEMENTS_FROM_SEASON = 2;

type AchievementEnv = Pick<Env, "DB" | "ACHIEVEMENTS_FROM_SEASON">;

function firstSeason(env: AchievementEnv): number {
  const configured = Number.parseInt(env.ACHIEVEMENTS_FROM_SEASON ?? "", 10);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_ACHIEVEMENTS_FROM_SEASON;
}

// Start of the achievement era, or null while it hasn't begun (no awards).
export async function achievementsStart(env: AchievementEnv): Promise<string | null> {
  const season = await env.DB.prepare("SELECT started_date FROM seasons WHERE id = ?1")
    .bind(firstSeason(env)).first<{ started_date: string }>();
  return season?.started_date ?? null;
}

const BY_KEY = new Map(ACHIEVEMENTS.map((def) => [def.key, def]));

export function isRepeatable(def: AchievementDef): boolean {
  return def.tier !== "raspberry";
}

// Thresholds.
const STREAKS: [number, string][] = [[3, "regular_viewer"], [10, "subscriber"], [50, "season_pass"]];
const FORGETFUL_STREAK = 10;
const HATTRICK_WINS = 3;
const CRYSTAL_BALL_ERROR = 0.05;
const PERFECT_WEEKEND_ERROR = 0.2;
const MONEY_TRUCK_PER_MOVIE = 200_000; // 1M at 5 movies
const FLOP_LOSS = 250_000;
const WAY_OFF_FACTOR = 5;
const BIASED_AVG_ERROR = 0.3;
const RANK_MOVE = 3;

// One award, ready to go into a D1 batch. One-time achievements ignore the
// source, so the unique key allows only a single row.
export function awardStatement(
  env: Pick<Env, "DB">,
  userId: number,
  key: string,
  source: string,
  detail: string | null,
  now: string
): D1PreparedStatement {
  const def = BY_KEY.get(key);
  if (!def) {
    throw new Error(`Unknown achievement: ${key}`);
  }
  return env.DB.prepare(
    `INSERT OR IGNORE INTO user_achievements (user_id, achievement_key, source, detail, earned_date)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(userId, key, isRepeatable(def) ? source : "", detail, now);
}

export interface RoundAchievementInput {
  round: { id: number; title: string; type: string };
  movies: { id: number; movie_title: string; actual_revenue: number }[];
  guesses: ScoringGuess[];
  scoring: RoundScoring;
  payoutByUser: Map<number, number>; // everything paid out for the round
  rankMoves: { userId: number; oldRank: number | null; newRank: number }[];
  activeUserIds: Set<number>; // non-deleted players
  since: string; // achievementsStart()
  now: string;
}

// Achievements decided by evaluating a round. Returns the INSERT statements to
// run in the same batch as the payouts.
export async function roundAchievementStatements(
  env: Pick<Env, "DB">,
  input: RoundAchievementInput
): Promise<D1PreparedStatement[]> {
  const { round, movies, guesses, scoring, payoutByUser, rankMoves, activeUserIds, now } = input;
  const awards: D1PreparedStatement[] = [];
  const award = (userId: number, key: string, source: string, detail: string | null) =>
    awards.push(awardStatement(env, userId, key, source, detail, now));

  const roundSource = `round:${round.id}`;
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));
  const guessesByUser = new Map<number, ScoringGuess[]>();
  for (const guess of guesses) {
    const list = guessesByUser.get(guess.user_id) ?? [];
    list.push(guess);
    guessesByUser.set(guess.user_id, list);
  }
  const eligible = new Set(scoring.standings.map((standing) => standing.userId));

  // --- Round placings and round-wide accuracy -------------------------------
  const totalActual = movies.reduce((sum, movie) => sum + movie.actual_revenue, 0);
  const winners = new Set<number>();
  for (const standing of scoring.standings) {
    const placeKey = ["superstar", "silver_screen", "bronze_clapper"][standing.rank - 1];
    if (placeKey) {
      award(standing.userId, placeKey, roundSource, round.title);
    }
    if (standing.rank === 1) {
      winners.add(standing.userId);
      if (round.type === "bonus") {
        award(standing.userId, "bonus_hunter", roundSource, round.title);
      }
    }
    if (totalActual > 0 && standing.totalAbsError / totalActual < CRYSTAL_BALL_ERROR) {
      award(standing.userId, "crystal_ball", roundSource, round.title);
    }
  }

  // --- Per-movie placings -----------------------------------------------------
  const movieWinsByUser = new Map<number, number>();
  for (const [movieId, standings] of scoring.movieStandings) {
    const movie = movieById.get(movieId);
    if (!movie) {
      continue;
    }
    for (const standing of standings) {
      // Same qualification as the placement bonus, so a 0-revenue movie
      // doesn't crown someone who was miles off.
      if (guessError(standing.guessedRevenue, movie.actual_revenue) > QUALIFY_MARGIN) {
        continue;
      }
      const placeKey = ["lead_role", "supporting_role", "extra"][standing.rank - 1];
      if (placeKey) {
        award(standing.userId, placeKey, `movie:${movieId}`, `${round.title} – ${movie.movie_title}`);
      }
      if (standing.rank === 1) {
        movieWinsByUser.set(standing.userId, (movieWinsByUser.get(standing.userId) ?? 0) + 1);
      }
    }
  }
  for (const [userId, wins] of movieWinsByUser) {
    if (movies.length > 1 && wins === movies.length) {
      award(userId, "clean_sweep", roundSource, round.title);
    }
  }

  // --- Per-player tip checks --------------------------------------------------
  for (const [userId, userGuesses] of guessesByUser) {
    let allClose = eligible.has(userId);
    const biases: number[] = [];

    for (const guess of userGuesses) {
      const movie = movieById.get(guess.movie_id);
      if (!movie) {
        continue;
      }
      const detail = `${round.title} – ${movie.movie_title}`;
      if (guess.guessed_revenue === movie.actual_revenue) {
        award(userId, "nostradamus", `movie:${movie.id}`, detail);
      }
      if (guessError(guess.guessed_revenue, movie.actual_revenue) >= PERFECT_WEEKEND_ERROR) {
        allClose = false;
      }
      // Relative checks make no sense for a movie that earned nothing.
      if (movie.actual_revenue > 0) {
        if (guess.guessed_revenue >= WAY_OFF_FACTOR * movie.actual_revenue) {
          award(userId, "way_off", "", detail);
        }
        biases.push((guess.guessed_revenue - movie.actual_revenue) / movie.actual_revenue);
      }
    }

    if (allClose) {
      award(userId, "perfect_weekend", roundSource, round.title);
    }

    if (eligible.has(userId) && biases.length > 0) {
      const avgError = biases.reduce((sum, bias) => sum + Math.abs(bias), 0) / biases.length;
      if (avgError > BIASED_AVG_ERROR && biases.every((bias) => bias > 0)) {
        award(userId, "optimist", "", round.title);
      }
      if (avgError > BIASED_AVG_ERROR && biases.every((bias) => bias < 0)) {
        award(userId, "pessimist", "", round.title);
      }
    }

    const profit = (payoutByUser.get(userId) ?? 0) - userGuesses.length * GUESS_COST;
    if (profit >= MONEY_TRUCK_PER_MOVIE * movies.length) {
      award(userId, "money_truck", roundSource, round.title);
    }
    if (profit <= -FLOP_LOSS) {
      award(userId, "box_office_flop", "", round.title);
    }
  }

  // --- Leaderboard movement ---------------------------------------------------
  for (const move of rankMoves) {
    if (move.oldRank === null) {
      continue;
    }
    if (move.oldRank - move.newRank > RANK_MOVE) {
      award(move.userId, "ladder", roundSource, `${round.title}: ${move.oldRank}. → ${move.newRank}.`);
    }
    if (move.newRank - move.oldRank > RANK_MOVE) {
      award(move.userId, "snake", "", `${round.title}: ${move.oldRank}. → ${move.newRank}.`);
    }
  }

  // --- Streaks and hattrick (standard rounds only; bonus rounds are skipped:
  // they neither count nor break a streak) -------------------------------------
  if (round.type === "standard") {
    await streakAwards(env, input, eligible, winners, award);
  }

  return awards;
}

async function streakAwards(
  env: Pick<Env, "DB">,
  input: RoundAchievementInput,
  eligible: Set<number>,
  winners: Set<number>,
  award: (userId: number, key: string, source: string, detail: string | null) => void
): Promise<void> {
  const { round, activeUserIds, since } = input;
  const roundSource = `round:${round.id}`;
  const longest = Math.max(...STREAKS.map(([length]) => length), FORGETFUL_STREAK);

  // Earlier evaluated standard rounds, newest first — enough to tell the
  // longest streak we care about (anything longer just reads as "longer").
  const previous = await env.DB.prepare(
    `SELECT r.id, (SELECT COUNT(*) FROM movies m WHERE m.round_id = r.id) AS movie_count
       FROM rounds r
      WHERE r.type = 'standard' AND r.evaluated_date >= ?3 AND r.id != ?1
      ORDER BY r.evaluated_date DESC
      LIMIT ?2`
  ).bind(round.id, longest, since).all<{ id: number; movie_count: number }>();
  const previousRounds = previous.results;

  if (previousRounds.length > 0) {
    const ids = previousRounds.map((row) => row.id);
    const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
    const counts = await env.DB.prepare(
      `SELECT round_id, user_id, COUNT(*) AS n FROM guesses
        WHERE round_id IN (${placeholders})
        GROUP BY round_id, user_id`
    ).bind(...ids).all<{ round_id: number; user_id: number; n: number }>();

    // A round counts as played only with every movie tipped.
    const movieCount = new Map(previousRounds.map((row) => [row.id, row.movie_count]));
    const played = new Set(
      counts.results
        .filter((row) => row.n === movieCount.get(row.round_id))
        .map((row) => `${row.round_id}:${row.user_id}`)
    );
    const streakBefore = (userId: number) => {
      let streak = 0;
      for (const row of previousRounds) {
        if (!played.has(`${row.id}:${userId}`)) {
          break;
        }
        streak += 1;
      }
      return streak;
    };

    for (const userId of activeUserIds) {
      const before = streakBefore(userId);
      if (eligible.has(userId)) {
        const reached = STREAKS.find(([length]) => length === before + 1);
        if (reached) {
          award(userId, reached[1], roundSource, round.title);
        }
      } else if (before >= FORGETFUL_STREAK) {
        award(userId, "forgetful", "", `${round.title} (po ${before} v řadě)`);
      }
    }
  }

  // Hattrick: won this one and the previous two standard rounds. Overlapping
  // windows don't pay twice — a 4th win in a row needs a fresh run of three.
  const lookback = previousRounds.slice(0, HATTRICK_WINS - 1);
  if (winners.size === 0 || lookback.length < HATTRICK_WINS - 1) {
    return;
  }
  const winnerSets = await Promise.all(lookback.map((row) => roundWinners(env, row.id)));
  const lookbackSources = lookback.map((row) => `round:${row.id}`);
  const existing = await env.DB.prepare(
    `SELECT user_id, source FROM user_achievements
      WHERE achievement_key = 'hattrick' AND source IN (${lookbackSources.map((_, index) => `?${index + 1}`).join(", ")})`
  ).bind(...lookbackSources).all<{ user_id: number; source: string }>();
  const alreadyCounted = new Set(existing.results.map((row) => row.user_id));

  for (const userId of winners) {
    if (winnerSets.every((set) => set.has(userId)) && !alreadyCounted.has(userId)) {
      award(userId, "hattrick", roundSource, round.title);
    }
  }
}

// Rank-1 players of an evaluated round, recomputed with the same scoring.
async function roundWinners(env: Pick<Env, "DB">, roundId: number): Promise<Set<number>> {
  const [movies, guesses] = await Promise.all([
    env.DB.prepare("SELECT id, actual_revenue FROM movies WHERE round_id = ?1")
      .bind(roundId).all<{ id: number; actual_revenue: number }>(),
    env.DB.prepare("SELECT id, user_id, movie_id, guessed_revenue FROM guesses WHERE round_id = ?1")
      .bind(roundId).all<ScoringGuess>()
  ]);
  const { standings } = computeRoundScoring(movies.results, guesses.results);
  return new Set(standings.filter((standing) => standing.rank === 1).map((standing) => standing.userId));
}

// Final season placings, awarded when the season is closed.
export async function seasonAchievementStatements(
  env: AchievementEnv,
  season: { id: number; name: string },
  now: string
): Promise<D1PreparedStatement[]> {
  if (season.id < firstSeason(env)) {
    return [];
  }
  const podium = await env.DB.prepare(
    "SELECT id, rank FROM users WHERE rank BETWEEN 1 AND 3 AND status != 'deleted'"
  ).all<{ id: number; rank: number }>();
  const keys = ["season_champion", "season_second", "season_third"];
  return podium.results.map((row) =>
    awardStatement(env, row.id, keys[row.rank - 1], `season:${season.id}`, season.name, now)
  );
}
