-- Phase 3: coaching intelligence — weekly meal_plans + workout_plans.
-- uuid-ossp is already enabled by the Phase 1 migration.
-- Both tables are APPEND-ONLY / latest-wins: a regenerate inserts a new row;
-- reads take the most recent row per user (order by created_at desc, limit 1).

-- AI-generated weekly meal plans.
create table meal_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start_date date not null,
  plan_json jsonb not null,   -- { days: [ { day, meals: [ { meal_type, description, calories, protein_g, carbs_g, fat_g } ] } ] }
  created_at timestamptz not null default now()
);
alter table meal_plans enable row level security;
create policy "Users manage own meal plans" on meal_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index meal_plans_user_created_idx on meal_plans (user_id, created_at desc);

-- AI-generated weekly workout plans.
create table workout_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start_date date not null,
  plan_json jsonb not null,   -- { days: [ { day, focus, exercises: [ { name, sets, reps, notes } ] } ] }
  created_at timestamptz not null default now()
);
alter table workout_plans enable row level security;
create policy "Users manage own workout plans" on workout_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index workout_plans_user_created_idx on workout_plans (user_id, created_at desc);
