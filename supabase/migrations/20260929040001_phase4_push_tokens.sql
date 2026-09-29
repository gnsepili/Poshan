-- Phase 4: Expo push tokens, one row per device token. token is UNIQUE so
-- re-registering the same device (or a token reassigned to a new user) upserts in
-- place instead of duplicating; RLS keeps a user's tokens private to them.
create table push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy "Users manage own push tokens" on push_tokens
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index push_tokens_user_idx on push_tokens (user_id);
