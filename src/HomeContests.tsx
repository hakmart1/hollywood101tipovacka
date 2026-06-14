import { useEffect, useState } from "react";
import type { User } from "./App";
import { formatDateTime } from "./datetime";

interface ContestMovie {
  id: number;
  movie_title: string;
  poster_url: string | null;
  csfd_url: string | null;
  imdb_url: string | null;
  my_guess: number | null;
}

interface Contest {
  id: number;
  title: string;
  date_from: string;
  date_to: string;
  description: string | null;
  type: "standard" | "bonus";
  scheduled_evaluation_date: string | null;
  movies: ContestMovie[];
}

interface ContestsResponse {
  error: string | null;
  contests?: Contest[];
  message?: string;
}

interface HomeContestsProps {
  user: User | null;
  onMessage: (message: string) => void;
  onSessionRefresh: () => Promise<void>;
}

const GUESS_COST = 100_000;

function isLinkablePoster(url: string): boolean {
  // data: URIs are the image itself — opening them in a new tab is pointless.
  return !url.startsWith("data:");
}

function formatMillions(revenue: number): string {
  return `${(revenue / 1_000_000).toLocaleString("cs-CZ", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} M`;
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} d ${clock}` : clock;
}

export default function HomeContests({ user, onMessage, onSessionRefresh }: HomeContestsProps) {
  const [contests, setContests] = useState<Contest[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second to drive the evaluation countdown.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function load() {
    const response = await fetch("/api/contests", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as ContestsResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Could not load contests.");
      setContests([]);
      return;
    }

    setContests(payload.contests || []);
  }

  async function placeGuess(movie: ContestMovie) {
    const draft = (drafts[movie.id] ?? "").trim();
    const millions = Number(draft);
    if (draft === "" || !Number.isFinite(millions) || millions < 0) {
      onMessage("Zadejte tip v milionech, např. 10,1.");
      return;
    }
    if (millions > 9999.9) {
      onMessage("Tip může být nejvýše 9999,9 M.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/contests/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ movie_id: movie.id, guessed_millions: millions })
      });
      const payload = (await response.json()) as ContestsResponse;
      onMessage(payload.error || payload.message || "Done.");

      if (!payload.error) {
        setDrafts((current) => {
          const next = { ...current };
          delete next[movie.id];
          return next;
        });
        await onSessionRefresh();
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function renderGuessCell(movie: ContestMovie, closed: boolean) {
    if (movie.my_guess !== null) {
      return <span className="guess-placed">{formatMillions(movie.my_guess)}</span>;
    }

    if (closed) {
      return <span className="guess-hint">Tipování uzavřeno.</span>;
    }

    if (!user) {
      return <span className="guess-hint">Pro účast se přihlaste.</span>;
    }

    if (user.status !== "active") {
      return <span className="guess-hint">Pro účast aktivujte svůj účet.</span>;
    }

    return (
      <div className="guess-edit">
        <input
          type="number"
          min={0}
          max={9999.9}
          step={0.1}
          placeholder="miliony, např. 10,1"
          value={drafts[movie.id] ?? ""}
          onChange={(event) => {
            const { value } = event.currentTarget;
            setDrafts((current) => ({ ...current, [movie.id]: value }));
          }}
        />
        <button type="button" className="primary" disabled={busy} onClick={() => void placeGuess(movie)}>
          Tipnout ({GUESS_COST.toLocaleString("en-US")} Imfcoinů)
        </button>
      </div>
    );
  }

  if (contests === null) {
    return null;
  }

  if (contests.length === 0) {
    return (
      <section className="home-contests">
        <h2>Aktivní tipovačky</h2>
        <p className="no-contest">Žádná aktivní tipovačka.</p>
      </section>
    );
  }

  const nowMs = now;
  const started = contests.filter((contest) => new Date(contest.date_from).getTime() <= nowMs);
  const upcoming = contests
    .filter((contest) => new Date(contest.date_from).getTime() > nowMs)
    .sort((a, b) => new Date(a.date_from).getTime() - new Date(b.date_from).getTime());
  const sorted = [...started].sort((a, b) => {
    const aClosed = new Date(a.date_to).getTime() < nowMs;
    const bClosed = new Date(b.date_to).getTime() < nowMs;
    if (aClosed !== bClosed) {
      return aClosed ? 1 : -1;
    }
    return new Date(a.date_to).getTime() - new Date(b.date_to).getTime();
  });

  return (
    <section className="home-contests">
      <h2>Aktivní tipovačky</h2>

      {sorted.length === 0 ? <p className="no-contest">Žádná aktivní tipovačka.</p> : null}
      {sorted.map((contest) => {
        const closed = new Date(contest.date_to).getTime() < nowMs;
        const scheduledMs = contest.scheduled_evaluation_date
          ? new Date(contest.scheduled_evaluation_date).getTime()
          : null;
        return (
        <section className="round-card" key={contest.id}>
          <h3>{contest.title}</h3>
          {closed ? (
            <>
              <p className="round-dates">
                Tipování uzavřeno ({formatDateTime(contest.date_to)})
              </p>
              {scheduledMs !== null ? (
                nowMs < scheduledMs ? (
                  <p className="eval-countdown">
                    Vyhodnocení <span className="eval-clock">za {formatCountdown(scheduledMs - nowMs)}</span>{" "}
                    ({formatDateTime(contest.scheduled_evaluation_date)})
                  </p>
                ) : (
                  <p className="eval-countdown soon">Vyhodnocení proběhne každou chvíli…</p>
                )
              ) : (
                <p className="round-dates">Čeká na vyhodnocení</p>
              )}
            </>
          ) : (
            <p className="round-dates">
              {`Otevřeno do ${formatDateTime(contest.date_to)}${
                contest.type === "standard" ? " – Tržby za otvírací víkend" : ""
              }`}
            </p>
          )}
          {contest.description ? <p>{contest.description}</p> : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Plakát</th>
                <th>Film</th>
                <th>Váš tip (tržby)</th>
              </tr>
            </thead>
            <tbody>
              {contest.movies.map((movie) => (
                <tr key={movie.id}>
                  <td>
                    {movie.poster_url ? (
                      isLinkablePoster(movie.poster_url) ? (
                        <a href={movie.poster_url} target="_blank" rel="noreferrer">
                          <img
                            className="movie-poster"
                            src={movie.poster_url}
                            alt={movie.movie_title}
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <img
                          className="movie-poster"
                          src={movie.poster_url}
                          alt={movie.movie_title}
                          loading="lazy"
                        />
                      )
                    ) : (
                      <span className="movie-poster movie-poster-empty" aria-hidden="true" />
                    )}
                  </td>
                  <td>
                    {movie.movie_title}
                    {movie.imdb_url || movie.csfd_url ? (
                      <span className="movie-links">
                        {movie.imdb_url ? (
                          <a
                            href={movie.imdb_url}
                            target="_blank"
                            rel="noreferrer"
                            className="logo-badge imdb"
                          >
                            IMDb
                          </a>
                        ) : null}
                        {movie.csfd_url ? (
                          <a
                            href={movie.csfd_url}
                            target="_blank"
                            rel="noreferrer"
                            className="logo-badge csfd"
                          >
                            ČSFD
                          </a>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                  <td>{renderGuessCell(movie, closed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        );
      })}

      {upcoming.length > 0 ? (
        <div className="upcoming-contests">
          {upcoming.map((contest) => {
            const startMs = new Date(contest.date_from).getTime();
            return (
              <div className="upcoming-item" key={contest.id}>
                <span className="upcoming-title">
                  {contest.type === "bonus" ? "[Bonus] " : ""}
                  {contest.title}
                </span>
                <span className="upcoming-countdown">
                  začíná za <span className="eval-clock">{formatCountdown(startMs - nowMs)}</span>{" "}
                  ({formatDateTime(contest.date_from)})
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
