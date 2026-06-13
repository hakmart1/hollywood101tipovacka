// Reward rules for evaluating a round (mirrored on the user-facing rules page).
// Used by both the admin evaluate endpoint and the public results endpoint so
// displayed standings always match the coins actually paid out.
export const QUALIFY_MARGIN = 0.25; // within +/-25% of the actual result qualifies
export const BASE_REWARD = 100_000; // flat reward for a qualifying guess
export const PRECISION_REWARD = 100_000; // extra, scaled 0..1 by how close the guess is
export const TOP_PERCENT = 0.2; // 1st-3rd plus the rest of the top 20%

// Per-movie placement bonuses (ranked by closeness on that movie).
export const MOVIE_PLACEMENT_BONUSES = [50_000, 35_000, 20_000]; // 1st, 2nd, 3rd
export const MOVIE_TOP_PERCENT_BONUS = 10_000;

// Round-wide placement bonuses (ranked by lowest total absolute error; only
// players who guessed every movie are eligible). The marquee prize.
export const CONTEST_PLACEMENT_BONUSES = [175_000, 135_000, 100_000]; // 1st, 2nd, 3rd
export const CONTEST_TOP_PERCENT_BONUS = 50_000;

// Placement bonuses are only paid to guesses that also qualify (within margin).
export const BONUS_REQUIRES_QUALIFY = true;

export interface ScoringMovie {
  id: number;
  actual_revenue: number;
}

export interface ScoringGuess {
  id: number;
  user_id: number;
  movie_id: number;
  guessed_revenue: number;
}

export interface RoundStanding {
  rank: number;
  userId: number;
  totalAbsError: number;
  contestBonus: number; // reward for the overall placement only
  coinsWon: number; // total for the round (per-movie rewards + contest bonus)
}

export interface MovieStanding {
  rank: number;
  userId: number;
  guessedRevenue: number;
  accuracy: number; // accuracy reward (base + precision)
  placement: number; // per-movie placement bonus
  coinsWon: number; // accuracy + placement
}

export interface RoundScoring {
  guessPayout: Map<number, number>; // guessId -> accuracy reward + per-movie placement
  contestBonusByUser: Map<number, number>; // userId -> round-wide bonus
  standings: RoundStanding[]; // eligible players (guessed every movie), best first
  movieStandings: Map<number, MovieStanding[]>; // movieId -> players ranked by closeness
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Relative error of a guess against the actual box office (0 = perfect).
export function guessError(guess: number, actual: number): number {
  if (actual === 0) {
    return guess === 0 ? 0 : 1;
  }
  return Math.abs(guess - actual) / actual;
}

// Competition ranks for an ascending-sorted list: equal values share a rank
// (e.g. 1, 1, 3). `values` must already be sorted ascending.
function rankWithTies(values: number[]): number[] {
  return values.map((value, index) =>
    index > 0 && value === values[index - 1] ? -1 : index + 1
  ).reduce<number[]>((ranks, rank, index) => {
    ranks.push(rank === -1 ? ranks[index - 1] : rank);
    return ranks;
  }, []);
}

// Placement bonuses split equally within each tie group: tied players share the
// place and the pooled bonuses for the positions they span. `eligible(index)`
// gates a whole group (members of a tie group have the same value).
function splitBonuses(
  values: number[],
  positionBonus: (index: number) => number,
  eligible: (index: number) => boolean
): number[] {
  const out = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < values.length) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[i]) {
      j += 1;
    }
    if (eligible(i)) {
      let pool = 0;
      for (let p = i; p <= j; p += 1) {
        pool += positionBonus(p);
      }
      const per = Math.round(pool / (j - i + 1));
      for (let p = i; p <= j; p += 1) {
        out[p] = per;
      }
    }
    i = j + 1;
  }
  return out;
}

