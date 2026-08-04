-- Pose Cards — projects (one project = one job, e.g. one wedding).
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Idempotent; requires history.sql to have been run first.
--
-- Batches inside a project continue card numbering (0001..0015, 0016..0030),
-- a new project starts from 0001 again. Written ONLY by the server (service
-- role); clients can just read their own rows.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;
drop policy if exists "read own projects" on public.projects;
create policy "read own projects" on public.projects
  for select using (auth.uid() = user_id);

alter table public.conversions
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists conversions_project_idx
  on public.conversions (project_id);
