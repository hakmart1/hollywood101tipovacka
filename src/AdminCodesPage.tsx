import { useEffect, useState } from "react";
import { formatDateTime } from "./datetime";

interface AdminCode {
  id: number;
  code: string;
  consumed_date: string | null;
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
    return "redeemed";
  }
  return code.user_id ? "assigned" : "free";
}

export default function AdminCodesPage({ onMessage, timezone }: AdminCodesPageProps) {
  const [codes, setCodes] = useState<AdminCode[] | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function handleRemove(code: AdminCode) {
    const redeemed = code.consumed_date !== null;
    const question = redeemed
      ? `Remove code ${code.code}? The user who redeemed it (${code.user_nickname}) will be deactivated.`
      : `Remove code ${code.code}?`;

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
      <h2>Activation codes</h2>

      <p>
        <button type="button" className="primary" disabled={busy} onClick={() => void handleGenerate()}>
          Generate new code
        </button>
      </p>

      {codes === null ? (
        <p>Loading…</p>
      ) : codes.length === 0 ? (
        <p>No activation codes yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>State</th>
              <th>Redeemed by</th>
              <th>Consumed date</th>
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
                  <button type="button" disabled={busy} onClick={() => void handleRemove(code)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
