-- RLS check: what can a signed-in user reach with their own session token?
-- Run in the Supabase SQL Editor. It changes nothing: it reads as a real user
-- (the owner of the first stored conversion). SET LOCAL lasts only for this
-- one run; the editor is back to its normal role afterwards.
--
-- Expected: every "others_*" and "*_visible" column is 0, my_* match that
-- user's own rows, and profile_writes_allowed is 0.

select set_config('request.jwt.claims',
  json_build_object('role', 'authenticated',
                    'sub', (select user_id::text from public.conversions
                            where user_id is not null limit 1))::text,
  true);

set local role authenticated;

with try_write as (
  -- A no-op update: changes nothing even if it were allowed, but counts rows
  -- the user could write. There is no client write policy, so it must be 0.
  update public.profiles set updated_at = updated_at where id = auth.uid() returning 1
)
select
  auth.uid()                                                                       as acting_as,
  (select count(*) from public.conversions where user_id = auth.uid())             as my_conversions,
  (select count(*) from public.conversions where user_id is distinct from auth.uid()) as others_conversions,
  (select count(*) from public.projects where user_id = auth.uid())                as my_projects,
  (select count(*) from public.projects where user_id <> auth.uid())               as others_projects,
  (select count(*) from public.profiles where id <> auth.uid())                    as others_profiles,
  (select count(*) from public.stripe_events)                                      as stripe_events_visible,
  (select count(*) from storage.objects where bucket_id = 'cards')                 as card_files_visible,
  (select count(*) from storage.buckets)                                           as buckets_visible,
  (select count(*) from try_write)                                                 as profile_writes_allowed;
