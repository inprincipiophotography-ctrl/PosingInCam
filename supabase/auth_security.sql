-- Shoot Cards: sign-in attempt log (rate limiting, lockout, audit).
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- webauth/guard.py writes one row per sign-in attempt (link requested, link
-- opened, refused, blocked) and counts them to enforce the limits across all
-- serverless instances. Until this table exists the limits only hold per
-- warm instance.
--
-- No raw IPs: ip_hash is an HMAC of the address with a server-side secret.
-- Rows older than 30 days are pruned by the server as it goes.
-- Written and read ONLY by the server (service role): RLS on, no policies.

create table if not exists public.auth_events (
  id          bigint generated always as identity primary key,
  kind        text not null,      -- link_sent | link_failed | link_blocked | captcha_failed
                                  -- | verify_ok | verify_failed | verify_blocked
  ip_hash     text,
  email       text,               -- lower-cased; null when the attempt carries none
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists auth_events_ip_time on public.auth_events (ip_hash, created_at desc);
create index if not exists auth_events_email_time on public.auth_events (email, created_at desc);
create index if not exists auth_events_time on public.auth_events (created_at);

alter table public.auth_events enable row level security;
revoke all on public.auth_events from anon, authenticated;
