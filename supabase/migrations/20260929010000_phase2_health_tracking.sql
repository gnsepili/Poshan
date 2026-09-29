-- Phase 2: health tracking — InBody reports + activity logs + private inbody-photos bucket.
-- uuid-ossp is already enabled by the Phase 1 migration.

-- InBody body-composition reports (photo -> AI extraction).
create table inbody_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  scanned_at timestamptz not null default now(),
  photo_url text,                       -- storage PATH in private inbody-photos bucket
  weight_kg float,
  body_fat_pct float,
  muscle_mass_kg float,
  visceral_fat float,
  bmr int,
  raw_extracted_json jsonb,             -- full OCR/extraction output
  ai_notes text,                        -- short coach note on this scan
  created_at timestamptz not null default now()
);
alter table inbody_reports enable row level security;
create policy "Users manage own inbody reports" on inbody_reports
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Manual activity logs (steps summed client-side into the day's dashboard).
create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  activity_type text not null check (activity_type in ('walk','run','gym','cycle','swim','yoga','other')),
  duration_min int not null default 0,
  steps int not null default 0,
  calories_burned int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table activity_logs enable row level security;
create policy "Users manage own activity logs" on activity_logs
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket for InBody photos. Store the PATH in inbody_reports.photo_url; sign on read.
insert into storage.buckets (id, name, public)
values ('inbody-photos', 'inbody-photos', false)
on conflict (id) do nothing;

create policy "Users upload own inbody photos" on storage.objects
  for insert with check (bucket_id = 'inbody-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own inbody photos" on storage.objects
  for select using (bucket_id = 'inbody-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own inbody photos" on storage.objects
  for delete using (bucket_id = 'inbody-photos' and auth.uid()::text = (storage.foldername(name))[1]);
