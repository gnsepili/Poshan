# Phase 3: Coaching Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-generated daily goals (morning coach note), meal plan generation, workout plan generation, and a progress analytics screen.

**Architecture:** Extends Phase 2. New Supabase tables for meal_plans and workout_plans. New agent tools. A Supabase cron job (pg_cron) generates daily summaries and morning coach notes each day at 6am.

**Tech Stack:** All Phase 1–2 stack + `pg_cron` extension in Supabase, `victory-native` for charts

**Spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`

**Prerequisite:** Phase 2 complete and all tests passing.

---

### Task 1: Schema — Meal Plans and Workout Plans

- [ ] Migration: add `meal_plans` table (`id, user_id, week_start_date, plan_json jsonb, created_at`)
- [ ] Migration: add `workout_plans` table (`id, user_id, week_start_date, plan_json jsonb, created_at`)
- [ ] Both with RLS. Regenerate types. Commit.

---

### Task 2: Daily Morning Coach Note (Cron)

- [ ] Enable `pg_cron` in Supabase (Dashboard → Database → Extensions)
- [ ] Create Edge Function `generate-daily-summary` — for each user:
  - Rolls up yesterday's meals + activity into `daily_summaries`
  - Calls AI to generate today's `ai_daily_goals` + `ai_coach_note` based on recent trend
  - Upserts into `daily_summaries` for today
- [ ] Schedule via `pg_cron`: `0 6 * * *` (6am daily, UTC — adjust as needed)
- [ ] Update home dashboard to show `ai_coach_note` from today's `daily_summaries` row
- [ ] Test: manually invoke Edge Function, confirm daily summary + coach note appear on dashboard
- [ ] Commit

---

### Task 3: Meal Plan Generation

- [ ] Add `generate_meal_plan` tool to AI agent: takes `days` (default 7), generates a structured meal plan aligned to user's calorie + macro goals, saves to `meal_plans`
- [ ] Create `stores/mealPlanStore.ts`
- [ ] Create `app/(tabs)/plans.tsx` — "Meal Plan" tab with week view; each day shows breakfast/lunch/dinner/snack with macros
- [ ] "Regenerate" button calls agent tool
- [ ] Test: generate plan, confirm stored and displayed; ask coach "give me a high-protein plan" in chat, confirm plan updates
- [ ] Commit

---

### Task 4: Workout Plan Generation

- [ ] Add `generate_workout_plan` tool to AI agent: generates a weekly workout plan based on goals, current activity level, and InBody data; saves to `workout_plans`
- [ ] Add workout plan section to `app/(tabs)/plans.tsx` below meal plan
- [ ] Test: generate plan, confirm stored and displayed
- [ ] Commit

---

### Task 5: Progress Analytics Screen

- [ ] Create `app/(tabs)/progress.tsx`
- [ ] Charts (using `victory-native`):
  - Weight over time (line chart, from `inbody_reports.weight_kg` + `daily_summaries.weight_kg`)
  - Body fat % over time (line chart, from `inbody_reports`)
  - Calorie adherence (bar chart: daily consumed vs target, last 30 days)
  - Muscle mass over time (line chart, from `inbody_reports`)
- [ ] Add `get_progress_report` tool to AI agent: returns trend data for a date range
- [ ] Test: verify charts render correctly with real data; ask coach "how am I doing this month?" and confirm it uses the tool
- [ ] Commit

---

### Task 6: Meal Suggestion Tool

- [ ] Add `get_meal_suggestion` tool to AI agent: given remaining macros for the day, suggests a specific meal option
- [ ] Update home dashboard: if calories < 80% of target by 3pm, show a prompt card "Not enough food today — tap to get a suggestion"
- [ ] Test: ask coach "what should I eat for dinner?", confirm it calculates remaining macros and gives a specific suggestion
- [ ] Commit
