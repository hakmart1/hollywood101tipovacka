import { useEffect, useState } from "react";
import Loader from "./Loader";
import Leaderboard from "./Leaderboard";
import type { LeaderboardEntry } from "./Leaderboard";
import { formatDateTime } from "./datetime";

interface ResultsResponse {
  error: string | null;
  leaderboard?: LeaderboardEntry[];
}

interface Season {
  id: number;
  name: string;
  started_date: string;
  ended_date: string | null;
}

interface SeasonsResponse {
  error: string | null;
  seasons?: Season[];
}

interface StandingsResponse {
  error: string | null;
  standings?: {
    rank: number;
    nickname: string;
    balance: number;
    avatar_hash: string | null;
    avatar_url: string | null;
  }[];
}

interface LeaderboardPageProps {
  onMessage: (message: string) => void;
  highlightNickname: string | null;
}

// Seasons as an accordion, styled like the results archive: the current season
// (live leaderboard) is open by default, past seasons show their final standings.
export default function LeaderboardPage({ onMessage, highlightNickname }: LeaderboardPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, LeaderboardEntry[]>>({});

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [resultsResponse, seasonsResponse] = await Promise.all([
      fetch("/api/results", { headers: { Accept: "application/json" } }),
      fetch("/api/seasons", { headers: { Accept: "application/json" } })
    ]);
    const payload = (await resultsResponse.json()) as ResultsResponse;
    const seasonsPayload = (await seasonsResponse.json()) as SeasonsResponse;

    if (!resultsResponse.ok || payload.error) {
      onMessage(payload.error || "Žebříček se nepodařilo načíst.");
      setLeaderboard([]);
      return;
    }

    const list = seasonsPayload.seasons || [];
    setLeaderboard(payload.leaderboard || []);
    setSeasons(list);
    setOpenId(list.find((season) => season.ended_date === null)?.id ?? null);
  }

  async function toggle(season: Season) {
    if (openId === season.id) {
      setOpenId(null);
      return;
    }
    setOpenId(season.id);
    if (season.ended_date === null || history[season.id]) {
      return;
    }

    const response = await fetch(`/api/seasons/${season.id}`, { headers: { Accept: "application/json" } });
    const payload = (await response.json()) as StandingsResponse;
    if (!response.ok || payload.error) {
      onMessage(payload.error || "Žebříček sezóny se nepodařilo načíst.");
      return;
    }
    setHistory((current) => ({
      ...current,
      [season.id]: (payload.standings || []).map((standing) => ({
        nickname: standing.nickname,
        rank: standing.rank,
        previous_rank: null,
        rank_balance: standing.balance,
        avatar_hash: standing.avatar_hash,
        avatar_url: standing.avatar_url
      }))
    }));
  }

  function renderStandings(season: Season) {
    const isCurrent = season.ended_date === null;
    const entries = isCurrent ? leaderboard : history[season.id];

    if (!entries) {
      return <Loader />;
    }
    if (entries.length === 0) {
      return (
        <p className="guess-hint">
          {isCurrent ? "Pořadí sezóny bude k dispozici po prvním vyhodnocení." : "V této sezóně nikdo nehrál."}
        </p>
      );
    }
    return <Leaderboard entries={entries} highlightNickname={highlightNickname} showChange={isCurrent} />;
  }

  if (leaderboard === null) {
    return <Loader />;
  }

  return (
    <section className="leaderboard-page">
      <h2>Žebříček hráčů</h2>

      {seasons.length === 0 ? (
        // Seasons couldn't be loaded — still show the live leaderboard.
        leaderboard.length === 0 ? (
          <p className="guess-hint">Zatím žádní hráči.</p>
        ) : (
          <div className="card">
            <Leaderboard entries={leaderboard} highlightNickname={highlightNickname} />
          </div>
        )
      ) : (
        <ul className="archive-list">
          {seasons.map((season) => (
            <li key={season.id}>
              <button type="button" className="archive-row" onClick={() => void toggle(season)}>
                <span className="archive-title">{season.name}</span>
                <span className="archive-meta">
                  {season.ended_date === null
                    ? `Aktuální sezóna · od ${formatDateTime(season.started_date)}`
                    : `Konečné pořadí · ukončena ${formatDateTime(season.ended_date)}`}
                </span>
                <span className="archive-toggle">{openId === season.id ? "▲" : "▼"}</span>
              </button>
              {openId === season.id ? <div className="round-card">{renderStandings(season)}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
