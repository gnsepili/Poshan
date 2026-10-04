-- Winter Arc (and future) challenges: a dated run of daily rules. Auto rules are computed
-- from meals/activity; manual rules are daily check-ins.
-- (The function below is the final definition; 20261004151235 applied the calories band
-- on top of the first version in production.)
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'winter_arc',
  title text not null default 'Winter Arc',
  start_date date not null,
  end_date date not null,
  rules text[] not null check (cardinality(rules) between 1 and 20),
  strict boolean not null default false,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  start_weight_kg float,
  start_body_fat_pct float,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create unique index challenges_one_active_per_user on public.challenges (user_id) where status = 'active';
alter table public.challenges enable row level security;
create policy "Users manage own challenges" on public.challenges
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.challenge_checkins (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  rule_id text not null,
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, date, rule_id)
);
create index challenge_checkins_user_idx on public.challenge_checkins (user_id);
alter table public.challenge_checkins enable row level security;
create policy "Users manage own challenge check-ins" on public.challenge_checkins
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Per-day, per-rule status from the start date to today (UTC days, like the app).
-- security invoker: RLS limits every table read to the caller's own rows.
-- "Calories on target" = within 80-105% of the daily target (barely eating doesn't count).
create or replace function public.challenge_progress(p_challenge_id uuid)
returns table (day date, rule_id text, done boolean, value numeric, target numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with c as (
    select * from challenges where id = p_challenge_id
  ),
  g as (
    select daily_protein_g, daily_calorie_target, daily_steps_target
    from goals where user_id = (select user_id from c)
    order by created_at desc limit 1
  ),
  days as (
    select generate_series(c.start_date, least(c.end_date, (now() at time zone 'utc')::date), interval '1 day')::date as day
    from c
  ),
  rules as (
    select unnest(c.rules) as rule_id from c
  ),
  meals_d as (
    select (logged_at at time zone 'utc')::date as d, sum(protein_g) as protein, sum(total_calories) as cal, count(*) as n
    from meals
    where user_id = (select user_id from c) and logged_at >= (select start_date from c)
    group by 1
  ),
  act_d as (
    select (logged_at at time zone 'utc')::date as d, sum(steps) as steps,
           bool_or(activity_type <> 'walk' or duration_min >= 30) as workout
    from activity_logs
    where user_id = (select user_id from c) and logged_at >= (select start_date from c)
    group by 1
  )
  select
    days.day,
    rules.rule_id,
    case rules.rule_id
      when 'workout' then coalesce(a.workout, false)
      when 'steps' then coalesce(a.steps, 0) >= coalesce((select daily_steps_target from g), 8000)
      when 'protein' then coalesce(m.protein, 0) >= coalesce((select daily_protein_g from g), 120)
      when 'calories' then coalesce(m.cal, 0) between coalesce((select daily_calorie_target from g), 2000) * 0.8
                                                  and coalesce((select daily_calorie_target from g), 2000) * 1.05
      when 'log_meals' then coalesce(m.n, 0) >= 3
      else coalesce(ci.done, false)
    end as done,
    case rules.rule_id
      when 'steps' then a.steps
      when 'protein' then m.protein
      when 'calories' then m.cal
      when 'log_meals' then m.n
      else null
    end::numeric as value,
    case rules.rule_id
      when 'steps' then coalesce((select daily_steps_target from g), 8000)
      when 'protein' then coalesce((select daily_protein_g from g), 120)
      when 'calories' then coalesce((select daily_calorie_target from g), 2000)
      when 'log_meals' then 3
      else null
    end::numeric as target
  from days
  cross join rules
  left join meals_d m on m.d = days.day
  left join act_d a on a.d = days.day
  left join challenge_checkins ci
    on ci.challenge_id = p_challenge_id and ci.date = days.day and ci.rule_id = rules.rule_id
  order by days.day, rules.rule_id;
$$;

revoke all on function public.challenge_progress(uuid) from public, anon;
grant execute on function public.challenge_progress(uuid) to authenticated;
