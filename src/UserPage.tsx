import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "./App";
import Modal from "./Modal";
import imfCoinImage from "./imf.webp";
import { formatDateTime } from "./datetime";
import { gravatarUrl } from "./gravatar";

interface CoinHistoryEntry {
  id: number;
  amount: number;
  reason: string | null;
  created_date: string;
}

interface CoinsResponse {
  error: string | null;
  history?: CoinHistoryEntry[];
  page?: number;
  page_size?: number;
  total?: number;
  message?: string;
}

interface UserPageProps {
  user: User;
  onMessage: (message: string) => void;
  onSessionRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  onActivate: () => void;
}

const LOW_BALANCE_THRESHOLD = 200_000;

function CoinIcon() {
  return (
    <svg
      className="balance-coin"
      width="56"
      height="56"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <defs>
        {/* portrait fills most of the coin; only a slim ring carries the legend */}
        <clipPath id="imfcoin-face">
          <circle cx="32" cy="32" r="24" />
        </clipPath>
        {/* desaturate, then brighten + raise contrast so the face reads as bright engraving */}
        <filter id="imfcoin-engrave">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.7" intercept="-0.1" />
            <feFuncG type="linear" slope="1.7" intercept="-0.1" />
            <feFuncB type="linear" slope="1.7" intercept="-0.1" />
          </feComponentTransfer>
        </filter>
        {/* top legend sits just outside the portrait; bottom a touch further out so
            neither row crosses the rim edge */}
        <path id="imfcoin-top" d="M 7.2 32 A 24.8 24.8 0 0 1 56.8 32" fill="none" />
        <path id="imfcoin-bottom" d="M 5.5 32 A 26.5 26.5 0 0 0 58.5 32" fill="none" />
      </defs>

      {/* coin body + rim */}
      <circle cx="32" cy="32" r="30" fill="#e8b923" stroke="#b8860b" strokeWidth="2.5" />

      {/* portrait fills the inner circle, stamped into gold */}
      <g clipPath="url(#imfcoin-face)">
        <circle cx="32" cy="32" r="24.5" fill="#dba916" />
        <image
          href={imfCoinImage}
          x="7.5"
          y="6.5"
          width="49"
          height="49"
          preserveAspectRatio="xMidYMid slice"
          filter="url(#imfcoin-engrave)"
          style={{ mixBlendMode: "multiply" }}
        />
      </g>
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#b8860b" strokeWidth="0.8" />
    </svg>
  );
}

