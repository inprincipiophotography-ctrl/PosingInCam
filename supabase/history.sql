-- Pose Cards — card history (batches stored per user, re-downloadable).
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Everything is idempotent, so running it again is harmless.
--
-- What it does:
--   1. Extends public.conversions with the columns the history feature stores.
--   2. Creates the private "cards" storage bucket where converted JPEGs live
--      (path layout: <user_id>/<batch_key>/<card_filename>).
--
-- Clients never touch the bucket directly: the server (service role) writes it
-- and hands out short-lived signed URLs via /api/history, so the bucket stays
-- private and needs no storage RLS policies.

alter table public.conversions add column if not exists storage_prefix text;
alter table public.conversions add column if not exists files          jsonb;
alter table public.conversions add column if not exists start_number   int;
alter table public.conversions add column if not exists watermarked    boolean;

create index if not exists conversions_user_created_idx
  on public.conversions (user_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('cards', 'cards', false)
on conflict (id) do nothing;
