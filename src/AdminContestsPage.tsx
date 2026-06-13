import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { formatDateTime, utcToZonedInput, weekTitle, zonedToUtcIso } from "./datetime";

interface RoundMovie {
  id: number;
  movie_title: string;
  poster_url: string | null;
  csfd_url: string | null;
  imdb_url: string | null;
  actual_revenue: number | null;
}

type RoundType = "standard" | "bonus";

interface Round {
  id: number;
  title: string;
  date_from: string;
  date_to: string;
  description: string | null;
  type: RoundType;
  guess_count: number;
  evaluated_date: string | null;
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
  type: "standard" as RoundType,
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
  const [autoTitle, setAutoTitle] = useState("");
  const [dateEdits, setDateEdits] = useState<Record<number, { from: string; to: string }>>({});
  const [busy, setBusy] = useState(false);

  // Prefill the title as "YYYY Week WW" from the start date, unless the admin
  // has typed his own title (i.e. it no longer matches the last suggestion).
  function applyDateFrom(value: string) {
    const suggested = value ? weekTitle(value) : "";
    setForm((current) => {
      const keepManual = current.title.trim() !== "" && current.title !== autoTitle;
      return {
        ...current,
        date_from: value,
        title: keepManual ? current.title : suggested
      };
    });
    setAutoTitle(suggested);
  }

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
      onMessage(payload.error || "Could not load rounds.");
      setRounds([]);
      return;
    }

    setRounds(payload.rounds || []);
  }

  async function handleDeleteContest(round: Round) {
    if (!window.confirm(`Smazat tipovačku „${round.title}“?`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Done.");
      if (!payload.error) {
        await loadRounds();
      }
    } finally {
      setBusy(false);
    }
  }

  function startEditDates(round: Round) {
    setDateEdits((current) => ({
      ...current,
      [round.id]: {
        from: utcToZonedInput(round.date_from, timezone),
        to: utcToZonedInput(round.date_to, timezone)
      }
    }));
  }

  function cancelEditDates(roundId: number) {
    setDateEdits((current) => {
      const next = { ...current };
      delete next[roundId];
      return next;
    });
  }

  async function saveDates(round: Round) {
    const edit = dateEdits[round.id];
    if (!edit || !edit.from || !edit.to) {
      onMessage("Both start and end date-times are required.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          date_from: zonedToUtcIso(edit.from, timezone),
          date_to: zonedToUtcIso(edit.to, timezone)
        })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Done.");
      if (!payload.error) {
        cancelEditDates(round.id);
        await loadRounds();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEvaluate(round: Round) {
    if (!window.confirm(`Vyhodnotit „${round.title}“? Tím se tipovačka uzavře.`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Done.");
      if (!payload.error) {
        await loadRounds();
      }
    } finally {
      setBusy(false);
    }
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
          type: form.type,
          date_from: zonedToUtcIso(form.date_from, timezone),
          date_to: zonedToUtcIso(form.date_to, timezone),
          description: form.description,
          movies: movieRows
        })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Done.");

      if (!payload.error) {
        // Keep the chosen type as the default for the next round.
        setForm({ ...emptyForm, type: form.type });
        setMovieRows([emptyMovieRow]);
        setAutoTitle("");
        setFormOpen(false);
        await loadRounds();
      }
    } finally {
      setBusy(false);
    }
  }

  // Box office is entered in millions (2 decimals), like the players' guesses.
  // Stored value is in full dollars, so show it divided by a million.
  function effectiveRevenue(movie: RoundMovie): string {
    const draft = revenueDrafts[movie.id];
    if (draft !== undefined) {
      return draft;
    }
    return movie.actual_revenue !== null ? String(movie.actual_revenue / 1_000_000) : "";
  }

  // Button label/action reflects what saving will actually do.
  function revenueAction(movie: RoundMovie): { label: string; disabled: boolean } {
    const value = effectiveRevenue(movie).trim();
    const hasResult = movie.actual_revenue !== null;
    if (hasResult && value === "") {
      return { label: "Odebrat", disabled: busy };
    }
    if (hasResult) {
      return { label: "Upravit", disabled: busy };
    }
    return { label: "Uložit", disabled: busy || value === "" };
  }

  async function handleSaveRevenue(movie: RoundMovie) {
    const raw = effectiveRevenue(movie).trim();
    let revenue: number | null = null;

    if (raw !== "") {
      const millions = Number(raw);
      if (!Number.isFinite(millions) || millions < 0) {
        onMessage("Tržby zadejte v milionech, např. 123,45.");
        return;
      }
      // Convert millions (2 decimals) to full dollars, like the guesses.
      revenue = Math.round(millions * 100) * 10_000;
    }

    // Clearing an existing result is destructive — confirm it.
    if (revenue === null && movie.actual_revenue !== null) {
      if (!window.confirm(`Odebrat tržby filmu „${movie.movie_title}“?`)) {
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
      <h2>Tipovačky</h2>

      <p>
        <button type="button" className="primary" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? "Zavřít formulář" : "Nová tipovačka"}
        </button>
      </p>

      {formOpen ? (
        <form className="contest-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="contest-title">Název</label>
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
            <label htmlFor="contest-type">Typ</label>
            <select
              id="contest-type"
              value={form.type}
              onChange={(event) => {
                const value = event.currentTarget.value as RoundType;
                setForm((current) => ({ ...current, type: value }));
              }}
            >
              <option value="standard">Standardní</option>
              <option value="bonus">Bonusová</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contest-date-from">Začátek (datum a čas)</label>
              <input
                id="contest-date-from"
                type="datetime-local"
                required
                value={form.date_from}
                onChange={(event) => applyDateFrom(event.currentTarget.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="contest-date-to">Konec (datum a čas)</label>
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
            <label htmlFor="contest-description">Popis (nepovinné)</label>
            <input
              id="contest-description"
              value={form.description}
              onChange={(event) => {
                const { value } = event.currentTarget;
                setForm((current) => ({ ...current, description: value }));
              }}
            />
          </div>

          <h3>Filmy</h3>
          {movieRows.map((row, index) => (
            <fieldset className="movie-row" key={index}>
              <legend>Film {index + 1}</legend>
              <div className="form-field">
                <label>Název</label>
                <input
                  required
                  value={row.movie_title}
                  onChange={(event) => updateMovieRow(index, "movie_title", event.currentTarget.value)}
                />
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Odkaz IMDB</label>
                  <input
                    type="url"
                    placeholder="https://www.imdb.com/title/..."
                    value={row.imdb_url}
                    onChange={(event) => updateMovieRow(index, "imdb_url", event.currentTarget.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Odkaz ČSFD</label>
                  <input
                    type="url"
                    placeholder="https://www.csfd.cz/film/..."
                    value={row.csfd_url}
                    onChange={(event) => updateMovieRow(index, "csfd_url", event.currentTarget.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Odkaz na plakát</label>
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
                  Odebrat film
                </button>
              ) : null}
            </fieldset>
          ))}

          <p>
            <button type="button" onClick={() => setMovieRows((current) => [...current, emptyMovieRow])}>
              Přidat film
            </button>
          </p>

          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              Vytvořit tipovačku
            </button>
          </div>
        </form>
      ) : null}

      {rounds === null ? (
        <p>Načítání…</p>
      ) : rounds.length === 0 ? (
        <p>Zatím žádné tipovačky.</p>
      ) : (
        rounds.map((round) => {
          const isFinished = new Date(round.date_to).getTime() < Date.now();
          const allResultsFilled =
            round.movies.length > 0 && round.movies.every((movie) => movie.actual_revenue !== null);
          const editing = dateEdits[round.id];
          const evaluateReason = round.evaluated_date
            ? "Již vyhodnoceno"
            : !isFinished
              ? "Tipovačka ještě neskončila"
              : !allResultsFilled
                ? "Nejprve vyplňte všechny tržby"
                : "Vyhodnotit tipovačku";

          return (
            <section className="round-card" key={round.id}>
              <h3>
                {round.type === "bonus" ? "[Bonus] " : ""}
                {round.title}{" "}
                <span className="round-dates">
                  ({formatDateTime(round.date_from, timezone)} –{" "}
                  {formatDateTime(round.date_to, timezone)})
                </span>
              </h3>

              {round.evaluated_date ? (
                <p className="round-status evaluated">
                  Vyhodnoceno {formatDateTime(round.evaluated_date, timezone)}
                </p>
              ) : null}

              {round.description ? <p>{round.description}</p> : null}

              <div className="round-actions">
                {editing ? (
                  <span className="date-edit">
                    <input
                      type="datetime-local"
                      value={editing.from}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setDateEdits((current) => ({
                          ...current,
                          [round.id]: { ...current[round.id], from: value }
                        }));
                      }}
                    />
                    <input
                      type="datetime-local"
                      value={editing.to}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setDateEdits((current) => ({
                          ...current,
                          [round.id]: { ...current[round.id], to: value }
                        }));
                      }}
                    />
                    <button type="button" className="primary" disabled={busy} onClick={() => void saveDates(round)}>
                      Uložit časy
                    </button>
                    <button type="button" disabled={busy} onClick={() => cancelEditDates(round.id)}>
                      Zrušit
                    </button>
                  </span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => startEditDates(round)}>
                    Upravit časy
                  </button>
                )}

                <button
                  type="button"
                  className="primary"
                  disabled={busy || !!round.evaluated_date || !isFinished || !allResultsFilled}
                  title={evaluateReason}
                  onClick={() => void handleEvaluate(round)}
                >
                  Vyhodnotit
                </button>

                <button
                  type="button"
                  disabled={busy || round.guess_count > 0}
                  title={round.guess_count > 0 ? "Tipovačka už má tipy" : "Smazat tipovačku"}
                  onClick={() => void handleDeleteContest(round)}
                >
                  Smazat
                </button>
              </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Film</th>
                  <th>Odkazy</th>
                  <th>Skutečné tržby</th>
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
                          Plakát
                        </a>
                      ) : null}
                    </td>
                    <td>
                      <div className="revenue-edit">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="miliony, např. 123,45"
                          value={effectiveRevenue(movie)}
                          onChange={(event) => {
                            const { value } = event.currentTarget;
                            setRevenueDrafts((current) => ({ ...current, [movie.id]: value }));
                          }}
                        />
                        <button
                          type="button"
                          disabled={revenueAction(movie).disabled}
                          onClick={() => void handleSaveRevenue(movie)}
                        >
                          {revenueAction(movie).label}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          );
        })
      )}
    </section>
  );
}
