-- Consolidated initial schema for Hollywood 101 Tipovačka.
-- Replaces the historical 0001–0020 migrations with a single clean baseline.

CREATE TABLE users (
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
  rank_balance INTEGER,
  avatar_hash TEXT
);

CREATE INDEX idx_users_status ON users(status);

CREATE TABLE user_auth_identities (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('local', 'google', 'facebook')
  ),
  provider_user_id TEXT,
  email TEXT COLLATE NOCASE,
  password_hash TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (provider, provider_user_id),
  UNIQUE (user_id, provider),
  CHECK (
    (provider = 'local' AND password_hash IS NOT NULL)
    OR (provider IN ('google', 'facebook') AND provider_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_user_auth_identities_user_id ON user_auth_identities(user_id);

CREATE TABLE activation_codes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  code TEXT NOT NULL UNIQUE,
  consumed_date TEXT,
  reserved_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_activation_codes_user_id ON activation_codes(user_id);

CREATE TABLE rounds (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'bonus')),
  evaluated_date TEXT,
  scheduled_evaluation_date TEXT
);

CREATE INDEX idx_rounds_type ON rounds(type);

CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  round_id INTEGER NOT NULL,
  movie_title TEXT NOT NULL,
  poster_url TEXT,
  csfd_url TEXT,
  imdb_url TEXT,
  actual_revenue INTEGER,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

CREATE INDEX idx_movies_round_id ON movies(round_id);

CREATE TABLE guesses (
  id INTEGER PRIMARY KEY,
  round_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  guessed_revenue INTEGER,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  UNIQUE (round_id, user_id, movie_id)
);

CREATE INDEX idx_guesses_user_id ON guesses(user_id);

CREATE TABLE imf_coin_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  created_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_imf_coin_history_user_id_created_date ON imf_coin_history(user_id, created_date);

CREATE TABLE faq_entries (
  id INTEGER PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_faq_entries_display_order ON faq_entries(display_order);
