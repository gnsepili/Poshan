-- REFERENCE ONLY — this is documentation, not an executable migration.
-- It lives in docs/ (NOT supabase/migrations/) specifically so that
-- `supabase db push` / `supabase db reset` never runs it.
--
-- Phase 3: cron setup for the daily morning coach note. Documents infra that
-- has already been provisioned on the remote project out-of-band via the
-- Supabase MCP (cron.schedule was run directly against the DB, not via a
-- migration file).
--
-- DO NOT apply this file blindly / paste it into `psql` or a migration as-is:
-- the `<CRON_SECRET>` below is a REDACTED placeholder, not the real secret. If
-- you run this verbatim, the `do $$ ... perform cron.unschedule(...) $$`
-- block will tear down the already-working cron job and `cron.schedule` will
-- reschedule it with the literal string '<CRON_SECRET>' as the header value —
-- every subsequent run will 401 against generate-daily-summary.
--
-- Only re-run this (after replacing `<CRON_SECRET>` with the real function
-- secret) if you are deliberately re-provisioning the cron job from scratch.
-- The real CRON_SECRET is a Supabase function secret (set via
-- `supabase secrets set CRON_SECRET=...`) — never commit the real value here.
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
