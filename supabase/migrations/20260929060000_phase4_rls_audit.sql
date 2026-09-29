-- Phase 4 RLS multi-user audit (applied to remote via MCP).
-- (1) Belt-and-braces: (re)assert RLS on every user-scoped table so a missing
--     ALTER can never leave one world-readable.
alter table profiles enable row level security;
alter table goals enable row level security;
alter table meals enable row level security;
alter table daily_summaries enable row level security;
alter table chat_messages enable row level security;
alter table inbody_reports enable row level security;
alter table activity_logs enable row level security;
alter table meal_plans enable row level security;
alter table workout_plans enable row level security;
alter table push_tokens enable row level security;

-- (2) Perf (advisor auth_rls_initplan): wrap auth.uid() in a scalar subselect so it
--     is evaluated once per query, not once per row. Identical security semantics.
drop policy if exists "Users manage own profile" on profiles;
create policy "Users manage own profile" on profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users manage own goals" on goals;
create policy "Users manage own goals" on goals
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own meals" on meals;
create policy "Users manage own meals" on meals
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own summaries" on daily_summaries;
create policy "Users manage own summaries" on daily_summaries
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own messages" on chat_messages;
create policy "Users manage own messages" on chat_messages
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own inbody reports" on inbody_reports;
create policy "Users manage own inbody reports" on inbody_reports
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own activity logs" on activity_logs;
create policy "Users manage own activity logs" on activity_logs
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own meal plans" on meal_plans;
create policy "Users manage own meal plans" on meal_plans
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own workout plans" on workout_plans;
create policy "Users manage own workout plans" on workout_plans
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own push tokens" on push_tokens;
create policy "Users manage own push tokens" on push_tokens
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- (3) Perf (advisor unindexed_foreign_keys): cover user_id FKs missing an index.
create index if not exists goals_user_idx on goals (user_id);
create index if not exists meals_user_idx on meals (user_id);
create index if not exists chat_messages_user_idx on chat_messages (user_id);
create index if not exists inbody_reports_user_idx on inbody_reports (user_id);

-- NOTE: advisor "extension_in_public" (pg_net in public schema) is intentionally
-- NOT remediated here: moving pg_net would require reworking the live daily-coach
-- cron job's net.http_post reference and risks breaking it; low security value for
-- a single-user app. Tracked as a follow-up.
