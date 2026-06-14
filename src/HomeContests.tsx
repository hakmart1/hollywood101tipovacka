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

export default function HomeContests({ user, onMessage, onSessionRefresh }: HomeContestsProps) {
  const [contests, setContests] = useState<Contest[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

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

  const nowMs = Date.now();
  const sorted = [...contests].sort((a, b) => {
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
      {sorted.map((contest) => {
        const closed = new Date(contest.date_to).getTime() < nowMs;
        return (
        <section className="round-card" key={contest.id}>
          <h3>{contest.title}</h3>
          <p className="round-dates">
            {closed
              ? `Tipování uzavřeno (${formatDateTime(contest.date_to)}) – čeká na vyhodnocení`
              : `Otevřeno do ${formatDateTime(contest.date_to)}${
                  contest.type === "standard" ? " – Tržby za otvírací víkend" : ""
                }`}
          </p>
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
    </section>
  );
}
