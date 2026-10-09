export type AchievementTier = "diamond" | "gold" | "silver" | "bronze" | "raspberry";

export interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  repeatable: boolean;
  count: number;
  last_earned: string | null;
  last_detail: string | null;
}

const TIERS: { tier: AchievementTier; medal: string; label: string }[] = [
  { tier: "diamond", medal: "💎", label: "Diamantové" },
  { tier: "gold", medal: "🏆", label: "Zlaté" },
  { tier: "silver", medal: "🥈", label: "Stříbrné" },
  { tier: "bronze", medal: "🥉", label: "Bronzové" },
  { tier: "raspberry", medal: "🍓", label: "Zlaté maliny" }
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

// Achievement overview: a per-tier tally, then every achievement as a tile —
// earned ones in colour with a count, the rest greyed out.
export default function Achievements({ achievements }: { achievements: Achievement[] }) {
  const total = achievements.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="user-card achievements-card">
      <div className="achievements-head">
        <h3 className="achievements-title">Úspěchy</h3>
        <div className="achievement-tally">
          {TIERS.map(({ tier, medal, label }) => {
            const count = achievements
              .filter((item) => item.tier === tier)
              .reduce((sum, item) => sum + item.count, 0);
            return (
              <span key={tier} className={`tally-item${count === 0 ? " is-zero" : ""}`} title={label}>
                {medal} {count}
              </span>
            );
          })}
        </div>
      </div>
      {total === 0 ? <p className="guess-hint">Zatím žádné úspěchy.</p> : null}

      {TIERS.map(({ tier, medal, label }) => (
        <section key={tier} className="achievement-group">
          <h4 className="achievement-group-title">
            {medal} {label}
          </h4>
          <div className="achievement-grid">
            {achievements
              .filter((item) => item.tier === tier)
              .map((item) => (
                <div
                  key={item.key}
                  className={`achievement-tile tier-${tier}${item.count > 0 ? "" : " is-locked"}`}
                  title={
                    item.count > 0 && item.last_earned
                      ? `Naposledy ${formatDate(item.last_earned)}${item.last_detail ? ` · ${item.last_detail}` : ""}`
                      : "Zatím nezískáno"
                  }
                >
                  <span className="achievement-icon" aria-hidden="true">{item.icon}</span>
                  <span className="achievement-text">
                    <span className="achievement-name">
                      {item.name}
                      {item.repeatable && item.count > 1 ? (
                        <span className="achievement-count">×{item.count}</span>
                      ) : null}
                    </span>
                    <span className="achievement-desc">{item.description}</span>
                  </span>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
