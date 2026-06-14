import { useEffect, useState } from "react";
import Leaderboard from "./Leaderboard";
import type { LeaderboardEntry } from "./Leaderboard";
import { formatMillions, MovieNameCell } from "./RoundResultView";
import type { RoundResult } from "./RoundResultView";
import { formatDateTime } from "./datetime";

interface ResultsResponse {
  error: string | null;
  results?: RoundResult[];
  leaderboard?: LeaderboardEntry[];
}

interface HomeResultsProps {
  onMessage: (message: string) => void;
  highlightNickname: string | null;
}

export default function HomeResults({ onMessage, highlightNickname }: HomeResultsProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [lastRound, setLastRound] = useState<RoundResult | null>(null);

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
      onMessage(payload.error || "Výsledky se nepodařilo načíst.");
      setLeaderboard([]);
      return;
    }

    setLeaderboard(payload.leaderboard || []);
    setLastRound(payload.results && payload.results.length > 0 ? payload.results[0] : null);
  }

  if (leaderboard === null) {
    return null;
  }

  return (
    <div className="home-results home-tables">
      {lastRound ? (
        <div className="home-table-col">
          <h2>Filmy z poslední tipovačky</h2>
          <div className="card">
            <p className="card-caption">
              {lastRound.title} · vyhodnoceno {formatDateTime(lastRound.evaluated_date)}
            </p>
            <table className="data-table films-table">
              <thead>
                <tr>
                  <th>Film</th>
                  <th className="num-col">Tržby</th>
                  {highlightNickname ? <th className="num-col">Můj tip</th> : null}
                </tr>
              </thead>
              <tbody>
                {lastRound.movies.map((movie) => {
                  const mine = highlightNickname
                    ? movie.standings.find((standing) => standing.nickname === highlightNickname)
                    : undefined;
                  return (
                    <tr key={movie.id}>
                      <td>
                        <MovieNameCell posterUrl={movie.poster_url} title={movie.movie_title} />
                      </td>
                      <td>{formatMillions(movie.actual_revenue)}</td>
                      {highlightNickname ? (
                        <td>{mine ? formatMillions(mine.guess) : "—"}</td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="more-link">
            <a href="#/results">Více ve výsledcích →</a>
          </p>
        </div>
      ) : null}

      <div className="home-table-col">
        <h2>Žebříček hráčů</h2>
        {leaderboard.length === 0 ? (
          <p className="guess-hint">Zatím žádní hráči.</p>
        ) : (
          <>
            <div className="card">
              <Leaderboard
                entries={leaderboard}
                highlightNickname={highlightNickname}
                limit={10}
                showCoins={false}
              />
            </div>
            <p className="more-link">
              <a href="#/poradi">Celý žebříček →</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
