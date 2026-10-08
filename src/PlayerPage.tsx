import { useEffect, useState } from "react";
import BalanceCard from "./BalanceCard";
import { renderChange } from "./Leaderboard";
import Loader from "./Loader";

interface Player {
  id: number;
  nickname: string;
  avatar_hash: string | null;
  avatar_url: string | null;
  activated_date: string | null;
  imf_coins_balance: number;
  rank: number | null;
  previous_rank: number | null;
  rank_balance: number | null;
}

interface TipStats {
  tips: number;
  median_error: number | null;
  over: number;
  under: number;
}

interface PlayerResponse {
  error: string | null;
  player?: Player;
  ranked_players?: number;
  stats?: TipStats;
}

interface ProfileData {
  player: Player;
  rankedPlayers: number;
  stats: TipStats | null;
}

interface PlayerPageProps {
  playerId: number;
  onMessage: (message: string) => void;
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

// Public profile of a player: one header card (identity, tip stats, balance and
// rank). The rest of the page is reserved for achievements.
export default function PlayerPage({ playerId, onMessage }: PlayerPageProps) {
  const [data, setData] = useState<ProfileData | "missing" | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function load() {
    if (!Number.isInteger(playerId) || playerId < 1) {
      setData("missing");
      return;
    }
    try {
      const response = await fetch(`/api/players/${playerId}`, { headers: { Accept: "application/json" } });
      const payload = (await response.json()) as PlayerResponse;
      if (!response.ok || payload.error || !payload.player) {
        setData("missing");
        return;
      }
      setData({
        player: payload.player,
        rankedPlayers: payload.ranked_players ?? 0,
        stats: payload.stats ?? null
      });
    } catch {
      onMessage("Profil hráče se nepodařilo načíst.");
      setData("missing");
    }
  }

  if (data === null) {
    return <Loader />;
  }

  if (data === "missing") {
    return (
      <section className="player-page">
        <h2>Profil hráče</h2>
        <p className="guess-hint">Hráč nebyl nalezen.</p>
      </section>
    );
  }

  const { player, rankedPlayers, stats } = data;
  const style = stats ? tipperStyle(stats) : null;
  const avatar =
    player.avatar_url?.trim() ||
    (player.avatar_hash ? `https://www.gravatar.com/avatar/${player.avatar_hash}?s=192&d=404` : null);

  return (
    <section className="player-page">
      <div className="user-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {avatar && !avatarFailed ? (
              <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span aria-hidden="true">{player.nickname.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="profile-identity">
            <h2 className="profile-name">{player.nickname}</h2>
            <span className="profile-meta">
              {player.activated_date ? `Hraje od ${formatDate(player.activated_date)}` : "Účet zatím není aktivovaný"}
            </span>
            {stats && stats.tips > 0 ? (
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
            ) : null}
          </div>
        </div>
        <BalanceCard
          balance={player.imf_coins_balance}
          aside={
            <div className="profile-rank">
              <span className="profile-rank-value">
                {player.rank !== null ? (
                  <>
                    {player.rank}.<span className="profile-rank-of"> z {rankedPlayers}</span>
                    <span className="profile-rank-change">{renderChange(player.previous_rank, player.rank)}</span>
                  </>
                ) : (
                  "–"
                )}
              </span>
              <span className="balance-label">místo v žebříčku</span>
            </div>
          }
        />
      </div>
    </section>
  );
}
