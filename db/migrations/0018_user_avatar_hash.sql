-- Cache the Gravatar hash (SHA-256 of the lowercased e-mail) so the leaderboard
-- doesn't recompute it on every request. Filled at signup and cleared on account
-- deletion. SQLite has no SHA-256, so existing rows are backfilled in code.
ALTER TABLE users ADD COLUMN avatar_hash TEXT;
