import { useEffect, useState } from "react";
import RoundResultView from "./RoundResultView";
import type { RoundResult } from "./RoundResultView";
import { formatDateTime } from "./datetime";

interface HistoryRound {
  id: number;
  title: string;
  date_from: string;
  date_to: string;
  evaluated_date: string;
  type: "standard" | "bonus";
}

interface HistoryResponse {
  error: string | null;
  rounds?: HistoryRound[];
  page?: number;
  page_size?: number;
  total?: number;
}

interface DetailResponse {
  error: string | null;
  result?: RoundResult;
}

interface ResultsArchivePageProps {
  onMessage: (message: string) => void;
  highlightNickname: string | null;
}

export default function ResultsArchivePage({ onMessage, highlightNickname }: ResultsArchivePageProps) {
  const [rounds, setRounds] = useState<HistoryRound[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RoundResult | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    void loadHistory(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory(nextPage: number) {
    const response = await fetch(`/api/results/history?page=${nextPage}`, {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as HistoryResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Minulé tipovačky se nepodařilo načíst.");
      setRounds([]);
      return;
    }

    setRounds(payload.rounds || []);
    setOpenId(null);
    setDetail(null);
    setPage(payload.page ?? nextPage);
    setPageSize(payload.page_size ?? 10);
    setTotal(payload.total ?? 0);
  }

  async function toggle(round: HistoryRound) {
    if (openId === round.id) {
      setOpenId(null);
      setDetail(null);
      return;
    }

    setOpenId(round.id);
    setDetail(null);

    const response = await fetch(`/api/results/${round.id}`, {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as DetailResponse;

    if (!response.ok || payload.error || !payload.result) {
      onMessage(payload.error || "Výsledek tipovačky se nepodařilo načíst.");
      return;
    }

    setDetail(payload.result);
  }

  if (rounds === null) {
    return <p>Načítání…</p>;
  }

  return (
    <section className="archive-page">
      <h2>Minulé tipovačky</h2>
      {rounds.length === 0 ? (
        <p className="guess-hint">Zatím žádné dokončené tipovačky.</p>
      ) : (
        <ul className="archive-list">
          {rounds.map((round) => (
            <li key={round.id}>
              <button type="button" className="archive-row" onClick={() => void toggle(round)}>
                <span className="archive-title">{round.title}</span>
                <span className="archive-meta">
                  {round.type === "bonus" ? "Bonusová tipovačka" : "Standardní tipovačka"} ·
                  vyhodnoceno {formatDateTime(round.evaluated_date)}
                </span>
                <span className="archive-toggle">{openId === round.id ? "▲" : "▼"}</span>
              </button>
              {openId === round.id ? (
                detail && detail.id === round.id ? (
                  <RoundResultView result={detail} highlightNickname={highlightNickname} />
                ) : (
                  <p className="guess-hint">Načítání…</p>
                )
              ) : null}
            </li>
          ))}
        </ul>
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
  );
}
