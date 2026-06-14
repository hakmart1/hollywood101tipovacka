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
  poster_url: string | null;
  actual_revenue: number;
  standings: MovieStanding[];
}

export function MoviePosterMini({ posterUrl, title }: { posterUrl: string | null; title: string }) {
  if (!posterUrl) {
    // Keep the layout aligned with movies that do have a poster.
    return <span className="movie-poster-mini movie-poster-empty" aria-hidden="true" />;
  }
  return <img className="movie-poster-mini" src={posterUrl} alt={title} loading="lazy" />;
}

export function MovieNameCell({ posterUrl, title }: { posterUrl: string | null; title: string }) {
  return (
    <span className="movie-name-cell">
      <MoviePosterMini posterUrl={posterUrl} title={title} />
      {title}
    </span>
  );
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
  return `${(dollars / 1_000_000).toLocaleString("cs-CZ", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} M`;
}

export function formatCoins(amount: number): string {
  return amount.toLocaleString("en-US");
}

export default function RoundResultView({
  result,
  highlightNickname
}: {
  result: RoundResult;
  highlightNickname?: string | null;
}) {
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
            {highlightNickname ? <th>Můj tip</th> : null}
          </tr>
        </thead>
        <tbody>
          {result.movies.map((movie) => {
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
              <tr
                key={standing.nickname}
                className={standing.nickname === highlightNickname ? "is-me" : undefined}
              >
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
          <h5 className="movie-result-title">
            <MoviePosterMini posterUrl={movie.poster_url} title={movie.movie_title} />
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
                  <th>Získané Imfcoiny</th>
                </tr>
              </thead>
              <tbody>
                {movie.standings.map((standing) => (
                  <tr
                    key={standing.nickname}
                    className={standing.nickname === highlightNickname ? "is-me" : undefined}
                  >
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
