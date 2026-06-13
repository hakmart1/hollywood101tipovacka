import { useEffect, useState } from "react";
import type { User } from "./App";
import { formatDateTime } from "./datetime";

interface CoinHistoryEntry {
  id: number;
  amount: number;
  reason: string | null;
  created_date: string;
}

interface CoinsResponse {
  error: string | null;
  history?: CoinHistoryEntry[];
  message?: string;
}

interface UserPageProps {
  user: User;
  onMessage: (message: string) => void;
  onSessionRefresh: () => Promise<void>;
}

const LOW_BALANCE_THRESHOLD = 200_000;

export default function UserPage({ user, onMessage, onSessionRefresh }: UserPageProps) {
  const [history, setHistory] = useState<CoinHistoryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    const response = await fetch("/api/coins/history", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as CoinsResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Could not load coin history.");
      setHistory([]);
      return;
    }

    setHistory(payload.history || []);
  }

  async function handleAskForCoins() {
    setBusy(true);
    try {
      const response = await fetch("/api/coins/request", {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as CoinsResponse;
      onMessage(payload.error || payload.message || "Done.");

      if (!payload.error) {
        await onSessionRefresh();
        await loadHistory();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="user-page">
      <section className="user-card">
        <h2>Detail účtu</h2>
        <dl>
          <dt>Id</dt>
          <dd>{user.id}</dd>
          <dt>Přezdívka</dt>
          <dd>{user.nickname}</dd>
          <dt>E-mail</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{user.role}</dd>
          <dt>Stav</dt>
          <dd>{user.status}</dd>
          <dt>IMF mince</dt>
          <dd>{user.imf_coins_balance.toLocaleString("en-US")}</dd>
        </dl>
        {user.status === "active" && user.imf_coins_balance <= LOW_BALANCE_THRESHOLD ? (
          <div className="form-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleAskForCoins()}
            >
              Požádat o další mince
            </button>
          </div>
        ) : null}
      </section>

      <section className="coin-history">
        <h2>Historie IMF mincí</h2>
        {history === null ? (
          <p>Načítání…</p>
        ) : history.length === 0 ? (
          <p>Zatím žádné transakce.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Částka</th>
                <th>Důvod</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_date)}</td>
                  <td className={entry.amount >= 0 ? "amount-plus" : "amount-minus"}>
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount.toLocaleString("en-US")}
                  </td>
                  <td>{entry.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
