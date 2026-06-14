-- Optional scheduled auto-evaluation time for a round. When set and reached, a
-- cron worker evaluates the round (re-checking the same prerequisites). Cleared
-- if a box office result is removed, or on evaluation.
ALTER TABLE rounds ADD COLUMN scheduled_evaluation_date TEXT;
