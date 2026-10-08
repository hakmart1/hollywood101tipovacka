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

interface PastSeason {
  id: number;
  name: string;
  rank: number;
  players: number;
}

interface PlayerResponse {
  error: string | null;
  player?: Player;
  ranked_players?: number;
  past_seasons?: PastSeason[];
  stats?: TipStats;
}

interface ProfileData {
  player: Player;
  rankedPlayers: number;
  pastSeasons: PastSeason[];
  stats: TipStats | null;
}

interface PlayerPageProps {
  playerId: number;
  onMessage: (message: string) => void;
}

// Below this many tips the over/under split is mostly noise.
const MIN_TIPS_FOR_STYLE = 5;

function tipperStyle(stats: TipStats): { label: string; detail: string } | null {
  if (stats.tips < MIN_TIPS_FOR_STYLE) {
    return null;
  }
  const overShare = stats.over / stats.tips;
  const label = overShare >= 0.6 ? "Optimista 📈" : overShare <= 0.4 ? "Pesimista 📉" : "Vyvážený ⚖️";
  return { label, detail: `tipuje výš u ${stats.over} z ${stats.tips} filmů` };
}

function formatPercent(ratio: number): string {
  return `±${Math.round(ratio * 100)} %`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

// Public profile of a player. Deliberately a set of cards so more sections
// (achievements, stats) can be added later.
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
        pastSeasons: payload.past_seasons ?? [],
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

  const { player, rankedPlayers, pastSeasons, stats } = data;
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
          </div>
        </div>
        <BalanceCard balance={player.imf_coins_balance} />
      </div>

      <div className="user-card">
        <h3 className="profile-section-title">Aktuální sezóna</h3>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">
              {player.rank !== null ? (
                <>
                  {player.rank}.<span className="profile-stat-of"> z {rankedPlayers}</span>
                  <span className="profile-stat-change">{renderChange(player.previous_rank, player.rank)}</span>
                </>
              ) : (
                "–"
              )}
            </span>
            <span className="profile-stat-label">místo v žebříčku</span>
          </div>
        </div>
        {player.rank === null ? (
          <p className="guess-hint">Zatím bez umístění — pořadí se určuje při vyhodnocení tipovačky.</p>
        ) : null}
        {pastSeasons.length > 0 ? (
          <p className="profile-past-seasons">
            Minulé sezóny:{" "}
            {pastSeasons.map((season, index) => (
              <span key={season.id}>
                {index > 0 ? " · " : ""}
                {season.name} – {season.rank}. z {season.players}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="user-card">
        <h3 className="profile-section-title">Statistiky tipů</h3>
        {stats && stats.tips > 0 ? (
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">
                {stats.median_error != null ? formatPercent(stats.median_error) : "–"}
              </span>
              <span className="profile-stat-label">typická odchylka tipu ({stats.tips} filmů)</span>
            </div>
            {style ? (
              <div className="profile-stat">
                <span className="profile-stat-value">{style.label}</span>
                <span className="profile-stat-label">{style.detail}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="guess-hint">Zatím žádné vyhodnocené tipy.</p>
        )}
      </div>
    </section>
  );
}
