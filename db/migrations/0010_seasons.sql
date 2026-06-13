-- Seasons group contests (rounds). Admin creates them; each contest is assigned one.
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

ALTER TABLE rounds ADD COLUMN season_id INTEGER REFERENCES seasons(id);

CREATE INDEX idx_rounds_season_id ON rounds(season_id);
