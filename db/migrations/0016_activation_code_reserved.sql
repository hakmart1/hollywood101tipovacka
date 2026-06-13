-- Mark an activation code as reserved (probably already sent to someone), so it
-- isn't handed out again by mistake. Soft marker — a reserved code still works.
ALTER TABLE activation_codes ADD COLUMN reserved_date TEXT;
