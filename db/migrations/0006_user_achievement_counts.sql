-- Per-tier achievement totals kept on the user, so the leaderboard can show
-- them without reading user_achievements. Recounted on every award (see
-- recountStatement in functions/_lib/achievements.ts).
ALTER TABLE users ADD COLUMN achievements_diamond INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN achievements_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN achievements_silver INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN achievements_bronze INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN achievements_raspberry INTEGER NOT NULL DEFAULT 0;
