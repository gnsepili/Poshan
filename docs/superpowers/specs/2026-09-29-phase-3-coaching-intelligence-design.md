# Phase 3 — Coaching Intelligence: Design Spec

**Status:** Approved design (2026-09-29). Refines the app-level spec and the
Phase 3 outline for execution.

**Parent spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`
**Builds on:** Phases 1 & 2 (complete on `master`).

## Goal

Make the coach proactive and planful: a daily coach note + AI daily goals,
AI-generated weekly meal and workout plans, a progress analytics screen, and
in-chat meal suggestions — all reasoning over the health record built in
Phases 1–2 (profile, goals, meals, activity, InBody).

## Scope decisions (approved)

- **Daily coach note is generated LAZILY on app-open, not by cron.** When the
  app opens and today's `daily_summaries` row has no `ai_coach_note`, the
  client calls a `generate-daily-summary` edge function that rolls up recent
  meals/activity, generates today's `ai_daily_goals` + `ai_coach_note`, and
  upserts today's row. No `pg_cron`/`pg_net`, no timezone skew, no work for
  inactive users. (There's no push until Phase 4, so lazy is UX-equivalent.)
  The function is idempotent — a no-op if today's note already exists.
- **Charts use `react-native-svg`** (extend the Phase 2 `LineChart`; add a
  small `BarChart` for calorie adherence). **Do NOT add `victory-native`** or
  any chart library. (Overrides the outline's offhand `victory-native` note.)
- **Navigation: add ONE "Coach" tab** (Home / Meals / Chat / Coach / Settings
  = 5 tabs). The Coach tab hosts the weekly Meal Plan, Workout Plan, and an
  Analytics section. The existing Phase 2 `app/progress.tsx` (InBody timeline)
  is linked from the Coach tab (and stays reachable from Home); Analytics
  reuses `LineChart` and the existing series logic — do NOT duplicate the
  weight/body-fat/muscle charts.
- **Plan generation is fully agentic.** `generate_meal_plan` and
  `generate_workout_plan` are `ai-agent` tools; the Coach tab's "Regenerate"
  button sends a structured request through the SAME agent path chat uses
  (one code path; matches the app's "UI and chat share the same functions"
  philosophy). No separate generation endpoint.
- **Goals remain append-only / latest-wins** (unchanged). `ai_daily_goals`
  lives on the `daily_summaries` row (per-day snapshot), distinct from the
  append-only `goals` table (the standing targets).

## Data model (new)

Applied to remote `ggjrtgowmauoimpvficl` via Supabase MCP AND committed as
`supabase/migrations/<ts>_phase3_coaching.sql`.

### `meal_plans`
- `id uuid pk default uuid_generate_v4()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `week_start_date date not null`
- `plan_json jsonb not null`  — `{ days: [{ date|weekday, meals: [{ meal_type, name, kcal, protein_g, carbs_g, fat_g }] }] }`
- `created_at timestamptz not null default now()`
- RLS `auth.uid() = user_id`. Latest-per-user by `created_at` (append-only, like goals).

### `workout_plans`
- Same shape; `plan_json` — `{ days: [{ weekday, focus, exercises: [{ name, sets, reps, notes }] }] }`.
- RLS `auth.uid() = user_id`. Latest-per-user by `created_at`.

Both are append-only/latest-wins: regeneration inserts a new row; reads take
the most recent by `created_at`.

## Edge Function — `generate-daily-summary`

- Deployed via CLI/MCP; source `supabase/functions/generate-daily-summary/index.ts`.
- `verify_jwt: true`; user from JWT; enforce identity (never body user_id).
- On call: compute today (server date); if a `daily_summaries` row for today
  already has a non-null `ai_coach_note`, return it unchanged (idempotent).
  Otherwise: sum recent meals + activity + read latest goals/InBody, call
  gpt-4o to produce `{ ai_daily_goals: {calories, protein_g, carbs_g, fat_g,
  steps, workout_suggestion}, ai_coach_note: string }`, upsert today's
  `daily_summaries` row (unique on `user_id,date`), and return it.
- Response `{ ai_daily_goals, ai_coach_note, date }`. Errors `{ error }` + status.

## Agent upgrade (`ai-agent`) — new tools

Add to `tools.ts` + route in `executeTool` (all derive from JWT `userId`):
- `generate_meal_plan(days=7, emphasis?)` — build a plan aligned to the latest
  goals/macros, `.insert()` a `meal_plans` row (append-only), return a summary.
- `generate_workout_plan(days=7, emphasis?)` — from goals + activity level +
  latest InBody, `.insert()` a `workout_plans` row, return a summary.
- `get_meal_suggestion()` — compute remaining macros for today (goal − consumed)
  and suggest one concrete meal fitting them.
- `get_progress_report(range_days=30)` — return trend data (weight/body-fat/
  muscle from `inbody_reports`; calorie adherence from meals vs goal) for the
  chat coach.
Extend `context.ts` to mention whether a current meal/workout plan exists.
Redeploy `ai-agent` (v4).

## Client features (reuse Phase 1–2 patterns exactly)

Zustand v5 + immer; every Supabase action captures `{data,error}`, sets
`error = error?.message ?? null`, toggles `loading`; screens render errors;
typed client, no read-site `as unknown as`; NativeWind v4; no mock data.

1. **`plansStore`** — `mealPlan`, `workoutPlan`, `loading`, `error`,
   `fetchPlans` (latest of each), `regenerateMealPlan`/`regenerateWorkoutPlan`
   (send a structured message through the agent client, then re-fetch).
2. **Coach tab** `app/(tabs)/coach.tsx` — weekly Meal Plan (day → meals with
   macros), Workout Plan (day → exercises), Regenerate buttons, and an
   Analytics section; links to the InBody timeline (`app/progress.tsx`).
3. **`BarChart`** (react-native-svg) — calorie adherence (consumed vs target,
   last N days). Pure scaling helper unit-tested (empty/single/all-equal/
   over-100%). Reuse `LineChart` + existing series logic for weight/body-fat/
   muscle (extract shared series util if needed; keep DRY).
4. **Dashboard** — show today's `ai_coach_note` (trigger lazy
   `generate-daily-summary` on open when missing); show a "get a suggestion"
   prompt card when calories < 80% of target after mid-afternoon (calls the
   agent's `get_meal_suggestion` via chat).
5. **`dailySummaryStore`** — extend to trigger/read the lazy coach note.

## Out of scope (Phase 3)

- Scheduled cron / server-initiated generation (lazy instead).
- Push notifications, offline, RLS multi-user audit, rate-limiting, Play Store
  (→ Phase 4).
- Health Connect (→ Phase 2b).

## Quality gates

`tsc --noEmit` clean; `jest` all green (new store + chart-util tests, TDD where
a testable unit exists); `expo-doctor` 21/21. Edge fns: `verify_jwt`,
JWT-derived user, no client secrets, RLS on new tables. On-device via a new EAS
APK when requested.
