import { AchievementBadges } from "./Achievements";
import type { AchievementTier } from "./Achievements";
import PlayerLink from "./PlayerLink";
import { formatCoins } from "./RoundResultView";

export interface LeaderboardEntry {
  user_id?: number | null;
  nickname: string;
  rank: number;
  previous_rank: number | null;
  rank_balance: number | null;
  avatar_hash?: string | null;
  avatar_url?: string | null;
  achievements?: Partial<Record<AchievementTier, number>>;
}

function PlayerCell({
  userId,
  nickname,
  avatarHash,
  avatarUrl,
  achievements
}: {
  userId?: number | null;
  nickname: string;
  avatarHash?: string | null;
  avatarUrl?: string | null;
  achievements?: Partial<Record<AchievementTier, number>>;
}) {
  // A custom profile image wins; otherwise fall back to the Gravatar hash.
  const src = avatarUrl?.trim() || (avatarHash ? `https://www.gravatar.com/avatar/${avatarHash}?s=48&d=blank` : null);
  return (
    <span className="player-cell">
      <span className="player-avatar" aria-hidden="true">
        {src ? <img src={src} alt="" loading="lazy" /> : null}
        <span className="player-avatar-fallback">{nickname.slice(0, 1).toUpperCase()}</span>
      </span>
      <span className="player-cell-main">
        <PlayerLink userId={userId} nickname={nickname} />
        <AchievementBadges tally={achievements} className="mobile-only" />
      </span>
    </span>
  );
}

export function renderChange(previousRank: number | null, currentRank: number) {
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
  // Rank movement makes no sense for a finished season's final standings.
  showChange?: boolean;
  // Shown inside the (header-only) table when there are no entries.
  emptyText?: string;
}

export default function Leaderboard({
  entries,
  highlightNickname,
  limit,
  showCoins = true,
  showChange = true,
  emptyText = "Zatím žádní hráči."
}: LeaderboardProps) {
  const rows = limit ? entries.slice(0, limit) : entries;
  // Only the live leaderboard carries achievement totals (not archived seasons).
  const showAchievements = rows.some((entry) => entry.achievements);
  const columnCount = 2 + (showChange ? 1 : 0) + (showCoins ? 1 : 0) + (showAchievements ? 1 : 0);
  return (
    // The wrapper is a size container: the layout adapts to the table's own
    // width (narrow home-page card vs. full leaderboard page), not the screen.
    <div className="leaderboard-wrap">
      <table className="data-table leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            {showChange ? (
              <th>
                <span className="label-full">Změna</span>
                <span className="label-short" title="Změna">±</span>
              </th>
            ) : null}
            <th>Hráč</th>
            {showAchievements ? <th className="col-achievements">Úspěchy</th> : null}
            {showCoins ? <th>Imfcoiny</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={columnCount}>
                {emptyText}
              </td>
            </tr>
          ) : null}
          {rows.map((entry) => (
            <tr
              key={entry.nickname}
              className={entry.nickname === highlightNickname ? "is-me" : undefined}
            >
              <td>{entry.rank}</td>
              {showChange ? <td>{renderChange(entry.previous_rank, entry.rank)}</td> : null}
              <td>
                <PlayerCell
                  userId={entry.user_id}
                  nickname={entry.nickname}
                  avatarHash={entry.avatar_hash}
                  avatarUrl={entry.avatar_url}
                  achievements={entry.achievements}
                />
              </td>
              {showAchievements ? (
                <td className="col-achievements">
                  <AchievementBadges tally={entry.achievements} aligned />
                </td>
              ) : null}
              {showCoins ? <td>{formatCoins(entry.rank_balance ?? 0)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
