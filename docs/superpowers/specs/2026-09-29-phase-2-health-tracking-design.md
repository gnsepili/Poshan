# Phase 2 — Health Tracking: Design Spec

**Status:** Approved design (2026-09-29). Refines the app-level spec
`2026-09-29-health-coach-app-design.md` for Phase 2 execution.

**Parent spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`
**Phase 1 (done):** `docs/superpowers/plans/2026-09-29-phase-1-core-loop.md`

## Goal

Add the health-data inputs the AI coach needs to adjust the plan over time:
InBody body-composition scans (photo → AI extraction), manual activity
logging, progress timeline charts, and AI-driven goal adjustment based on
real results. Enrich the chat agent with vetted nutrition-coaching
principles.

## Scope decisions (approved)

- **Health Connect (Amazfit/Zepp auto-sync) is DEFERRED to Phase 2b.** It
  is a native module requiring a config plugin + custom dev/preview build
  and can only be verified on a physical device with Zepp syncing into
  Health Connect. Phase 2 delivers value without it; activity is entered
  manually for now.
- **InBody ingestion is photo-only** (camera/gallery → gpt-4o vision OCR),
  mirroring the existing `ai-meal-analysis` function. PDF ingestion is out
  of scope (revisit later).
- **Charts use `react-native-svg`** (already installed), hand-built. No new
  charting dependency.
- **Navigation keeps the existing 4-tab bar** (Home / Meals / Chat /
  Settings). InBody and Activity are reached as stack screens via dashboard
  quick-actions and a "Body/Progress" entry — not new tabs.
- **Goals remain append-only / latest-wins** (Phase 1 ruling; the deployed
  edge functions read the most-recent goals row). AI goal-adjustment
  inserts a new goals row.
- **Agent system prompt is enriched** with coaching principles adapted from
  the MIT-licensed `NataMoroz/nutrition-coach` skill (content only, not its
  file-storage mechanics): protein priority, moderate deficit over
  aggressive, carbs as training fuel, peri-workout fueling, scale-weight
  noise, and sex-based / female-physiology nuance (cycle phases, postpartum,
  breastfeeding — do not push aggressive deficit while breastfeeding; iron/
  ferritin & bone-density awareness), plus safety floors (protein target,
  calorie floor). Attribute the source in a code comment.

## Data model (new)

Applied to remote project `ggjrtgowmauoimpvficl` via Supabase MCP AND
committed as `supabase/migrations/<ts>_phase2_health_tracking.sql`.

### `inbody_reports`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `scanned_at timestamptz not null default now()`
- `photo_url text` (path in private `inbody-photos` bucket)
- `weight_kg float`
- `body_fat_pct float`
- `muscle_mass_kg float`
- `visceral_fat float`
- `bmr int`
- `raw_extracted_json jsonb` (full OCR/extraction output)
- `ai_notes text` (short coach note on this scan)
- `created_at timestamptz not null default now()`
- RLS: `auth.uid() = user_id` (using + with check).

### `activity_logs`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `logged_at timestamptz not null default now()`
- `activity_type text not null check (activity_type in ('walk','run','gym','cycle','swim','yoga','other'))`
- `duration_min int not null default 0`
- `steps int not null default 0`
- `calories_burned int not null default 0`
- `notes text not null default ''`
- `created_at timestamptz not null default now()`
- RLS: `auth.uid() = user_id` (using + with check).

### Storage
- Private bucket `inbody-photos` with per-user-folder policies
  (`auth.uid()::text = (storage.foldername(name))[1]`) for insert/select/
  delete — mirroring `meal-photos`.

### `daily_summaries` (existing)
- `total_steps` is populated from the day's `activity_logs` steps sum
  (client-side aggregation, consistent with how meals totals are derived).

## Edge Function — `ai-inbody-analysis`

- Deployed via MCP; source at `supabase/functions/ai-inbody-analysis/index.ts`.
- `verify_jwt: true`; derives user from the JWT (same pattern as the other
  two functions). OpenAI `gpt-4o` vision.
- Request: `{ photo_url }` (path in `inbody-photos`). Reads via service-role
  signed URL (bucket is private).
- Response: `{ weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, bmr,
  raw: <object>, notes }`. Missing metrics come back `null` — the model must
  not fabricate values it cannot read.
- Errors return a 4xx/5xx with a JSON `{ error }`; the client surfaces it.

## Client features

Reuse Phase 1 patterns exactly: Zustand v5 + immer stores; every Supabase-
touching action captures `{ data, error }`, sets `error = error?.message ??
null`, toggles `loading`; screens render errors; NativeWind v4; typed
Supabase client (no read-site casts); narrow write-site `Insert` casts only.

1. **InBody store + upload screen** — `inbodyStore`
   (`reports`, `latest`, `loading`, `error`, `fetchReports`, `addReport`).
   `addReport` uploads the photo to `inbody-photos/{userId}/...` via the
   base64→ArrayBuffer pattern (from Phase 1 IMP-3 lesson: store the storage
   PATH, sign on read — do NOT persist a public URL for a private bucket),
   calls `ai-inbody-analysis`, then inserts the row. Screen: capture/pick →
   analyze → show extracted metrics for confirmation → save.
2. **InBody timeline charts** — a `LineChart` component (react-native-svg)
   rendering weight, body-fat %, and muscle mass across scans; empty state
   when <2 scans. Lives on a Body/Progress screen off Home.
3. **Activity store + log screen** — `activityStore`
   (`todayActivity`, `loading`, `error`, `fetchTodayActivity`, `addActivity`).
   Manual entry (type, duration, steps, calories, notes). Dashboard's steps
   ring reads the day's summed steps.
4. **Dashboard wiring** — Home shows today's activity summary and a link to
   the Body/Progress screen; quick-actions include Log Activity and Add
   InBody scan.

## Agent upgrade (`ai-agent`)

- New tools (server-side executors): `log_activity`, `get_inbody_history`,
  `adjust_diet_plan` (the last inserts a new append-only goals row and
  returns a summary). Extend `context.ts` to include the latest InBody
  metrics and recent activity in the assembled context.
- System prompt enriched with the coaching principles above.
- Redeployed via MCP; `lib/database.types.ts` regenerated after the schema
  change.

## Out of scope (Phase 2)

- Health Connect / Amazfit auto-sync (→ Phase 2b).
- PDF InBody ingestion.
- Meal/workout plan generation, morning coach cron, analytics screen (→
  Phase 3).
- Push notifications, offline logging, Play Store prep (→ Phase 4).

## Quality gates

`tsc --noEmit` clean, `jest` all green (new store + util tests, TDD where a
testable unit exists), `expo-doctor` 21/21. On-device verification via a new
EAS APK when requested. Security: RLS on new tables, private bucket, no
client-side secrets, JWT-derived users in the new edge function.
