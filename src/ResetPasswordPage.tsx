import { useState } from "react";
import type { FormEvent } from "react";

interface ResetResponse {
  error: string | null;
  message?: string;
}

function readResetToken(): string {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) {
    return "";
  }
  return new URLSearchParams(hash.slice(queryIndex + 1)).get("token") || "";
}

export default function ResetPasswordPage({ onMessage }: { onMessage: (message: string) => void }) {
  const [token] = useState(readResetToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      onMessage("Nové heslo a jeho potvrzení se neshodují.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, new_password: password })
      });
      const payload = (await response.json()) as ResetResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      if (!payload.error) {
        setDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="user-page">
      <section className="user-card">
        <h2 className="password-title">Obnovení hesla</h2>
        {!token ? (
          <p className="guess-hint">Odkaz pro obnovení hesla je neplatný.</p>
        ) : done ? (
          <p>
            Heslo bylo změněno. <a href="#/">Zpět na úvod</a> a přihlas se novým heslem.
          </p>
        ) : (
          <form className="password-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="reset-pw">Nové heslo</label>
              <input
                id="reset-pw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="reset-pw2">Nové heslo znovu</label>
              <input
                id="reset-pw2"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={confirm}
                onChange={(event) => setConfirm(event.currentTarget.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="primary" disabled={busy}>
                Nastavit nové heslo
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
