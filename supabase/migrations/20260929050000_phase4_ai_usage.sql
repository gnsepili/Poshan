-- Phase 4: per-user daily AI call budget. One row per (user_id, date) so the count
-- resets every calendar day. Writes go only through the SECURITY DEFINER function
-- (called by the service-role edge functions); users may read their own usage.
create table ai_usage (
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  count int not null default 0,
  primary key (user_id, date)
);
alter table ai_usage enable row level security;
create policy "Users read own ai usage" on ai_usage
  for select using ((select auth.uid()) = user_id);

-- Atomic increment-and-check: bumps today's count and returns whether the resulting
-- count is within the cap. The (cap)-th call returns true, the (cap+1)-th false.
create or replace function check_and_increment_ai_usage(p_user_id uuid, p_cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into ai_usage (user_id, date, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, date)
  do update set count = ai_usage.count + 1
  returning count into new_count;
  return new_count <= p_cap;
end;
$$;
