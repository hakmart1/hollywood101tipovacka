-- season_key is no longer needed; a contest is identified by its id and
-- grouped by season_id. Rebuild rounds without the column (SQLite cannot drop
-- a column backed by a UNIQUE index directly).
PRAGMA foreign_keys = OFF;

CREATE TABLE rounds_new (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  description TEXT,
  season_id INTEGER REFERENCES seasons(id)
);

INSERT INTO rounds_new (id, title, date_from, date_to, description, season_id)
  SELECT id, title, date_from, date_to, description, season_id FROM rounds;

DROP TABLE rounds;
ALTER TABLE rounds_new RENAME TO rounds;

CREATE INDEX idx_rounds_season_id ON rounds(season_id);

PRAGMA foreign_keys = ON;
