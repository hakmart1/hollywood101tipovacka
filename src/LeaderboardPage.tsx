import { useEffect, useState } from "react";
import Leaderboard from "./Leaderboard";
import type { LeaderboardEntry } from "./Leaderboard";

interface ResultsResponse {
  error: string | null;
  leaderboard?: LeaderboardEntry[];
}

interface LeaderboardPageProps {
  onMessage: (message: string) => void;
  highlightNickname: string | null;
}

export default function LeaderboardPage({ onMessage, highlightNickname }: LeaderboardPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

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
      onMessage(payload.error || "Could not load leaderboard.");
      setLeaderboard([]);
      return;
    }

    setLeaderboard(payload.leaderboard || []);
  }

  if (leaderboard === null) {
    return <p>Načítání…</p>;
  }

  return (
    <section className="leaderboard-page">
      <h2>Žebříček hráčů</h2>
      {leaderboard.length === 0 ? (
        <p className="guess-hint">Zatím žádní hráči.</p>
      ) : (
        <div className="card">
          <Leaderboard entries={leaderboard} highlightNickname={highlightNickname} />
        </div>
      )}
    </section>
  );
}
