# Phase 2: Health Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add InBody report upload + analysis, Android Health Connect sync (Amazfit/steps/heart rate), and manual activity logging.

**Architecture:** Extends Phase 1. New Edge Function for InBody OCR. Health Connect reads on-device via `expo-health-connect`, syncs to `activity_logs` table. InBody data stored in `inbody_reports`, drives AI commentary and goal adjustment suggestions.

**Tech Stack:** All Phase 1 stack + `expo-health-connect`, Supabase Edge Function `ai-inbody-analysis`

**Spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`

**Prerequisite:** Phase 1 complete and all tests passing.

## Global Constraints
Same as Phase 1, plus:
- Health Connect: request only the permissions actually used (steps, active calories, heart rate, sleep, workout sessions)
- InBody extraction must handle both photo and PDF inputs
- De-duplicate Health Connect sync by `(user_id, logged_at, source='health_connect')`

---

### Task 1: Supabase Schema — Phase 2 Tables

- [ ] Create migration `supabase/migrations/20260929000001_phase2_schema.sql`
- [ ] Add `inbody_reports` table (see spec for columns) with RLS
- [ ] Add `activity_logs` table with RLS and unique constraint on `(user_id, logged_at, source)`
- [ ] Create `inbody-reports` private Storage bucket with same folder-based RLS as `meal-photos`
- [ ] Regenerate TypeScript types: `npx supabase gen types typescript --local > lib/database.types.ts`
- [ ] Add `InBodyReport` and `ActivityLog` types to `types/index.ts`
- [ ] Commit

---

### Task 2: Edge Function — InBody Analysis

- [ ] Create `supabase/functions/ai-inbody-analysis/index.ts`
- [ ] Accept `{ file_url: string, user_id: string }` — file can be image or PDF
- [ ] Get signed URL from Supabase Storage
- [ ] Call AI with vision: extract all InBody fields (weight, body fat %, muscle mass, BMR, visceral fat, body water, BMI)
- [ ] Fetch previous InBody report for same user, generate `ai_commentary` comparing the two
- [ ] Insert result into `inbody_reports`
- [ ] Return extracted metrics + commentary
- [ ] Deploy: `npx supabase functions deploy ai-inbody-analysis`
- [ ] Smoke test with a real InBody photo
- [ ] Commit

---

### Task 3: InBody Store + Upload Screen

- [ ] Create `stores/inbodyStore.ts` — `{ reports, loading, error, fetchReports, uploadReport }`
- [ ] Write failing store test, implement, confirm passing
- [ ] Create `lib/api/inbody.ts` — calls `ai-inbody-analysis` Edge Function
- [ ] Create `app/(tabs)/inbody.tsx` with:
  - Upload button (ImagePicker — photo or document picker for PDF)
  - Processing state while Edge Function runs
  - List of past scans with key metrics
  - AI commentary per scan
- [ ] Add InBody tab to `app/(tabs)/_layout.tsx`
- [ ] Test: upload a scan, confirm metrics extracted and stored
- [ ] Commit

---

### Task 4: InBody Timeline Charts

- [ ] Install `react-native-chart-kit` or `victory-native`
- [ ] Create `components/inbody/InBodyTimeline.tsx` — line chart of weight, body fat %, muscle mass over time
- [ ] Show on InBody screen below scan list
- [ ] Add `get_inbody_history` tool to the AI agent (in `supabase/functions/ai-agent/tools.ts`)
- [ ] Test: verify chart renders with 2+ scans
- [ ] Commit

---

### Task 5: Health Connect Integration

- [ ] Install: `npx expo install expo-health-connect`
- [ ] Add Health Connect permissions to `app.json` android config
- [ ] Create `lib/healthConnect.ts`:
  - `requestPermissions()` — steps, active calories, heart rate, sleep, exercise sessions
  - `syncToday()` — reads today's data, writes to `activity_logs` with `source='health_connect'`, de-dupes by timestamp
- [ ] Call `syncToday()` on app foreground resume (in root `_layout.tsx`)
- [ ] Add Health Connect permission request to onboarding step
- [ ] Test: on real Android device with Amazfit/Zepp installed, confirm step data appears
- [ ] Commit

---

### Task 6: Activity Log Screen + Manual Logging

- [ ] Create `stores/activityStore.ts` — `{ logs, loading, error, fetchTodayActivity, addActivity }`
- [ ] Write failing store test, implement, confirm passing
- [ ] Create `app/(tabs)/activity.tsx`:
  - Today's step count + active calories (from Health Connect sync)
  - Manual log form: activity type, duration, calories burned
  - Activity history list
- [ ] Add `log_activity` and `get_activity_summary` tools to AI agent
- [ ] Update home dashboard to show step progress ring (replace "—" placeholder)
- [ ] Test: log a workout manually, confirm it appears; confirm Health Connect data shows
- [ ] Commit

---

### Task 7: AI Goal Adjustment Based on InBody

- [ ] Add `adjust_diet_plan` tool to AI agent: re-evaluates goals given latest InBody vs previous scan + progress over last 30 days
- [ ] After InBody upload: agent proactively checks if adjustment is warranted, sends notification message to chat if yes
- [ ] Test: upload InBody showing body fat increase, confirm agent suggests calorie/macro adjustment
- [ ] Commit
