-- Opt-in e-mail notifications (both off by default): a new round opened, and
-- 24 hours left before tipping closes.
ALTER TABLE users ADD COLUMN notify_round_start INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN notify_round_closing INTEGER NOT NULL DEFAULT 0;

-- When each notification went out for a round, so the cron never sends twice.
ALTER TABLE rounds ADD COLUMN start_notified_date TEXT;
ALTER TABLE rounds ADD COLUMN closing_notified_date TEXT;

-- Rounds already under way when this ships must not trigger a burst of mail.
UPDATE rounds SET start_notified_date = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE date_from <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
UPDATE rounds SET closing_notified_date = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE date_to <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+24 hours');
