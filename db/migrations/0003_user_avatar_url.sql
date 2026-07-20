-- Optional custom profile image URL. When NULL, the Gravatar derived from the
-- e-mail hash (users.avatar_hash) is used instead.
ALTER TABLE users ADD COLUMN avatar_url TEXT;
