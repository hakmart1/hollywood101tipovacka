-- SQLite cannot alter a CHECK constraint, so rebuild the users table to add
-- the 'deactivated' status (set when an admin removes a redeemed activation code).
PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY,
  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_activation' CHECK (
    status IN ('pending_activation', 'active', 'suspended', 'deactivated')
  ),
  role TEXT NOT NULL DEFAULT 'player' CHECK (
    role IN ('player', 'admin')
  ),
  activated_date TEXT,
  last_login_date TEXT,
  imf_coins_balance INTEGER NOT NULL DEFAULT 0 CHECK (imf_coins_balance >= 0)
);

INSERT INTO users_new SELECT * FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_status ON users(status);

PRAGMA foreign_keys = ON;
