-- Throttle password-reset emails per account (anti-abuse): remember when the
-- last reset link was sent so we don't re-send within a cooldown window.
ALTER TABLE users ADD COLUMN last_password_reset_date TEXT;
