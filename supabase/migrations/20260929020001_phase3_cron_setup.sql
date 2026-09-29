-- Phase 3: cron setup for the daily morning coach note.
-- REFERENCE / documentation of infra provisioned out-of-band via Supabase MCP.
-- NOT meant to be applied blindly: the real CRON_SECRET is a Supabase function
-- secret (set via `supabase secrets set CRON_SECRET=...`) and is injected into
-- the cron job's header out-of-band — the placeholder below must be replaced
-- with that same value (never commit the real secret).
--
-- The generate-daily-summary edge function is deployed with verify_jwt=false and
-- performs its own auth: it accepts EITHER a matching `x-cron-secret` header
-- (cron mode → all users) OR a valid user JWT (lazy mode → that user), else 401.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Daily at 06:00 UTC. Re-run safe: unschedule the old job first.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'daily-coach-note') then
    perform cron.unschedule('daily-coach-note');
  end if;
end $$;

select cron.schedule(
  'daily-coach-note',
  '0 6 * * *',
  $cron$
    select net.http_post(
      url := 'https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
      body := '{}'::jsonb
    );
  $cron$
);
