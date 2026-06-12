-- Track per user when he last requested an activation code (rate limiting).
ALTER TABLE users ADD COLUMN last_code_request_date TEXT;
