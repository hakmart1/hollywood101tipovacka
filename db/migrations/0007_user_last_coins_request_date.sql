-- Track per user when he last asked for more IMF coins (14-day rate limit).
ALTER TABLE users ADD COLUMN last_coins_request_date TEXT;
