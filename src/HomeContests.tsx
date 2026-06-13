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

function formatMillions(revenue: number): string {
  return `${(revenue / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
      onMessage("Enter your guess in millions, e.g. 123.45.");
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
          step={0.01}
          placeholder="miliony, např. 123,45"
          value={drafts[movie.id] ?? ""}
          onChange={(event) => {
            const { value } = event.currentTarget;
            setDrafts((current) => ({ ...current, [movie.id]: value }));
          }}
        />
        <button type="button" className="primary" disabled={busy} onClick={() => void placeGuess(movie)}>
          Tipnout ({GUESS_COST.toLocaleString("en-US")} mincí)
        </button>
      </div>
    );
  }

  if (contests === null) {
    return null;
  }

  if (contests.length === 0) {
    return <p className="no-contest">Žádná aktivní tipovačka.</p>;
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
    <>
      {sorted.map((contest) => {
        const closed = new Date(contest.date_to).getTime() < nowMs;
        return (
        <section className="round-card" key={contest.id}>
          <h2>{contest.title}</h2>
          <p className="round-dates">
            {closed
              ? `Tipování uzavřeno (${formatDateTime(contest.date_to)}) – čeká na vyhodnocení`
              : `Otevřeno do ${formatDateTime(contest.date_to)}`}
          </p>
          {contest.description ? <p>{contest.description}</p> : null}
          {!closed ? (
            <p className="guess-caption">
              Tipněte celkové tržby každého filmu. Každý tip stojí{" "}
              {GUESS_COST.toLocaleString("en-US")} mincí a je konečný.
            </p>
          ) : null}
          <table className="data-table">
            <thead>
              <tr>
                <th>Film</th>
                <th>Odkazy</th>
                <th>Váš tip (tržby)</th>
              </tr>
            </thead>
            <tbody>
              {contest.movies.map((movie) => (
                <tr key={movie.id}>
                  <td>{movie.movie_title}</td>
                  <td>
                    {movie.imdb_url ? (
                      <a href={movie.imdb_url} target="_blank" rel="noreferrer">
                        IMDB
                      </a>
                    ) : null}{" "}
                    {movie.csfd_url ? (
                      <a href={movie.csfd_url} target="_blank" rel="noreferrer">
                        CSFD
                      </a>
                    ) : null}{" "}
                    {movie.poster_url ? (
                      <a href={movie.poster_url} target="_blank" rel="noreferrer">
                        Plakát
                      </a>
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
    </>
  );
}
