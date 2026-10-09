-- Achievements: the definitions (names, tiers, rules) live in code
-- (functions/_lib/achievements.ts); this table only records who earned what.
-- `source` identifies the event ("round:13", "movie:45", "season:1") so a
-- repeatable achievement gets one row per event, while one-time achievements
-- always use '' — the unique key then allows a single row. Awarding uses
-- INSERT OR IGNORE, so re-running a check never duplicates anything.
CREATE TABLE user_achievements (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  detail TEXT,
  earned_date TEXT NOT NULL,
  UNIQUE (user_id, achievement_key, source)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
