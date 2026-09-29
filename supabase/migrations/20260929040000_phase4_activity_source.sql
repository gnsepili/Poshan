-- Phase 4: tag activity rows by source and make Health Connect re-sync idempotent.
-- Existing rows are manual by definition, hence the default.
alter table activity_logs
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'health_connect'));

-- Dedup index: one Health Connect exercise session (identified by its start time +
-- type) maps to exactly one row per user, so pressing "Sync now" repeatedly (or a
-- foreground re-sync) can never duplicate it. Manual rows keep source='manual'.
create unique index if not exists activity_logs_hc_dedup_idx
  on activity_logs (user_id, source, logged_at, activity_type);
