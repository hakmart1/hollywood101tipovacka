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

export default function LeaderboardPage({ onMessage, highlightNickname }: LeaderboardPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  // "current" = live leaderboard; otherwise the id of a finished season.
  const [selected, setSelected] = useState<"current" | number>("current");
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

    setLeaderboard(payload.leaderboard || []);
    setSeasons(seasonsPayload.seasons || []);
  }

  async function selectSeason(value: string) {
    if (value === "current") {
      setSelected("current");
      return;
    }
    const seasonId = Number(value);
    setSelected(seasonId);
    if (history[seasonId]) {
      return;
    }
    const response = await fetch(`/api/seasons/${seasonId}`, { headers: { Accept: "application/json" } });
    const payload = (await response.json()) as StandingsResponse;
    if (!response.ok || payload.error) {
      onMessage(payload.error || "Žebříček sezóny se nepodařilo načíst.");
      return;
    }
    setHistory((current) => ({
      ...current,
      [seasonId]: (payload.standings || []).map((standing) => ({
        nickname: standing.nickname,
        rank: standing.rank,
        previous_rank: null,
        rank_balance: standing.balance,
        avatar_hash: standing.avatar_hash,
        avatar_url: standing.avatar_url
      }))
    }));
  }

  if (leaderboard === null) {
    return <Loader />;
  }

  const currentSeason = seasons.find((season) => season.ended_date === null) ?? null;
  const pastSeasons = seasons.filter((season) => season.ended_date !== null);
  const isCurrent = selected === "current";
  const entries = typeof selected === "number" ? history[selected] : leaderboard;
  const selectedSeason =
    typeof selected === "number" ? seasons.find((season) => season.id === selected) : currentSeason;

  return (
    <section className="leaderboard-page">
      <h2>Žebříček hráčů</h2>

      {pastSeasons.length > 0 ? (
        <div className="season-picker">
          <label htmlFor="season-select">Sezóna</label>
          <select
            id="season-select"
            value={isCurrent ? "current" : String(selected)}
            onChange={(event) => void selectSeason(event.target.value)}
          >
            <option value="current">{currentSeason ? `${currentSeason.name} (aktuální)` : "Aktuální sezóna"}</option>
            {pastSeasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>
      ) : currentSeason ? (
        <p className="season-caption">{currentSeason.name}</p>
      ) : null}

      {!isCurrent && selectedSeason?.ended_date ? (
        <p className="season-caption">
          Konečné pořadí · sezóna ukončena {formatDateTime(selectedSeason.ended_date)}
        </p>
      ) : null}

      {entries === undefined ? (
        <Loader />
      ) : entries.length === 0 ? (
        <p className="guess-hint">
          {isCurrent && pastSeasons.length > 0
            ? "Pořadí nové sezóny bude k dispozici po prvním vyhodnocení."
            : "Zatím žádní hráči."}
        </p>
      ) : (
        <div className="card">
          <Leaderboard entries={entries} highlightNickname={highlightNickname} showChange={isCurrent} />
        </div>
      )}
    </section>
  );
}
