-- Pose Cards — entitlement schema.
-- Run this in the NEW Supabase project's SQL Editor (Dashboard → SQL Editor → New query).
-- No secrets here. Entitlement fields are written ONLY by the server (service role),
-- never by the client.
--
-- Unit = one converted card (image):
--   Free:    3 cards total, watermarked
--   20-pack: 20 credits (one-time), no watermark
--   Pro:     unlimited, no watermark

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  free_used           int  not null default 0,        -- watermarked free cards used (cap below)
  credits             int  not null default 0,         -- one-time 20-pack credits remaining
  plan                text not null default 'free',    -- 'free' | 'pro'
  subscription_status text,                             -- Stripe subscription status
  current_period_end  timestamptz,                      -- Pro access valid until
  stripe_customer_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user may read ONLY their own profile.
-- No client write policy → entitlement can only change via the service role (server).
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usage log (analytics / abuse monitoring).
create table if not exists public.conversions (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  cards       int  not null,
  vendor      text,
  tier        text,                                     -- 'free' | 'credits' | 'pro'
  created_at  timestamptz not null default now()
);

alter table public.conversions enable row level security;
drop policy if exists "read own conversions" on public.conversions;
create policy "read own conversions" on public.conversions
  for select using (auth.uid() = user_id);

-- Stripe webhook idempotency: each processed event id is recorded once, so a
-- retried or duplicate delivery can't double-apply credits. Written ONLY by the
-- server (service role); RLS enabled with no policies = no client access.
create table if not exists public.stripe_events (
  id          text primary key,                          -- Stripe event id (evt_...)
  created_at  timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- Atomic entitlement counters (no lost updates under concurrency). These are
-- SECURITY INVOKER (default): a user calling them directly runs as their own role
-- and the profiles RLS (no client write policy) blocks the write, so nothing
-- happens. Only the service role can actually update. Execute is also revoked
-- from client roles for good measure.
create or replace function public.add_free_used(p_uid uuid, p_n int)
returns void language sql as $$
  update public.profiles set free_used = free_used + p_n, updated_at = now() where id = p_uid;
$$;

create or replace function public.spend_credits(p_uid uuid, p_n int)
returns void language sql as $$
  update public.profiles set credits = greatest(0, credits - p_n), updated_at = now() where id = p_uid;
$$;

create or replace function public.add_credits(p_uid uuid, p_n int)
returns void language sql as $$
  update public.profiles set credits = credits + p_n, updated_at = now() where id = p_uid;
$$;

revoke execute on function public.add_free_used(uuid,int), public.spend_credits(uuid,int), public.add_credits(uuid,int) from public, anon, authenticated;
grant  execute on function public.add_free_used(uuid,int), public.spend_credits(uuid,int), public.add_credits(uuid,int) to service_role;
