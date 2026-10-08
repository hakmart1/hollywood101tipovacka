import { useEffect, useState } from "react";
import Loader from "./Loader";
import { formatDateTime } from "./datetime";
import { useConfirm } from "./useConfirm";

interface Season {
  id: number;
  name: string;
  started_date: string;
  ended_date: string | null;
}

interface SeasonsResponse {
  error: string | null;
  seasons?: Season[];
  message?: string;
}

interface AdminSeasonsPageProps {
  onMessage: (message: string) => void;
  timezone: string | null;
}

export default function AdminSeasonsPage({ onMessage, timezone }: AdminSeasonsPageProps) {
  const { confirm, confirmElement } = useConfirm();
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [rename, setRename] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const response = await fetch("/api/seasons", { headers: { Accept: "application/json" } });
    const payload = (await response.json()) as SeasonsResponse;
    if (!response.ok || payload.error) {
      onMessage(payload.error || "Sezóny se nepodařilo načíst.");
      setSeasons([]);
      return;
    }
    const list = payload.seasons || [];
    setSeasons(list);
    setRename(list.find((season) => season.ended_date === null)?.name ?? "");
  }

  async function saveName(season: Season) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/seasons/${season.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: rename.trim() })
      });
      const payload = (await response.json()) as SeasonsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function endSeason(current: Season) {
    const name = newName.trim();
    if (!name) {
      onMessage("Zadejte název nové sezóny.");
      return;
    }
    const ok = await confirm({
      title: "Ukončit sezónu",
      message:
        `Ukončit sezónu „${current.name}" a začít „${name}"? Uloží se konečné pořadí do historie ` +
        "žebříčku a všem aktivovaným hráčům se zůstatek nastaví na 2 000 000 Imfcoinů. " +
        "Akci nelze vrátit.",
      confirmLabel: "Ukončit a začít novou",
      danger: true
    });
    if (!ok) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name })
      });
      const payload = (await response.json()) as SeasonsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        setNewName("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (seasons === null) {
    return <Loader />;
  }

  const current = seasons.find((season) => season.ended_date === null) ?? null;
  const past = seasons.filter((season) => season.ended_date !== null);

  return (
    <section className="admin-page">
      {current ? (
        <div className="card season-admin-card">
          <h3>Aktuální sezóna</h3>
          <p className="season-caption">Běží od {formatDateTime(current.started_date, timezone)}</p>
          <div className="form-field">
            <label htmlFor="season-rename">Název</label>
            <div className="season-row">
              <input
                id="season-rename"
                type="text"
                maxLength={60}
                value={rename}
                onChange={(event) => setRename(event.target.value)}
              />
              <button
                type="button"
                disabled={busy || !rename.trim() || rename.trim() === current.name}
                onClick={() => void saveName(current)}
              >
                Uložit název
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="guess-hint">Žádná sezóna právě neběží.</p>
      )}

      {current ? (
        <div className="card season-admin-card">
          <h3>Ukončit sezónu a začít novou</h3>
          <p className="season-caption">
            Uloží konečné pořadí sezóny „{current.name}" do historie žebříčku a všem aktivovaným hráčům
            nastaví zůstatek na 2 000 000 Imfcoinů. Nejde, dokud není vyhodnocená každá už rozběhnutá
            tipovačka.
          </p>
          <div className="form-field">
            <label htmlFor="season-new">Název nové sezóny</label>
            <div className="season-row">
              <input
                id="season-new"
                type="text"
                maxLength={60}
                placeholder="např. Sezóna 2"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
              <button
                type="button"
                className="primary danger"
                disabled={busy || !newName.trim()}
                onClick={() => void endSeason(current)}
              >
                Ukončit a začít novou
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div className="card season-admin-card">
          <h3>Minulé sezóny</h3>
          <ul className="season-list">
            {past.map((season) => (
              <li key={season.id}>
                <strong>{season.name}</strong> · {formatDateTime(season.started_date, timezone)} –{" "}
                {formatDateTime(season.ended_date, timezone)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {confirmElement}
    </section>
  );
}
