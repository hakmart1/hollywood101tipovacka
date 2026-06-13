import { formatDateTime } from "./datetime";

export interface MovieStanding {
  rank: number;
  nickname: string;
  guess: number;
  accuracy: number;
  placement: number;
  coins_won: number;
}

export interface ResultMovie {
  id: number;
  movie_title: string;
  actual_revenue: number;
  standings: MovieStanding[];
}

export interface Standing {
  rank: number;
  nickname: string;
  total_error: number;
  contest_bonus: number;
  coins_won: number;
}

export interface RoundResult {
  id: number;
  title: string;
  date_from: string;
  date_to: string;
  evaluated_date: string;
  type: "standard" | "bonus";
  movies: ResultMovie[];
  standings: Standing[];
}

export function formatMillions(dollars: number): string {
  return `${(dollars / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} M`;
}

export function formatCoins(amount: number): string {
  return amount.toLocaleString("en-US");
}

export default function RoundResultView({ result }: { result: RoundResult }) {
  return (
    <section className="round-card">
      <h3>
        {result.title}{" "}
        <span className="round-dates">(vyhodnoceno {formatDateTime(result.evaluated_date)})</span>
      </h3>

      <table className="data-table">
        <thead>
          <tr>
            <th>Film</th>
            <th>Tržby</th>
          </tr>
        </thead>
        <tbody>
          {result.movies.map((movie) => (
            <tr key={movie.id}>
              <td>{movie.movie_title}</td>
              <td>{formatMillions(movie.actual_revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Celkové pořadí</h4>
      {result.standings.length === 0 ? (
        <p className="guess-hint">Žádní způsobilí hráči (nikdo netipnul všechny filmy).</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Hráč</th>
              <th>Celková odchylka</th>
              <th>Bonus za pořadí</th>
            </tr>
          </thead>
          <tbody>
            {result.standings.map((standing) => (
              <tr key={standing.nickname}>
                <td>{standing.rank}</td>
                <td>{standing.nickname}</td>
                <td>{formatMillions(standing.total_error)}</td>
                <td className={standing.contest_bonus > 0 ? "amount-plus" : undefined}>
                  {standing.contest_bonus > 0 ? "+" : ""}
                  {formatCoins(standing.contest_bonus)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4>Vyhodnocení filmů</h4>
      {result.movies.map((movie) => (
        <div className="movie-result" key={movie.id}>
          <h5>
            {movie.movie_title}{" "}
            <span className="round-dates">(tržby {formatMillions(movie.actual_revenue)})</span>
          </h5>
          {movie.standings.length === 0 ? (
            <p className="guess-hint">Žádné tipy.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hráč</th>
                  <th>Tip</th>
                  <th>Odchylka</th>
                  <th>Získané mince</th>
                </tr>
              </thead>
              <tbody>
                {movie.standings.map((standing) => (
                  <tr key={standing.nickname}>
                    <td>{standing.rank}</td>
                    <td>{standing.nickname}</td>
                    <td>{formatMillions(standing.guess)}</td>
                    <td>{formatMillions(Math.abs(standing.guess - movie.actual_revenue))}</td>
                    <td className={standing.coins_won > 0 ? "amount-plus" : undefined}>
                      {standing.coins_won > 0 ? "+" : ""}
                      {formatCoins(standing.coins_won)}
                      {standing.placement > 0 ? (
                        <span className="coins-breakdown">
                          {" "}
                          ({formatCoins(standing.accuracy)} + {formatCoins(standing.placement)})
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </section>
  );
}
