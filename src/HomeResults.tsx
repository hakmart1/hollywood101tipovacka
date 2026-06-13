import { useEffect, useState } from "react";
import RoundResultView, { formatCoins } from "./RoundResultView";
import type { RoundResult } from "./RoundResultView";

interface LeaderboardEntry {
  nickname: string;
  rank: number;
  previous_rank: number | null;
  rank_balance: number | null;
}

function renderChange(previousRank: number | null, currentRank: number) {
  if (previousRank === null) {
    return <span className="rank-new">nový</span>;
  }
  const delta = previousRank - currentRank;
  if (delta > 0) {
    return <span className="rank-up">▲ {delta}</span>;
  }
  if (delta < 0) {
    return <span className="rank-down">▼ {-delta}</span>;
  }
  return <span className="rank-same">–</span>;
}

interface ResultsResponse {
  error: string | null;
  results?: RoundResult[];
  leaderboard?: LeaderboardEntry[];
}

interface HomeResultsProps {
  onMessage: (message: string) => void;
}

export default function HomeResults({ onMessage }: HomeResultsProps) {
  const [results, setResults] = useState<RoundResult[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const response = await fetch("/api/results", {
      headers: { Accept: "application/json" }
    });
    const payload = (await response.json()) as ResultsResponse;

    if (!response.ok || payload.error) {
      onMessage(payload.error || "Could not load results.");
      setResults([]);
      return;
    }

    setResults(payload.results || []);
    setLeaderboard(payload.leaderboard || []);
  }

  if (results === null) {
    return null;
  }

  return (
    <div className="home-results">
      {results.length > 0 ? (
        <>
          <h2>Nejnovější výsledky</h2>
          {results.map((result) => (
            <RoundResultView key={result.id} result={result} />
          ))}
        </>
      ) : null}

      <h2>Žebříček hráčů</h2>
      {leaderboard.length === 0 ? (
        <p className="guess-hint">Zatím žádní hráči.</p>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Změna</th>
                <th>Hráč</th>
                <th>IMF mince</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.nickname}>
                  <td>{entry.rank}</td>
                  <td>{renderChange(entry.previous_rank, entry.rank)}</td>
                  <td>{entry.nickname}</td>
                  <td>{formatCoins(entry.rank_balance ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
