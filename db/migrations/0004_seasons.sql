-- Seasons: the game runs in seasons. Ending a season snapshots the leaderboard
-- into season_standings and resets every activated player's balance.
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  started_date TEXT NOT NULL,
  ended_date TEXT
);

-- Final standings of an ended season. nickname is a snapshot (players can be
-- renamed/deleted later); balance is the frozen leaderboard balance at the end.
CREATE TABLE season_standings (
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  rank INTEGER NOT NULL,
  nickname TEXT NOT NULL,
  balance INTEGER NOT NULL,
  PRIMARY KEY (season_id, user_id)
);

-- Everything played so far becomes the first season.
INSERT INTO seasons (name, started_date)
VALUES (
  'Sezóna 1',
  COALESCE((SELECT MIN(date_from) FROM rounds), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
