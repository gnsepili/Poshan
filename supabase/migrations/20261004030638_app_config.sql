-- Server-side app configuration, read by edge functions with the service role.
-- RLS on with no policies (and grants revoked): clients can neither read nor write it.
-- Change the AI provider/model per feature here — no app release needed.
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

insert into public.app_config (key, value) values (
  'ai',
  '{
    "provider": "openai",
    "models": {
      "chat": "gpt-4o",
      "meal_analysis": "gpt-4o",
      "inbody_analysis": "gpt-4o",
      "daily_summary": "gpt-4o"
    }
  }'::jsonb
);
