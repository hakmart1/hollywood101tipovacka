-- Add the 'deleted' user status (self-service account deletion). SQLite cannot
-- alter a CHECK constraint, so the users table must be rebuilt.
--
-- IMPORTANT: inside a D1 migration the `PRAGMA foreign_keys = OFF` statement is
-- ignored (the migration runs in a transaction, where that pragma is a no-op).
-- With foreign keys ON, `DROP TABLE users` performs an implicit DELETE of all
-- rows first, which fires ON DELETE CASCADE on every child table referencing
-- users — wiping logins, guesses, coin history and activation codes. To stay
-- safe we snapshot those children, rebuild users, then restore them.

CREATE TABLE _bak_auth AS SELECT * FROM user_auth_identities;
CREATE TABLE _bak_guesses AS SELECT * FROM guesses;
CREATE TABLE _bak_codes AS SELECT * FROM activation_codes;
CREATE TABLE _bak_coins AS SELECT * FROM imf_coin_history;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY,
  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_activation' CHECK (
    status IN ('pending_activation', 'active', 'suspended', 'deactivated', 'deleted')
  ),
  role TEXT NOT NULL DEFAULT 'player' CHECK (
    role IN ('player', 'admin')
  ),
  activated_date TEXT,
  last_login_date TEXT,
  imf_coins_balance INTEGER NOT NULL DEFAULT 0 CHECK (imf_coins_balance >= 0),
  last_code_request_date TEXT,
  last_coins_request_date TEXT,
  timezone TEXT,
  previous_rank INTEGER,
  rank INTEGER,
  rank_balance INTEGER
);

INSERT INTO users_new (
  id, nickname, email, status, role, activated_date, last_login_date,
  imf_coins_balance, last_code_request_date, last_coins_request_date, timezone,
  previous_rank, rank, rank_balance
)
SELECT
  id, nickname, email, status, role, activated_date, last_login_date,
  imf_coins_balance, last_code_request_date, last_coins_request_date, timezone,
  previous_rank, rank, rank_balance
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_status ON users(status);

-- Restore the child rows that the cascade removed.
INSERT INTO user_auth_identities SELECT * FROM _bak_auth;
INSERT INTO guesses SELECT * FROM _bak_guesses;
INSERT INTO activation_codes SELECT * FROM _bak_codes;
INSERT INTO imf_coin_history SELECT * FROM _bak_coins;

DROP TABLE _bak_auth;
DROP TABLE _bak_guesses;
DROP TABLE _bak_codes;
DROP TABLE _bak_coins;
