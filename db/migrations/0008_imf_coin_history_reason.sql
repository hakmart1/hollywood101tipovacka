-- Each coin transaction records why it happened (coin request, tip, winnings, ...).
ALTER TABLE imf_coin_history ADD COLUMN reason TEXT;

-- The only writer so far has been the "ask for more coins" feature.
UPDATE imf_coin_history SET reason = 'IMF bailout package' WHERE reason IS NULL;
