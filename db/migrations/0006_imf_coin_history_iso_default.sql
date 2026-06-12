-- CURRENT_TIMESTAMP renders as 'YYYY-MM-DD HH:MM:SS', while application code
-- writes ISO 8601 ('YYYY-MM-DDTHH:MM:SS.SSSZ'). Mixed formats would break
-- lexicographic date ordering, so rebuild the table with a default that
-- matches the application format exactly.
PRAGMA foreign_keys = OFF;

CREATE TABLE imf_coin_history_new (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO imf_coin_history_new SELECT * FROM imf_coin_history;

DROP TABLE imf_coin_history;
ALTER TABLE imf_coin_history_new RENAME TO imf_coin_history;

CREATE INDEX idx_imf_coin_history_user_id_created_date ON imf_coin_history(user_id, created_date);

PRAGMA foreign_keys = ON;
