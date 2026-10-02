-- Camera Cards — remember when a cancelled Pro subscription ends, so the
-- account bar can say "Pro · ends 2 Nov" instead of just "Pro".
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Idempotent, so running it again is harmless.
--
-- Written ONLY by the server (Stripe webhook, service role). Until this column
-- exists the webhook simply skips it, so nothing breaks either way.

alter table public.profiles add column if not exists cancel_at timestamptz;

-- Let the API see the new column straight away.
notify pgrst, 'reload schema';
