-- Snapshot of each player's leaderboard rank as of the last round evaluation,
-- so the overall ranking can show how positions moved since then.
ALTER TABLE users ADD COLUMN previous_rank INTEGER;
