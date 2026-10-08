import { renderChange } from "./Leaderboard";

export interface TipStats {
  tips: number;
  median_error: number | null;
  over: number;
  under: number;
}

// Below this many tips the over/under split is mostly noise.
const MIN_TIPS_FOR_STYLE = 5;

function tipperStyle(stats: TipStats): { icon: string; label: string; detail: string } | null {
  if (stats.tips < MIN_TIPS_FOR_STYLE) {
    return null;
  }
  const overShare = stats.over / stats.tips;
  const [icon, label] =
    overShare >= 0.6 ? ["📈", "Optimista"] : overShare <= 0.4 ? ["📉", "Pesimista"] : ["⚖️", "Vyvážený"];
  return { icon, label, detail: `tipuje výš u ${stats.over} z ${stats.tips} filmů` };
}

function formatPercent(ratio: number): string {
  return `±${Math.round(ratio * 100)} %`;
}

// Tip stat chips shown under the player's name (public profile and Můj účet).
export function TipStatChips({ stats }: { stats: TipStats | null }) {
  if (!stats || stats.tips === 0) {
    return null;
  }
  const style = tipperStyle(stats);
  return (
    <div className="profile-chips">
      {stats.median_error != null ? (
        <span className="profile-chip" title={`Typická odchylka tipu (medián z ${stats.tips} filmů)`}>
          🎯 <strong>{formatPercent(stats.median_error)}</strong> typická odchylka
        </span>
      ) : null}
      {style ? (
        <span className="profile-chip" title={style.detail}>
          {style.icon} <strong>{style.label}</strong>
        </span>
      ) : null}
    </div>
  );
}

// Leaderboard placing for the right side of the gold balance card.
export function RankAside({
  rank,
  previousRank,
  rankedPlayers
}: {
  rank: number | null;
  previousRank: number | null;
  rankedPlayers: number;
}) {
  return (
    <div className="profile-rank">
      <span className="profile-rank-value">
        {rank !== null ? (
          <>
            {rank}.<span className="profile-rank-of"> z {rankedPlayers}</span>
            <span className="profile-rank-change">{renderChange(previousRank, rank)}</span>
          </>
        ) : (
          "–"
        )}
      </span>
      <span className="balance-label">místo v žebříčku</span>
    </div>
  );
}
