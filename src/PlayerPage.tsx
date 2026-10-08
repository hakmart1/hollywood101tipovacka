import { useEffect, useState } from "react";
import BalanceCard from "./BalanceCard";
import Loader from "./Loader";

interface Player {
  id: number;
  nickname: string;
  avatar_hash: string | null;
  avatar_url: string | null;
  activated_date: string | null;
  imf_coins_balance: number;
  rank: number | null;
  rank_balance: number | null;
}

interface PlayerResponse {
  error: string | null;
  player?: Player;
  season_name?: string | null;
}

interface PlayerPageProps {
  playerId: number;
  onMessage: (message: string) => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

// Public profile of a player. Deliberately a set of cards so more sections
// (achievements, stats) can be added later.
export default function PlayerPage({ playerId, onMessage }: PlayerPageProps) {
  const [data, setData] = useState<{ player: Player; seasonName: string | null } | "missing" | null>(null);
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
      setData({ player: payload.player, seasonName: payload.season_name ?? null });
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

  const { player, seasonName } = data;
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
        <h3 className="profile-section-title">{seasonName ?? "Aktuální sezóna"}</h3>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">{player.rank !== null ? `${player.rank}.` : "–"}</span>
            <span className="profile-stat-label">místo v žebříčku</span>
          </div>
        </div>
        {player.rank === null ? (
          <p className="guess-hint">Zatím bez umístění — pořadí se určuje při vyhodnocení tipovačky.</p>
        ) : null}
      </div>
    </section>
  );
}
