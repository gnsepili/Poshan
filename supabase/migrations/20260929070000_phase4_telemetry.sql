-- Phase 4: self-hosted error monitoring + analytics (NOT Sentry). Authenticated
-- users insert their own rows; reads restricted to the owner. Edge functions write
-- via the service role (bypasses RLS). user_id nullable + on delete set null so a
-- log survives account deletion for aggregate debugging.
create table error_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  context text not null,
  message text not null,
  stack text,
  created_at timestamptz not null default now()
);
alter table error_logs enable row level security;
create policy "Users insert own error logs" on error_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "Users read own error logs" on error_logs
  for select using ((select auth.uid()) = user_id);
create index error_logs_user_idx on error_logs (user_id);

create table events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table events enable row level security;
create policy "Users insert own events" on events
  for insert with check ((select auth.uid()) = user_id);
create policy "Users read own events" on events
  for select using ((select auth.uid()) = user_id);
create index events_user_idx on events (user_id);
