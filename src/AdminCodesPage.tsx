import { useEffect, useState } from "react";
import { formatDateTime } from "./datetime";

interface AdminCode {
  id: number;
  code: string;
  consumed_date: string | null;
  reserved_date: string | null;
  user_id: number | null;
  user_nickname: string | null;
  user_email: string | null;
  user_status: string | null;
}

interface CodesResponse {
  error: string | null;
  codes?: AdminCode[];
  message?: string;
}

interface AdminCodesPageProps {
  onMessage: (message: string) => void;
  timezone: string | null;
}

function codeState(code: AdminCode): string {
  if (code.consumed_date) {
    return "použitý";
  }
  if (code.user_id) {
    return "přiřazený";
  }
  if (code.reserved_date) {
    return "rezervovaný";
  }
  return "volný";
}

export default function AdminCodesPage({ onMessage, timezone }: AdminCodesPageProps) {
  const [codes, setCodes] = useState<AdminCode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    void loadCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCodes() {
    const response = await fetch("/api/admin/activation-codes", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as CodesResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Could not load activation codes.");
      setCodes([]);
      return;
    }

    setCodes(payload.codes || []);
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/activation-codes", {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as CodesResponse;
      onMessage(payload.error || payload.message || "Done.");
      await loadCodes();
    } finally {
      setBusy(false);
    }
  }

  async function setReserved(code: AdminCode, reserved: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/activation-codes/${code.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ reserved })
      });
      const payload = (await response.json()) as CodesResponse;
      if (payload.error) {
        onMessage(payload.error);
      }
      await loadCodes();
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(code: AdminCode) {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopiedId(code.id);
      setTimeout(() => setCopiedId((current) => (current === code.id ? null : current)), 1500);
    } catch {
      onMessage("Kód se nepodařilo zkopírovat.");
      return;
    }
    // Copying a code means it's likely being handed out — reserve it.
    if (!code.reserved_date) {
      await setReserved(code, true);
    }
  }

  async function handleRemove(code: AdminCode) {
    const redeemed = code.consumed_date !== null;
    const question = redeemed
      ? `Odebrat kód ${code.code}? Uživatel, který jej použil (${code.user_nickname}), bude deaktivován.`
      : `Odebrat kód ${code.code}?`;

    if (!window.confirm(question)) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/activation-codes/${code.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as CodesResponse;
      onMessage(payload.error || payload.message || "Done.");
      await loadCodes();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page">
      <h2>Aktivační kódy</h2>

      <p>
        <button type="button" className="primary" disabled={busy} onClick={() => void handleGenerate()}>
          Vygenerovat nový kód
        </button>
      </p>

      {codes === null ? (
        <p>Načítání…</p>
      ) : codes.length === 0 ? (
        <p>Zatím žádné aktivační kódy.</p>
      ) : (
        <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kód</th>
              <th>Stav</th>
              <th>Použil</th>
              <th>Datum použití</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id}>
                <td className="code">{code.code}</td>
                <td>{codeState(code)}</td>
                <td>
                  {code.user_nickname
                    ? `${code.user_nickname} (${code.user_email}) — ${code.user_status}`
                    : "—"}
                </td>
                <td>{formatDateTime(code.consumed_date, timezone)}</td>
                <td>
                  {!code.consumed_date ? (
                    <>
                      <button type="button" onClick={() => void handleCopy(code)}>
                        {copiedId === code.id ? "Zkopírováno" : "Kopírovat"}
                      </button>{" "}
                      {!code.reserved_date ? (
                        <button type="button" disabled={busy} onClick={() => void setReserved(code, true)}>
                          Rezervovat
                        </button>
                      ) : null}{" "}
                    </>
                  ) : null}
                  <button type="button" disabled={busy} onClick={() => void handleRemove(code)}>
                    Odebrat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
