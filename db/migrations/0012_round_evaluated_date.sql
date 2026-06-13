-- When the admin evaluates a finished contest, record when it happened.
-- Reward/scoring logic will hang off this step later.
ALTER TABLE rounds ADD COLUMN evaluated_date TEXT;
