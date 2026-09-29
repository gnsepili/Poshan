-- Documents the Phase 1 schema exactly as already applied to the remote
-- project (provisioned via the Supabase MCP). Not run against the live DB
-- by this migration file; included for version control / reproducibility.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  age int not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  height_cm float not null,
  current_weight_kg float not null,
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  lifestyle_notes text not null default '',
  health_conditions text not null default '',
  treatment_duration_months int not null default 0,
  ai_provider text not null default 'openai' check (ai_provider in ('claude', 'openai', 'gemini')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- Goals (append-only / latest-wins: reads take the most recent row by created_at)
create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  target_weight_kg float not null,
  target_body_fat_pct float,
  target_muscle_mass_kg float,
  daily_calorie_target int not null,
  daily_protein_g int not null,
  daily_carbs_g int not null,
  daily_fat_g int not null,
  daily_steps_target int not null default 8000,
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "Users manage own goals" on goals
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meals (append-only)
create table meals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  photo_url text,
  description text not null default '',
  total_calories int not null default 0,
  protein_g float not null default 0,
  carbs_g float not null default 0,
  fat_g float not null default 0,
  fiber_g float not null default 0,
  ai_suggestions text,
  created_at timestamptz not null default now()
);
alter table meals enable row level security;
create policy "Users manage own meals" on meals
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily summaries
create table daily_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  total_calories_consumed int not null default 0,
  total_protein_g float not null default 0,
  total_carbs_g float not null default 0,
  total_fat_g float not null default 0,
  total_steps int not null default 0,
  weight_kg float,
  ai_daily_goals jsonb,
  ai_coach_note text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);
alter table daily_summaries enable row level security;
create policy "Users manage own summaries" on daily_summaries
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat messages (append-only)
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb,
  context_snapshot jsonb,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
create policy "Users manage own messages" on chat_messages
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-update profiles.updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- meal-photos storage bucket (private) + per-user-folder policies
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false);

create policy "Auth users upload meal photos" on storage.objects
  for insert with check (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own meal photos" on storage.objects
  for select using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own meal photos" on storage.objects
  for delete using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
