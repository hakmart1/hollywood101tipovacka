import { useEffect, useState } from "react";
import { formatDateTime } from "./datetime";
import { useConfirm } from "./useConfirm";

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
};

function CopyIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

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

interface CodeRequest {
  id: number;
  nickname: string;
  email: string | null;
  last_code_request_date: string;
}

interface CodesResponse {
  error: string | null;
  codes?: AdminCode[];
  message?: string;
}

interface RequestsResponse {
  error: string | null;
  requests?: CodeRequest[];
}

interface AdminCodesPageProps {
  onMessage: (message: string) => void;
  timezone: string | null;
  onPendingRequestsChange?: (count: number) => void;
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

export default function AdminCodesPage({
  onMessage,
  timezone,
  onPendingRequestsChange
}: AdminCodesPageProps) {
  const { confirm, confirmElement } = useConfirm();
  const [codes, setCodes] = useState<AdminCode[] | null>(null);
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    void loadCodes();
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRequests() {
    const response = await fetch("/api/admin/code-requests", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as RequestsResponse;
    if (!response.ok || payload.error) {
      return;
    }
    const list = payload.requests || [];
    setRequests(list);
    onPendingRequestsChange?.(list.length);
  }

  async function dismissRequest(request: CodeRequest) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/code-requests/${request.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as RequestsResponse;
      if (payload.error) {
        onMessage(payload.error);
      } else {
        await loadRequests();
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadCodes() {
    const response = await fetch("/api/admin/activation-codes", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as CodesResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Aktivační kódy se nepodařilo načíst.");
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
      onMessage(payload.error || payload.message || "Hotovo.");
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
    const message = redeemed
      ? `Odebrat kód ${code.code}? Uživatel, který jej použil (${code.user_nickname}), bude deaktivován.`
      : `Odebrat kód ${code.code}?`;

    if (!(await confirm({ title: "Odebrat kód", message, confirmLabel: "Odebrat", danger: true }))) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/admin/activation-codes/${code.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });
      const payload = (await response.json()) as CodesResponse;
      onMessage(payload.error || payload.message || "Hotovo.");
      await loadCodes();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-page">
      {requests.length > 0 ? (
        <div className="code-requests">
          <h3>
            Čekající žádosti o kód <span className="code-requests-count">{requests.length}</span>
          </h3>
          <ul>
            {requests.map((request) => (
              <li key={request.id}>
                <span className="code-request-info">
                  <strong>{request.nickname}</strong>
                  {request.email ? ` (${request.email})` : ""} ·{" "}
                  {formatDateTime(request.last_code_request_date, timezone)}
                </span>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Odebrat žádost"
                  aria-label="Odebrat žádost"
                  disabled={busy}
                  onClick={() => void dismissRequest(request)}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                  {code.user_nickname ? `${code.user_nickname} (${code.user_email})` : "—"}
                </td>
                <td>{formatDateTime(code.consumed_date, timezone)}</td>
                <td>
                  <div className="code-actions">
                    {!code.consumed_date ? (
                      <button
                        type="button"
                        className="icon-btn"
                        title={copiedId === code.id ? "Zkopírováno" : "Kopírovat kód"}
                        aria-label="Kopírovat kód"
                        onClick={() => void handleCopy(code)}
                      >
                        {copiedId === code.id ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Odebrat"
                      aria-label="Odebrat"
                      disabled={busy}
                      onClick={() => void handleRemove(code)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {confirmElement}
    </section>
  );
}