export function computeRoundScoring(
  movies: ScoringMovie[],
  guesses: ScoringGuess[]
): RoundScoring {
  const actualByMovie = new Map(movies.map((movie) => [movie.id, movie.actual_revenue]));
  const movieCount = movies.length;

  const guessPayout = new Map<number, number>();
  const accuracyByGuess = new Map<number, number>();
  const placementByGuess = new Map<number, number>();
  const movieStandings = new Map<number, MovieStanding[]>();
  const guessesByMovie = new Map<number, ScoringGuess[]>();
  for (const guess of guesses) {
    const list = guessesByMovie.get(guess.movie_id) || [];
    list.push(guess);
    guessesByMovie.set(guess.movie_id, list);
  }

  for (const movie of movies) {
    const list = guessesByMovie.get(movie.id) || [];
    const scored = list.map((guess) => ({
      guess,
      error: guessError(guess.guessed_revenue, movie.actual_revenue)
    }));

    // Accuracy reward: flat base + precision gradient, for qualifying guesses.
    for (const { guess, error } of scored) {
      if (error <= QUALIFY_MARGIN) {
        const scale = clamp((QUALIFY_MARGIN - error) / QUALIFY_MARGIN, 0, 1);
        const accuracy = BASE_REWARD + Math.round(PRECISION_REWARD * scale);
        accuracyByGuess.set(guess.id, accuracy);
        guessPayout.set(guess.id, accuracy);
      }
    }

    // Per-movie placement bonuses: closest guesses for this movie, ranked by
    // error. Ties share the place and split the pooled bonuses.
    const ranked = [...scored].sort((a, b) => a.error - b.error);
    const errors = ranked.map((item) => item.error);
    const topPercentCount = Math.floor(list.length * TOP_PERCENT);
    const ranks = rankWithTies(errors);
    const bonuses = splitBonuses(
      errors,
      (index) =>
        index < MOVIE_PLACEMENT_BONUSES.length
          ? MOVIE_PLACEMENT_BONUSES[index]
          : index < topPercentCount
            ? MOVIE_TOP_PERCENT_BONUS
            : 0,
      (index) => !BONUS_REQUIRES_QUALIFY || errors[index] <= QUALIFY_MARGIN
    );
    ranked.forEach((item, index) => {
      const bonus = bonuses[index];
      if (bonus > 0) {
        placementByGuess.set(item.guess.id, bonus);
        guessPayout.set(item.guess.id, (guessPayout.get(item.guess.id) || 0) + bonus);
      }
    });

    // Per-movie standings: every guess for this movie, ranked by closeness.
    movieStandings.set(
      movie.id,
      ranked.map((item, index) => ({
        rank: ranks[index],
        userId: item.guess.user_id,
        guessedRevenue: item.guess.guessed_revenue,
        accuracy: accuracyByGuess.get(item.guess.id) || 0,
        placement: placementByGuess.get(item.guess.id) || 0,
        coinsWon: guessPayout.get(item.guess.id) || 0
      }))
    );
  }

  // Round-wide ranking: only players who guessed every movie, by total $ error.
  const userGuessCount = new Map<number, number>();
  const userAbsError = new Map<number, number>();
  for (const guess of guesses) {
    const actual = actualByMovie.get(guess.movie_id) ?? 0;
    userGuessCount.set(guess.user_id, (userGuessCount.get(guess.user_id) || 0) + 1);
    userAbsError.set(
      guess.user_id,
      (userAbsError.get(guess.user_id) || 0) + Math.abs(guess.guessed_revenue - actual)
    );
  }

  const contestBonusByUser = new Map<number, number>();
  const eligible = [...userAbsError.entries()]
    .filter(([userId]) => userGuessCount.get(userId) === movieCount)
    .sort((a, b) => a[1] - b[1]);
  const contestErrors = eligible.map(([, error]) => error);
  const contestTopPercentCount = Math.floor(eligible.length * TOP_PERCENT);
  const contestRanks = rankWithTies(contestErrors);
  const contestBonuses = splitBonuses(
    contestErrors,
    (index) =>
      index < CONTEST_PLACEMENT_BONUSES.length
        ? CONTEST_PLACEMENT_BONUSES[index]
        : index < contestTopPercentCount
          ? CONTEST_TOP_PERCENT_BONUS
          : 0,
    () => true
  );
  eligible.forEach(([userId], index) => {
    if (contestBonuses[index] > 0) {
      contestBonusByUser.set(userId, contestBonuses[index]);
    }
  });

  // Total coins won per user (accuracy + per-movie placement + round bonus).
  const userCoins = new Map<number, number>();
  for (const guess of guesses) {
    const payout = guessPayout.get(guess.id) || 0;
    if (payout > 0) {
      userCoins.set(guess.user_id, (userCoins.get(guess.user_id) || 0) + payout);
    }
  }
  for (const [userId, bonus] of contestBonusByUser) {
    userCoins.set(userId, (userCoins.get(userId) || 0) + bonus);
  }

  const standings: RoundStanding[] = eligible.map(([userId, totalAbsError], index) => ({
    rank: contestRanks[index],
    userId,
    totalAbsError,
    contestBonus: contestBonusByUser.get(userId) || 0,
    coinsWon: userCoins.get(userId) || 0
  }));

  return { guessPayout, contestBonusByUser, standings, movieStandings };
}
