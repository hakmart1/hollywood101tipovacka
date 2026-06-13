-- Replace the season grouping with a simple round type: 'standard' or 'bonus'.
-- Rounds that had no season become bonus rounds; the rest are standard.
PRAGMA foreign_keys = OFF;

CREATE TABLE rounds_new (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard', 'bonus')),
  evaluated_date TEXT
);

INSERT INTO rounds_new (id, title, date_from, date_to, description, type, evaluated_date)
  SELECT
    id,
    title,
    date_from,
    date_to,
    description,
    CASE WHEN season_id IS NULL THEN 'bonus' ELSE 'standard' END,
    evaluated_date
  FROM rounds;

DROP TABLE rounds;
ALTER TABLE rounds_new RENAME TO rounds;

DROP TABLE IF EXISTS seasons;

CREATE INDEX idx_rounds_type ON rounds(type);

PRAGMA foreign_keys = ON;
