import { useEffect, useRef, useState } from "react";
import Loader from "./Loader";
import type { FormEvent } from "react";
import {
  addDaysToInput,
  formatDateTime,
  nextMondayInput,
  utcToZonedInput,
  weekTitle,
  zonedToUtcIso
} from "./datetime";
import { useConfirm } from "./useConfirm";

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
  scheduled_evaluation_date: string | null;
  movies: RoundMovie[];
}

interface RoundsResponse {
  error: string | null;
  rounds?: Round[];
  page?: number;
  page_size?: number;
  total?: number;
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
  const { confirm, confirmElement } = useConfirm();
  const [rounds, setRounds] = useState<Round[] | null>(null);
  // null = not yet seeded; once seeded, unevaluated rounds start expanded.
  const [openIds, setOpenIds] = useState<Set<number> | null>(null);
  // Round ids already shown — used to auto-expand newly appeared unevaluated ones.
  const seenIds = useRef<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [movieRows, setMovieRows] = useState<MovieFormRow[]>([emptyMovieRow]);
  const [autoTitle, setAutoTitle] = useState("");
  const [dateEdits, setDateEdits] = useState<
    Record<number, { title: string; from: string; to: string; description: string }>
  >({});
  const [movieEdits, setMovieEdits] = useState<
    Record<
      number,
      { movie_title: string; imdb_url: string; csfd_url: string; poster_url: string; revenue: string }
    >
  >({});
  // datetime-local draft per round while picking a scheduled-evaluation time.
  const [scheduleEdits, setScheduleEdits] = useState<Record<number, string>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
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
    void loadRounds(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRounds(nextPage: number) {
    const response = await fetch(`/api/admin/rounds?page=${nextPage}`, {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as RoundsResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Tipovačky se nepodařilo načíst.");
      setRounds([]);
      return;
    }

    const list = payload.rounds || [];
    setRounds(list);
    // Unevaluated rounds start expanded so they stand out — but only the first
    // time we see them (a just-created one, or a page visited for the first
    // time). Rounds the admin collapsed stay collapsed; seenIds accumulates
    // across pages so navigating back doesn't re-expand them.
    setOpenIds((current) => {
      const next = new Set(current ?? []);
      for (const round of list) {
        if (!round.evaluated_date && !seenIds.current.has(round.id)) {
          next.add(round.id);
        }
      }
      return next;
    });
    for (const round of list) {
      seenIds.current.add(round.id);
    }
    setPage(payload.page ?? nextPage);
    setPageSize(payload.page_size ?? 10);
    setTotal(payload.total ?? 0);
  }

  async function handleDeleteContest(round: Round) {
    if (
      !(await confirm({
        title: "Smazat tipovačku",
        message: `Smazat tipovačku „${round.title}“?`,
        confirmLabel: "Smazat",
        danger: true
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        await loadRounds(page);
      }
    } finally {
      setBusy(false);
    }
  }

  function startEditDates(round: Round) {
    setDateEdits((current) => ({
      ...current,
      [round.id]: {
        title: round.title,
        from: utcToZonedInput(round.date_from, timezone),
        to: utcToZonedInput(round.date_to, timezone),
        description: round.description ?? ""
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
      onMessage("Vyplňte začátek i konec tipovačky.");
      return;
    }
    if (!edit.title.trim()) {
      onMessage("Název tipovačky je povinný.");
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
          title: edit.title.trim(),
          date_from: zonedToUtcIso(edit.from, timezone),
          date_to: zonedToUtcIso(edit.to, timezone),
          description: edit.description.trim()
        })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        cancelEditDates(round.id);
        await loadRounds(page);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEvaluate(round: Round) {
    if (
      !(await confirm({
        title: "Vyhodnotit tipovačku",
        message: `Vyhodnotit „${round.title}“? Tím se tipovačka uzavře.`,
        confirmLabel: "Vyhodnotit"
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        await loadRounds(page);
      }
    } finally {
      setBusy(false);
    }
  }

  function startSchedule(round: Round) {
    setScheduleEdits((current) => ({
      ...current,
      [round.id]: round.scheduled_evaluation_date
        ? utcToZonedInput(round.scheduled_evaluation_date, timezone)
        : utcToZonedInput(new Date().toISOString(), timezone)
    }));
  }

  function cancelScheduleEdit(roundId: number) {
    setScheduleEdits((current) => {
      const next = { ...current };
      delete next[roundId];
      return next;
    });
  }

  async function saveSchedule(round: Round) {
    const value = scheduleEdits[round.id];
    if (!value) {
      onMessage("Zadejte datum a čas vyhodnocení.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ scheduled_evaluation_date: zonedToUtcIso(value, timezone) })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        cancelScheduleEdit(round.id);
        await loadRounds(page);
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelSchedule(round: Round) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/rounds/${round.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ scheduled_evaluation_date: null })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        await loadRounds(page);
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
      onMessage(payload.error || payload.message || "Hotovo.");

      if (!payload.error) {
        // Keep the chosen type as the default for the next round.
        setForm({ ...emptyForm, type: form.type });
        setMovieRows([emptyMovieRow]);
        setAutoTitle("");
        setFormOpen(false);
        await loadRounds(0);
      }
    } finally {
      setBusy(false);
    }
  }

  // Stored box office is in full dollars; show it in millions (1 decimal).
  function formatRevenue(value: number | null): string {
    return value !== null
      ? `${(value / 1_000_000).toLocaleString("cs-CZ", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        })} M`
      : "—";
  }

  function startEditMovie(movie: RoundMovie) {
    setMovieEdits((current) => ({
      ...current,
      [movie.id]: {
        movie_title: movie.movie_title,
        imdb_url: movie.imdb_url || "",
        csfd_url: movie.csfd_url || "",
        poster_url: movie.poster_url || "",
        revenue: movie.actual_revenue !== null ? String(movie.actual_revenue / 1_000_000) : ""
      }
    }));
  }

  function cancelEditMovie(movieId: number) {
    setMovieEdits((current) => {
      const next = { ...current };
      delete next[movieId];
      return next;
    });
  }

  function updateMovieEdit(
    movieId: number,
    field: "movie_title" | "imdb_url" | "csfd_url" | "poster_url" | "revenue",
    value: string
  ) {
    setMovieEdits((current) => ({
      ...current,
      [movieId]: { ...current[movieId], [field]: value }
    }));
  }

  async function saveMovie(movie: RoundMovie) {
    const edit = movieEdits[movie.id];
    if (!edit) {
      return;
    }
    if (!edit.movie_title.trim()) {
      onMessage("Název filmu je povinný.");
      return;
    }

    // Box office is entered in millions (1 decimal) and stored in full dollars,
    // like the players' guesses. An empty field clears the result.
    const raw = edit.revenue.trim();
    let revenue: number | null = null;
    if (raw !== "") {
      const millions = Number(raw);
      if (!Number.isFinite(millions) || millions < 0) {
        onMessage("Tržby zadejte v milionech, např. 10,1.");
        return;
      }
      if (millions > 9999.9) {
        onMessage("Tržby mohou být nejvýše 9999,9 M.");
        return;
      }
      revenue = Math.round(millions * 10) * 100_000;
    }

    // Clearing an existing result is destructive — confirm it.
    if (revenue === null && movie.actual_revenue !== null) {
      if (
        !(await confirm({
          title: "Odebrat tržby",
          message: `Odebrat tržby filmu „${movie.movie_title}“?`,
          confirmLabel: "Odebrat",
          danger: true
        }))
      ) {
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
        body: JSON.stringify({
          movie_title: edit.movie_title,
          imdb_url: edit.imdb_url,
          csfd_url: edit.csfd_url,
          poster_url: edit.poster_url,
          actual_revenue: revenue
        })
      });
      const payload = (await response.json()) as RoundsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        cancelEditMovie(movie.id);
        await loadRounds(page);
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleForm() {
    // Opening a fresh form: prefill start = upcoming Monday 06:00, end = the day
    // before the +2-day mark at 23:59 (one minute before midnight, so it reads as
    // the previous day, not 00:00 of the next).
    if (!formOpen) {
      const monday = nextMondayInput(timezone).slice(0, 10);
      const start = `${monday}T06:00`;
      const end = `${addDaysToInput(`${monday}T00:00`, 1).slice(0, 10)}T23:59`;
      applyDateFrom(start);
      setForm((current) => ({ ...current, date_to: end }));
    }
    setFormOpen((open) => !open);
  }

  return (
    <section className="admin-page">
      <p>
        <button type="button" className="primary" onClick={toggleForm}>
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
                    type="text"
                    placeholder="www.imdb.com/title/..."
                    value={row.imdb_url}
                    onChange={(event) => updateMovieRow(index, "imdb_url", event.currentTarget.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Odkaz ČSFD</label>
                  <input
                    type="text"
                    placeholder="www.csfd.cz/film/..."
                    value={row.csfd_url}
                    onChange={(event) => updateMovieRow(index, "csfd_url", event.currentTarget.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Odkaz na plakát</label>
                  <input
                    type="text"
                    placeholder="https://... nebo data:image/..."
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
        <Loader />
      ) : rounds.length === 0 ? (
        <p>Zatím žádné tipovačky.</p>
      ) : (
        rounds.map((round) => {
          const isFinished = new Date(round.date_to).getTime() < Date.now();
          const notStarted = new Date(round.date_from).getTime() > Date.now();
          // Status dot: not started yet = red, running/ended without a scheduled
          // evaluation = yellow, scheduled evaluation = green.
          const dotClass = round.scheduled_evaluation_date
            ? "scheduled"
            : notStarted
              ? "notstarted"
              : "";
          const dotLabel = round.scheduled_evaluation_date
            ? "Vyhodnocení naplánováno"
            : notStarted
              ? "Tipování ještě nezačalo"
              : "Nevyhodnoceno";
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

          const open = openIds?.has(round.id) ?? false;
          return (
            <section className="round-card" key={round.id}>
              <button
                type="button"
                className="round-toggle"
                onClick={() =>
                  setOpenIds((current) => {
                    const next = new Set(current ?? []);
                    if (next.has(round.id)) {
                      next.delete(round.id);
                    } else {
                      next.add(round.id);
                    }
                    return next;
                  })
                }
              >
                <span className="round-toggle-title">
                  {!round.evaluated_date ? (
                    <span
                      className={`round-pending${dotClass ? ` ${dotClass}` : ""}`}
                      title={dotLabel}
                      aria-label={dotLabel}
                    >
                      ●
                    </span>
                  ) : null}
                  {round.type === "bonus" ? "[Bonus] " : ""}
                  {round.title}
                </span>
                <span className="round-toggle-meta">
                  {formatDateTime(round.date_from, timezone)} –{" "}
                  {formatDateTime(round.date_to, timezone)}
                  {round.evaluated_date
                    ? ` · vyhodnoceno ${formatDateTime(round.evaluated_date, timezone)}`
                    : round.scheduled_evaluation_date
                      ? ` · ⏱ vyhodnocení ${formatDateTime(round.scheduled_evaluation_date, timezone)}`
                      : ""}
                </span>
                <span className="archive-toggle">{open ? "▲" : "▼"}</span>
              </button>

              {open ? (
              <div className="round-body">
              {round.description ? <p>{round.description}</p> : null}

              {!round.evaluated_date ? (
              <div className="round-actions">
                {editing ? (
                  <span className="date-edit">
                    <input
                      type="text"
                      className="round-title-edit"
                      placeholder="Název tipovačky"
                      value={editing.title}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setDateEdits((current) => ({
                          ...current,
                          [round.id]: { ...current[round.id], title: value }
                        }));
                      }}
                    />
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
                    <input
                      type="text"
                      className="round-desc-edit"
                      placeholder="Popisek (nepovinné)"
                      value={editing.description}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setDateEdits((current) => ({
                          ...current,
                          [round.id]: { ...current[round.id], description: value }
                        }));
                      }}
                    />
                    <button type="button" className="primary" disabled={busy} onClick={() => void saveDates(round)}>
                      Uložit
                    </button>
                    <button type="button" disabled={busy} onClick={() => cancelEditDates(round.id)}>
                      Zrušit
                    </button>
                  </span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => startEditDates(round)}>
                    Upravit
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

                {scheduleEdits[round.id] !== undefined ? (
                  <span className="date-edit">
                    <input
                      type="datetime-local"
                      value={scheduleEdits[round.id]}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setScheduleEdits((current) => ({ ...current, [round.id]: value }));
                      }}
                    />
                    <button type="button" className="primary" disabled={busy} onClick={() => void saveSchedule(round)}>
                      Uložit plán
                    </button>
                    <button type="button" disabled={busy} onClick={() => cancelScheduleEdit(round.id)}>
                      Zrušit
                    </button>
                  </span>
                ) : round.scheduled_evaluation_date ? (
                  <span className="schedule-info">
                    Naplánováno: {formatDateTime(round.scheduled_evaluation_date, timezone)}
                    <button type="button" disabled={busy} onClick={() => startSchedule(round)}>
                      Změnit
                    </button>
                    <button type="button" disabled={busy} onClick={() => void cancelSchedule(round)}>
                      Zrušit plán
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !!round.evaluated_date || !isFinished || !allResultsFilled}
                    title={evaluateReason}
                    onClick={() => startSchedule(round)}
                  >
                    Naplánovat
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy || round.guess_count > 0}
                  title={round.guess_count > 0 ? "Tipovačka už má tipy" : "Smazat tipovačku"}
                  onClick={() => void handleDeleteContest(round)}
                >
                  Smazat
                </button>
              </div>
              ) : null}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Film</th>
                  <th>Odkazy</th>
                  <th>Skutečné tržby</th>
                  {!round.evaluated_date ? <th>Akce</th> : null}
                </tr>
              </thead>
              <tbody>
                {round.movies.map((movie) => {
                  const editing = movieEdits[movie.id];
                  return (
                  <tr key={movie.id}>
                    <td>
                      {editing ? (
                        <input
                          value={editing.movie_title}
                          onChange={(event) =>
                            updateMovieEdit(movie.id, "movie_title", event.currentTarget.value)
                          }
                        />
                      ) : (
                        movie.movie_title
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <div className="movie-edit">
                          <input
                            type="text"
                            placeholder="Odkaz IMDB"
                            value={editing.imdb_url}
                            onChange={(event) =>
                              updateMovieEdit(movie.id, "imdb_url", event.currentTarget.value)
                            }
                          />
                          <input
                            type="text"
                            placeholder="Odkaz ČSFD"
                            value={editing.csfd_url}
                            onChange={(event) =>
                              updateMovieEdit(movie.id, "csfd_url", event.currentTarget.value)
                            }
                          />
                          <input
                            type="text"
                            placeholder="Odkaz na plakát (URL nebo data:image/...)"
                            value={editing.poster_url}
                            onChange={(event) =>
                              updateMovieEdit(movie.id, "poster_url", event.currentTarget.value)
                            }
                          />
                        </div>
                      ) : (
                        <div className="movie-links-admin">
                          {movie.poster_url ? (
                            movie.poster_url.startsWith("data:") ? (
                              <img
                                className="movie-poster-mini"
                                src={movie.poster_url}
                                alt={movie.movie_title}
                                loading="lazy"
                              />
                            ) : (
                              <a href={movie.poster_url} target="_blank" rel="noreferrer">
                                <img
                                  className="movie-poster-mini"
                                  src={movie.poster_url}
                                  alt={movie.movie_title}
                                  loading="lazy"
                                />
                              </a>
                            )
                          ) : (
                            <span
                              className="movie-poster-mini movie-poster-empty"
                              title="Plakát chybí"
                              aria-label="Plakát chybí"
                            />
                          )}
                          {movie.imdb_url ? (
                            <a
                              href={movie.imdb_url}
                              target="_blank"
                              rel="noreferrer"
                              className="logo-badge imdb"
                            >
                              IMDb
                            </a>
                          ) : (
                            <span className="logo-badge missing" title="Odkaz IMDb chybí">
                              IMDb
                            </span>
                          )}
                          {movie.csfd_url ? (
                            <a
                              href={movie.csfd_url}
                              target="_blank"
                              rel="noreferrer"
                              className="logo-badge csfd"
                            >
                              ČSFD
                            </a>
                          ) : (
                            <span className="logo-badge missing" title="Odkaz ČSFD chybí">
                              ČSFD
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          type="number"
                          className="revenue-input"
                          min={0}
                          max={9999.9}
                          step={0.1}
                          placeholder="miliony, např. 10,1"
                          value={editing.revenue}
                          onChange={(event) =>
                            updateMovieEdit(movie.id, "revenue", event.currentTarget.value)
                          }
                        />
                      ) : (
                        <span>{formatRevenue(movie.actual_revenue)}</span>
                      )}
                    </td>
                    {!round.evaluated_date ? (
                      <td>
                        {editing ? (
                          <div className="movie-edit-actions">
                            <button
                              type="button"
                              className="primary"
                              disabled={busy}
                              onClick={() => void saveMovie(movie)}
                            >
                              Uložit
                            </button>
                            <button type="button" disabled={busy} onClick={() => cancelEditMovie(movie.id)}>
                              Zrušit
                            </button>
                          </div>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => startEditMovie(movie)}>
                            Upravit
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                  );
                })}
              </tbody>
            </table>
              </div>
              ) : null}
          </section>
          );
        })
      )}

      {total > pageSize ? (
        <div className="pager">
          <button type="button" disabled={page <= 0} onClick={() => void loadRounds(page - 1)}>
            ← Předchozí
          </button>
          <span className="pager-info">
            Stránka {page + 1} / {Math.ceil(total / pageSize)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / pageSize) - 1}
            onClick={() => void loadRounds(page + 1)}
          >
            Další →
          </button>
        </div>
      ) : null}
      {confirmElement}
    </section>
  );
}
