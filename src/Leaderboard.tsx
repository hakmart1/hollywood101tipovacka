import { formatCoins } from "./RoundResultView";

export interface LeaderboardEntry {
  nickname: string;
  rank: number;
  previous_rank: number | null;
  rank_balance: number | null;
  avatar_hash?: string | null;
}

function PlayerCell({ nickname, avatarHash }: { nickname: string; avatarHash?: string | null }) {
  return (
    <span className="player-cell">
      <span className="player-avatar" aria-hidden="true">
        {avatarHash ? (
          <img
            src={`https://www.gravatar.com/avatar/${avatarHash}?s=48&d=blank`}
            alt=""
            loading="lazy"
          />
        ) : null}
        <span className="player-avatar-fallback">{nickname.slice(0, 1).toUpperCase()}</span>
      </span>
      {nickname}
    </span>
  );
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

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightNickname?: string | null;
  limit?: number;
  showCoins?: boolean;
}

export default function Leaderboard({
  entries,
  highlightNickname,
  limit,
  showCoins = true
}: LeaderboardProps) {
  const rows = limit ? entries.slice(0, limit) : entries;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Změna</th>
          <th>Hráč</th>
          {showCoins ? <th>Imfcoiny</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <tr
            key={entry.nickname}
            className={entry.nickname === highlightNickname ? "is-me" : undefined}
          >
            <td>{entry.rank}</td>
            <td>{renderChange(entry.previous_rank, entry.rank)}</td>
            <td>
              <PlayerCell nickname={entry.nickname} avatarHash={entry.avatar_hash} />
            </td>
            {showCoins ? <td>{formatCoins(entry.rank_balance ?? 0)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
