-- Admin's preferred IANA time zone (e.g. 'Europe/Prague'). NULL = browser default.
ALTER TABLE users ADD COLUMN timezone TEXT;
