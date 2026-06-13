-- Leaderboard standings are frozen at round evaluation, so spending on tips
-- between rounds does not move anyone. Store the rank and the balance behind it
-- as of the last evaluation. (previous_rank from 0014 = rank at the prior one.)
ALTER TABLE users ADD COLUMN rank INTEGER;
ALTER TABLE users ADD COLUMN rank_balance INTEGER;
