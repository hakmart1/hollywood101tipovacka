PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_activation' CHECK (
    status IN ('pending_activation', 'active', 'suspended')
  ),
  role TEXT NOT NULL DEFAULT 'player' CHECK (
    role IN ('player', 'admin')
  ),
  activated_date TEXT,
  last_login_date TEXT,
  imf_coins_balance INTEGER NOT NULL DEFAULT 0 CHECK (imf_coins_balance >= 0)
);

CREATE TABLE activation_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  code_hash TEXT NOT NULL UNIQUE,
  consumed_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
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

CREATE TABLE imf_coin_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  season_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  description TEXT
);

CREATE TABLE movies (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  movie_title TEXT NOT NULL,
  poster_url TEXT,
  csfd_url TEXT,
  imdb_url TEXT,
  actual_revenue INTEGER,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

CREATE TABLE guesses (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  guessed_revenue INTEGER,
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
  UNIQUE(round_id, user_id, movie_id)
);

CREATE TABLE faq_entries (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);