export default function UserPage({
  user,
  onMessage,
  onSessionRefresh,
  onLogout,
  onActivate
}: UserPageProps) {
  const [history, setHistory] = useState<CoinHistoryEntry[] | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAvatarFailed(false);
    void gravatarUrl(user.email, 96).then((url) => {
      if (!cancelled) {
        setAvatarUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user.email]);

  useEffect(() => {
    if (user.status === "active") {
      void loadHistory(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory(nextPage: number) {
    const response = await fetch(`/api/coins/history?page=${nextPage}`, {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as CoinsResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Could not load coin history.");
      setHistory([]);
      return;
    }

    setHistory(payload.history || []);
    setPage(payload.page ?? nextPage);
    setPageSize(payload.page_size ?? 10);
    setTotal(payload.total ?? 0);
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
        await loadHistory(0);
      }
    } finally {
      setBusy(false);
    }
  }

  function closePasswordModal() {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwOpen(false);
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPw !== confirmPw) {
      onMessage("Nové heslo a jeho potvrzení se neshodují.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw })
      });
      const payload = (await response.json()) as CoinsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");

      if (!payload.error) {
        closePasswordModal();
      }
    } finally {
      setBusy(false);
    }
  }

  function closeDeleteModal() {
    setDeleteConfirm("");
    setDeleteOpen(false);
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ confirm: deleteConfirm.trim() })
      });
      const payload = (await response.json()) as CoinsResponse;
      onMessage(payload.error || payload.message || "Hotovo.");

      if (!payload.error) {
        closeDeleteModal();
        // The session is gone server-side — reflect that and leave the profile.
        window.location.hash = "#/";
        await onSessionRefresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="user-page">
      <section className="user-card">
        <div className="account-header">
          <div className="account-avatar">
            {avatarUrl && !avatarFailed ? (
              <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span aria-hidden="true">{user.nickname.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="account-identity">
            <span className="account-nickname">{user.nickname}</span>
            <span className="account-email">{user.email}</span>
            <a
              className="account-avatar-hint"
              href="https://gravatar.com"
              target="_blank"
              rel="noreferrer"
            >
              Změnit obrázek přes Gravatar →
            </a>
          </div>
          <div className="account-actions">
            <button type="button" className="ghost" onClick={() => setPwOpen((open) => !open)}>
              {pwOpen ? "Zavřít" : "Změnit heslo"}
            </button>
            <button type="button" className="ghost" onClick={() => void onLogout()}>
              Odhlásit
            </button>
          </div>
        </div>

        <div className="balance-card">
          <CoinIcon />
          <div className="balance-body">
            <span className="balance-label">Imfcoiny</span>
            <span className="balance-value">
              {user.imf_coins_balance.toLocaleString("en-US")}
            </span>
          </div>
        </div>

        {user.status === "active" && user.imf_coins_balance <= LOW_BALANCE_THRESHOLD ? (
          <div className="balance-actions">
            <p className="balance-hint">Tvůj rozpočet je nízký. Požádej Měnový fond o výpomoc.</p>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void handleAskForCoins()}
            >
              Požádat o další Imfcoiny
            </button>
          </div>
        ) : null}
      </section>

      {user.status !== "active" ? (
        <section className="user-card activate-card">
          <div>
            <h2 className="activate-title">Účet není aktivní</h2>
            <p className="activate-hint">
              Pro tipování aktivuj účet pomocí aktivačního kódu od administrátora.
            </p>
          </div>
          <button type="button" className="primary" onClick={onActivate}>
            Aktivovat
          </button>
        </section>
      ) : null}

      {pwOpen ? (
        <Modal title="Změna hesla" onClose={closePasswordModal}>
          <form className="password-form" onSubmit={handleChangePassword}>
            <div className="form-field">
              <label htmlFor="current-pw">Současné heslo</label>
              <input
                id="current-pw"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={currentPw}
                onChange={(event) => setCurrentPw(event.currentTarget.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-pw">Nové heslo</label>
              <input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={newPw}
                onChange={(event) => setNewPw(event.currentTarget.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-pw">Nové heslo znovu</label>
              <input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={confirmPw}
                onChange={(event) => setConfirmPw(event.currentTarget.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={closePasswordModal}>
                Zrušit
              </button>
              <button type="submit" className="primary" disabled={busy}>
                Uložit nové heslo
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {user.status === "active" ? (
      <section className="coin-history">
        <h2>Historie Imfcoinů</h2>
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
        {total > pageSize ? (
          <div className="pager">
            <button type="button" disabled={page <= 0} onClick={() => void loadHistory(page - 1)}>
              ← Předchozí
            </button>
            <span className="pager-info">
              Stránka {page + 1} / {Math.ceil(total / pageSize)}
            </span>
            <button
              type="button"
              disabled={page >= Math.ceil(total / pageSize) - 1}
              onClick={() => void loadHistory(page + 1)}
            >
              Další →
            </button>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="user-card danger-zone">
        <div>
          <h2 className="danger-title">Smazat účet</h2>
          <p className="danger-hint">
            Smaže přihlašovací údaje a anonymizuje tvůj účet. Tuto akci nelze vrátit zpět.
          </p>
        </div>
        <button type="button" className="ghost danger" onClick={() => setDeleteOpen(true)}>
          Smazat účet
        </button>
      </section>

      {deleteOpen ? (
        <Modal title="Smazat účet" onClose={closeDeleteModal}>
          <form onSubmit={handleDeleteAccount}>
            <p className="modal-note">
              Tato akce je nevratná. Odstraní všechny tvé přihlašovací údaje, účet anonymizuje a odstraní ze
              všech žebříčků. Pro potvrzení napiš <strong>Smazat</strong>.
            </p>
            <div className="form-field">
              <label htmlFor="delete-confirm">Potvrzení</label>
              <input
                id="delete-confirm"
                type="text"
                autoFocus
                autoComplete="off"
                placeholder="Smazat"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.currentTarget.value)}
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={closeDeleteModal}>
                Zrušit
              </button>
              <button
                type="submit"
                className="primary danger"
                disabled={busy || deleteConfirm.trim() !== "Smazat"}
              >
                Smazat účet
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
