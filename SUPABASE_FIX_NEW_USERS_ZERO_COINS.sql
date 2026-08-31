-- Mystery Box: ONLY fix the default starting coins for NEW profiles.
-- Does NOT change existing players' balances.
-- Existing users keep exactly the coins they already have.

ALTER TABLE public.profiles
  ALTER COLUMN coins SET DEFAULT 0;

-- Verify the default used for future inserts.
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'coins';
