# Phase 3 — Coaching Intelligence: Design Spec

**Status:** Approved design (2026-09-29). Refines the app-level spec
`2026-09-29-health-coach-app-design.md` for Phase 3 execution.

**Parent spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`
**Builds on:** Phases 1 & 2 (complete on `master`).

## Goal

Make the coach proactive and forward-looking: a daily morning coach note +
AI daily goals, AI-generated weekly meal and workout plans, a progress
analytics view, and an in-context meal-suggestion capability.

## Scope decisions (approved)

- **Morning coach note = pg_cron (6am) + lazy fallback.** A `pg_cron` job
  invokes the `generate-daily-summary` edge function daily; if the cron did
  not run (or today's row lacks `ai_coach_note`), the client lazily invokes
  it for the current user on app open. Both paths hit the same function.
- **Plans get a new bottom tab** → tabs become **Home / Meals / Plans /
  Chat / Settings** (5). This intentionally supersedes the Phase-2 "keep 4
  tabs" guideline because plans are a primary, frequently-revisited surface.
- **Charts stay `react-native-svg`, hand-built.** Reuse the Phase-2
  `LineChart`; ADD a `BarChart` for calorie adherence. **Do NOT add
  `victory-native`** (the outline's mention is superseded — no charting
  library, per the standing ruling). The analytics view EXTENDS the existing
  `app/progress.tsx` (do not create a second progress screen/tab).
- **Goals remain append-only / latest-wins.** Any goal write inserts a new
  row.
- **Edge functions:** `verify_jwt: true`, OpenAI `gpt-4o`, user from JWT.
- **No new npm dependency** is required (react-native-svg, expo-*, etc. all
  present).

## Data model (new)

Applied to remote `ggjrtgowmauoimpvficl` via Supabase MCP AND committed as
`supabase/migrations/<ts>_phase3_coaching_intelligence.sql`.

### `meal_plans`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `week_start_date date not null`
- `plan_json jsonb not null` — shape:
  `{ days: [ { day: "Mon"|"Tue"|…, meals: [ { meal_type, description, calories, protein_g, carbs_g, fat_g } ] } ] }`
- `created_at timestamptz not null default now()`
- RLS `auth.uid() = user_id`. Latest-per-week-start wins (append-only, like goals).

### `workout_plans`
- same columns; `plan_json` shape:
  `{ days: [ { day, focus, exercises: [ { name, sets, reps, notes } ] } ] }`
- RLS `auth.uid() = user_id`. Append-only, latest wins.

### `daily_summaries` (existing) — now actively written
- `generate-daily-summary` upserts today's row with `ai_daily_goals` (jsonb:
  `{calories, protein_g, carbs_g, fat_g, steps, workout_suggestion}`) and
  `ai_coach_note` (text). `unique(user_id, date)` already exists → upsert on
  conflict `(user_id, date)`.

## Edge Function — `generate-daily-summary`

Deployed via MCP/CLI; source at
`supabase/functions/generate-daily-summary/index.ts`. Two invocation modes:

- **Cron mode:** invoked by `pg_cron` via `pg_net` with header
  `x-cron-secret: <CRON_SECRET>` (a new Supabase function secret) plus the
  service-role bearer (passes the gateway). When the secret matches, the
  function iterates all `profiles` (service-role client) and generates for
  each user.
- **User (lazy) mode:** invoked by the client with the user's JWT; derives
  the user via `authClient.auth.getUser()` and generates for that one user.
  If neither a valid cron secret nor a valid user JWT is present → 401.

For each target user the function:
1. Rolls up **yesterday's** meals + activity into that day's
   `daily_summaries` row (calories, macros, steps).
2. Reads recent trend (last ~7 daily summaries, latest goals, latest
   InBody) and calls `gpt-4o` to produce today's `ai_daily_goals` +
   `ai_coach_note` (concise, applies the coaching principles already in the
   agent prompt).
3. Upserts **today's** `daily_summaries` row (on `user_id,date`) with those
   fields.

Idempotent: safe to run multiple times per day (upsert; regenerates the
note). Returns `{ ok: true, generated: <n> }` (cron) or the today row (user).

### Scheduling
- Enable `pg_cron` + `pg_net` extensions (controller, via MCP).
- Schedule: `select cron.schedule('daily-coach', '0 6 * * *', $$ ... pg_net POST to the function with x-cron-secret ... $$)`. 6am UTC (documented; user can shift later). The cron SQL is committed in the migration.

### Lazy fallback (client)
- On app resume / dashboard mount, if today's `daily_summaries` row is
  missing or `ai_coach_note` is null, the dashboard calls
  `generate-daily-summary` (user mode) once, then refreshes. Guarded so it
  fires at most once per app session/day; failure is surfaced but
  non-blocking (dashboard still renders live rings).

## Agent tools (added to `ai-agent`)

- `generate_meal_plan` — the MODEL supplies the full `plan_json` (days →
  meals with macros) as the tool args (same way `log_meal` supplies macros —
  NO nested LLM call inside the executor); the executor persists it as a new
  `meal_plans` row (append-only, latest per week_start wins) and returns a
  summary. Args: `{ week_start_date, plan: <plan_json> }`.
- `generate_workout_plan` — same pattern; model supplies `plan_json`
  (days → exercises); executor inserts a `workout_plans` row. Args:
  `{ week_start_date, plan: <plan_json> }`.
- `get_progress_report` — args `{ start_date?, end_date? }`; returns trend
  data (weight/body-fat/muscle from `inbody_reports`; calorie adherence from
  `daily_summaries`/meals) for the range, for the coach to narrate.
- `get_meal_suggestion` — args `{}`; computes remaining macros for today
  (goals − consumed) and returns a concrete meal suggestion.
All derive identity from the JWT-passed `userId`; controller redeploys.

## Client features

Reuse Phase 1/2 patterns (Zustand v5 + immer; error+loading on every
Supabase action; screens render errors; typed client, write-site casts only;
NativeWind v4; NO mocks in app code).

1. **`plansStore`** — `mealPlan`, `workoutPlan`, `loading`, `error`,
   `fetchPlans` (reads the latest `meal_plans` / `workout_plans` row per
   type), `generateMealPlan`, `generateWorkoutPlan`. The generate actions
   **reuse the existing `ai-agent`** (no new generation edge function): they
   POST a directive message (e.g. "Generate a new 7-day meal plan aligned to
   my goals") to `ai-agent` with the user JWT; the agent calls its
   `generate_meal_plan` / `generate_workout_plan` tool which persists the
   row; the store then re-runs `fetchPlans` to load it. Errors surfaced.
2. **`app/(tabs)/plans.tsx`** (NEW TAB) — weekly meal plan (per-day
   breakfast/lunch/dinner/snack with macros) + workout plan section below;
   "Regenerate" buttons; empty state + loading + error.
3. **`app/(tabs)/_layout.tsx`** — add the Plans tab (5 tabs total) with an
   icon, placed between Meals and Chat.
4. **Analytics** — EXTEND `app/progress.tsx`: keep the existing weight/
   body-fat/muscle `LineChart`s; ADD a `BarChart` (new
   `components/ui/BarChart.tsx`, react-native-svg) for calorie adherence
   (last 30 days consumed vs target). A pure `adherenceSeries` helper
   (unit-tested).
5. **Dashboard** — show today's `ai_coach_note` (from `daily_summaries`);
   run the lazy-generate fallback; add a low-fuel prompt card ("Not enough
   food today — get a suggestion") when calories are well under target later
   in the day, linking to chat / calling `get_meal_suggestion`.

## Cost note
Cron adds one gpt-4o call per user per day; plan/suggestion generation are
on-demand. Acceptable for personal/single-user use; revisit rate-limiting in
Phase 4.

## Out of scope (Phase 3)
- Health Connect (→ Phase 2b). Push notifications, offline, RLS multi-user
  audit, rate-limiting, Play Store (→ Phase 4). PDF InBody.

## Quality gates
`tsc --noEmit` clean; `jest` all green (new store + chart-helper tests, TDD
where a testable unit exists); `expo-doctor` 21/21. Edge functions
smoke-tested (401 without auth; cron secret path). Security: RLS on new
tables, JWT-derived users, cron secret never in client, no client-side AI
keys. On-device via a new EAS APK when requested.
