import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatDateTime, zonedToUtcIso } from "./datetime";

interface RoundMovie {
  id: number;
  movie_title: string;
  poster_url: string | null;
  csfd_url: string | null;
  imdb_url: string | null;
  actual_revenue: number | null;
}

interface Round {
  id: number;
  season_key: string;
  title: string;
  date_from: string;
  date_to: string;
  description: string | null;
  movies: RoundMovie[];
}

interface RoundsResponse {
  error: string | null;
  rounds?: Round[];
  message?: string;
}

interface MovieFormRow {
  movie_title: string;
  imdb_url: string;
  csfd_url: string;
  poster_url: string;
}

interface AdminContestsPageProps {
  onMessage: (message: string) => void;
  timezone: string | null;
}

const emptyMovieRow: MovieFormRow = {
  movie_title: "",
  imdb_url: "",
  csfd_url: "",
  poster_url: ""
};

const emptyForm = {
  title: "",
  season_key: "",
  date_from: "",
  date_to: "",
  description: ""
};

export default function AdminContestsPage({ onMessage, timezone }: AdminContestsPageProps) {
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [movieRows, setMovieRows] = useState<MovieFormRow[]>([emptyMovieRow]);
  const [revenueDrafts, setRevenueDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadRounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRounds() {
    const response = await fetch("/api/admin/rounds", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as RoundsResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Could not load contests.");
      setRounds([]);
      return;
    }

    setRounds(payload.rounds || []);
  }

  function updateMovieRow(index: number, field: keyof MovieFormRow, value: string) {
    setMovieRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          title: form.title,
          season_key: form.season_key,
          date_from: zonedToUtcIso(form.date_from, timezone),
          date_to: zonedToUtcIso(form.date_to, timezone),
          description: form.description,
          movies: movieRows
        })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Done.");

      if (!payload.error) {
        setForm(emptyForm);
        setMovieRows([emptyMovieRow]);
        setFormOpen(false);
        await loadRounds();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRevenue(movie: RoundMovie) {
    const draft = (revenueDrafts[movie.id] ?? "").trim();
    let revenue: number | null = null;

    if (draft !== "") {
      revenue = Number(draft);
      if (!Number.isInteger(revenue) || revenue < 0) {
        onMessage("Box office result must be a non-negative whole number.");
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/movies/${movie.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ actual_revenue: revenue })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Done.");

      if (!payload.error) {
        setRevenueDrafts((current) => {
          const next = { ...current };
          delete next[movie.id];
          return next;
        });
        await loadRounds();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page">
      <h2>Guessing contests</h2>

      <p>
        <button type="button" className="primary" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? "Close form" : "New contest"}
        </button>
      </p>

      {formOpen ? (
        <form className="contest-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="contest-title">Title</label>
            <input
              id="contest-title"
              required
              value={form.title}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setForm((current) => ({ ...current, title: value }));
              }}
            />
          </div>
          <div className="form-field">
            <label htmlFor="contest-season-key">Season key (optional, derived from title)</label>
            <input
              id="contest-season-key"
              value={form.season_key}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setForm((current) => ({ ...current, season_key: value }));
              }}
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contest-date-from">Start (date &amp; time)</label>
              <input
                id="contest-date-from"
                type="datetime-local"
                required
                value={form.date_from}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setForm((current) => ({ ...current, date_from: value }));
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="contest-date-to">End (date &amp; time)</label>
              <input
                id="contest-date-to"
                type="datetime-local"
                required
                value={form.date_to}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  setForm((current) => ({ ...current, date_to: value }));
                }}
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="contest-description">Description (optional)</label>
            <input
              id="contest-description"
              value={form.description}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setForm((current) => ({ ...current, description: value }));
              }}
            />
          </div>

          <h3>Movies</h3>
          {movieRows.map((row, index) => (
            <fieldset className="movie-row" key={index}>
              <legend>Movie {index + 1}</legend>
              <div className="form-field">
                <label>Title</label>
                <input
                  required
                  value={row.movie_title}
                  onChange={(event) => updateMovieRow(index, "movie_title", event.currentTarget.value)}
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>IMDB link</label>
                  <input
                    type="url"
                    placeholder="https://www.imdb.com/title/..."
                    value={row.imdb_url}
                    onChange={(event) => updateMovieRow(index, "imdb_url", event.currentTarget.value)}
                  />
                </div>
                <div className="form-field">
                  <label>CSFD link</label>
                  <input
                    type="url"
                    placeholder="https://www.csfd.cz/film/..."
                    value={row.csfd_url}
                    onChange={(event) => updateMovieRow(index, "csfd_url", event.currentTarget.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Poster link</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={row.poster_url}
                    onChange={(event) => updateMovieRow(index, "poster_url", event.currentTarget.value)}
                  />
                </div>
              </div>
              {movieRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setMovieRows((current) => current.filter((_, i) => i !== index))}
                >
                  Remove movie
                </button>
              ) : null}
            </fieldset>
          ))}

          <p>
            <button type="button" onClick={() => setMovieRows((current) => [...current, emptyMovieRow])}>
              Add movie
            </button>
          </p>

          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              Create contest
            </button>
          </div>
        </form>
      ) : null}

      {rounds === null ? (
        <p>Loading…</p>
      ) : rounds.length === 0 ? (
        <p>No contests yet.</p>
      ) : (
        rounds.map((round) => (
          <section className="round-card" key={round.id}>
            <h3>
              {round.title}{" "}
              <span className="round-dates">
                ({formatDateTime(round.date_from, timezone)} –{" "}
                {formatDateTime(round.date_to, timezone)}, key: {round.season_key})
              </span>
            </h3>
            {round.description ? <p>{round.description}</p> : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Movie</th>
                  <th>Links</th>
                  <th>Box office result</th>
                </tr>
              </thead>
              <tbody>
                {round.movies.map((movie) => (
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
                          Poster
                        </a>
                      ) : null}
                    </td>
                    <td>
                      <div className="revenue-edit">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="—"
                          value={revenueDrafts[movie.id] ?? movie.actual_revenue ?? ""}
                          onChange={(event) => {
                            const { value } = event.currentTarget;
                            setRevenueDrafts((current) => ({ ...current, [movie.id]: value }));
                          }}
                        />
                        <button type="button" disabled={busy} onClick={() => void handleSaveRevenue(movie)}>
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </section>
  );
}
