# Phase 4: Polish & Production (incl. Health Connect) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make poshan-ai production-ready and connect real activity data — Health Connect (Google Fit) sync, push notifications, offline meal logging, an RLS multi-user audit, AI rate-limiting / cost controls, self-hosted error monitoring + analytics, and Play Store preparation.

**Architecture:** Extends Phases 1–3 (React Native + Expo Router + Supabase). The app moves from the default managed client to a **config-plugin (custom) build** because Health Connect and push are native modules: `react-native-health-connect` and `expo-notifications` are added with their Expo config plugins and take effect on the next EAS `preview`/`production` build. New Deno edge function `send-push` (Expo Push API, cron-secret-guarded like `generate-daily-summary`) becomes the single server-side push send path, and the morning cron sends the coach note through it. Five new tables (`activity_logs.source` column + dedup index, `push_tokens`, `ai_usage`, `error_logs`, `events`) with RLS. Offline meal logging adds an AsyncStorage queue to `mealsStore` flushed on reconnect via NetInfo. Rate-limiting adds an atomic per-user daily counter enforced in the three AI edge functions. Monitoring is **self-hosted in Supabase** (not Sentry). Pure logic — HC dedup/aggregation, offline queue, rate-limit counter, push-token shaping, telemetry shaping — is TDD'd; native module behavior is verified on a user device.

**Tech Stack:** All Phase 1–3 stack (React Native 0.86, Expo SDK 57, Expo Router v5, TypeScript strict, NativeWind v4, Zustand v5 + immer, Supabase JS v2, Supabase Edge Functions Deno + OpenAI `gpt-4o`, `react-native-svg`, `@react-native-async-storage/async-storage`, Jest + RNTL) **plus three new native/JS deps introduced in this phase:** `react-native-health-connect` (Task 1), `expo-notifications` (Task 2), `@react-native-community/netinfo` (Task 3). EAS Build + Submit for the Play Store.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-4-polish-design.md`

**Prerequisite:** Phase 3 complete and all tests passing (`npx tsc --noEmit` clean, `npx jest` all pass). Supabase remote project: `ggjrtgowmauoimpvficl`. EAS project id: `e0aed009-415a-478c-9917-3cb381442217`.

## Global Constraints

Carry every Phase 1–3 constraint, plus the following (copied verbatim from the Phase 4 spec's approved scope decisions and quality gates):

- **Activity sync = Health Connect** (not the deprecated Google Fit API). Read data that Google Fit (and other apps) write into Health Connect.
- **Health Connect data pulled:** steps, active calories, heart rate, workouts/exercise sessions. Read permissions requested for `Steps`, `ActiveCaloriesBurned`, `HeartRate`, and `ExerciseSession`.
- **Health Connect is Android-only.** Handle "Health Connect not installed / not available" gracefully (show a fallback message; iOS unaffected — keeps manual logging). On-device verification (Health Connect read, push receipt) is a user step (no emulator path).
- **Schema:** `activity_logs.source text not null default 'manual'` (`'manual' | 'health_connect'`) + a dedup unique index on `(user_id, source, logged_at, activity_type)` so re-sync of HC-sourced rows is idempotent. Steps/HR aggregates update the day's dashboard live rather than inserting rows.
- **Push:** `expo-notifications`; token stored in `push_tokens (user_id, token, platform, created_at)`, RLS per-user, `token` unique. Sending is server-side via the **Expo Push API** (`https://exp.host/--/api/v2/push/send`) from a `send-push` edge function (service-role, cron-secret-guarded like `generate-daily-summary`) — the single send path. The morning cron (`generate-daily-summary`) sends the coach note through it (best-effort, per user token). **FCM v1 service-account key upload to EAS (`eas credentials`) is a one-time documented user step; the code is complete without it.**
- **Offline meal logging:** on `addMeal` network failure, enqueue the meal in AsyncStorage; `flushQueue` runs on reconnect (NetInfo) / app foreground, inserts queued meals in order, surfaces per-item errors; photos captured offline queue the local URI and upload on flush. Pure queue logic (enqueue/dequeue/merge) is unit-tested.
- **RLS multi-user audit:** every table's RLS is `auth.uid() = user_id` (using + with check); storage policies per-user-folder; no table/policy leaks across users. Fix the store-reset-on-signout gap (auth store clears all Zustand stores on sign-out). Commit any policy change as a migration. Advisor runs = controller.
- **AI rate-limiting = cost control:** shared per-user daily call budget in `ai-agent`, `ai-meal-analysis`, `ai-inbody-analysis`, and plan generation (plan generation runs inside `ai-agent`'s tools, guarded there); an `ai_usage(user_id, date, count)` table incremented per call; over a configurable daily cap → friendly **429**; the client surfaces "daily AI limit reached." Caps are generous defaults, env-configurable (`AI_DAILY_CALL_CAP`, default 50).
- **Error monitoring/analytics = self-hosted in Supabase** — tables `error_logs(user_id?, context, message, stack?, created_at)` and `events(user_id?, name, props jsonb, created_at)` (RLS: insert by authenticated user; read restricted to own). A `lib/telemetry.ts` logs client errors (error boundary + store-action failures) and key events (meal logged, plan generated, HC synced). Edge functions log failures to `error_logs` via service role. **NOT Sentry / no external service.**
- **Play Store:** this project prepares the production build + metadata + `eas submit` config; the `production` EAS profile builds an **AAB** with `autoIncrement` versionCode; add a privacy-policy URL (Health Connect requires one), an `eas submit` profile, and `docs/play-store-listing.md` (title, short/full description, screenshots checklist, data-safety incl. Health Connect data types). **The Google Play Developer account and the actual submission are the user's manual steps.**
- Carry standing rulings: goals/plans append-only / latest-wins; edge fns `verify_jwt: true`, OpenAI `gpt-4o`, user from JWT (`authClient.auth.getUser()`), never trust a body `user_id`, except the cron-secret dual-mode pattern already used by `generate-daily-summary`; CORS + `OPTIONS`; no hardcoded/client secrets; private buckets store PATH; charts `react-native-svg` only; TypeScript strict — no `any`, typed Supabase client, **no read-site `as unknown as`** (narrow read-site `as X`/`as X[]` OK), write-site `as unknown as <Insert>` only; Zustand v5 + immer, every store action that touches Supabase captures `{ data, error }`, sets `error = error?.message ?? null`, toggles `loading`, and every screen renders its store `error`.
- **Schema + edge deploys + EAS builds + credentials are CONTROLLER-run.** The **implementer** authors migration SQL, edge-function/native source, and config-plugin edits and **cannot** run Supabase MCP or EAS. The **controller** applies migrations to `ggjrtgowmauoimpvficl`, regenerates `lib/database.types.ts`, deploys/redeploys functions, sets function secrets, runs EAS builds, uploads credentials, and runs advisors — recording each in the execution ledger (as in Phase 2/3). This split is stated per task.
- Quality gates per task: `npx tsc --noEmit` clean **and** `npx jest` all pass. TDD for stores and pure utils; native-module behavior (HC read, push receipt) can't be jest/tsc-unit-tested and is device-verified by the user. Screens that only compose already-tested store actions do not need dedicated tests (noted per task). `npx expo-doctor` — all checks pass (new native deps ship with config plugins / are Expo-compatible).

## Review Focus

These are the failure classes the spec implies but that no task's happy-path tests exercise; each is pinned to a test/verification in the owning task, most-likely-to-bite first.

1. **Health Connect re-sync duplicating activity rows.** Pressing "Sync now" (or a foreground re-sync) must not insert a second `activity_logs` row for an exercise session already synced today — the dedup unique index `(user_id, source, logged_at, activity_type)` + a stable `logged_at` (= session start) must make it idempotent. → Task 1: `sessionsToActivityRows` uses `startTime` as `logged_at` and collapses duplicate keys within a pull; `healthConnectStore.syncNow` upserts with `onConflict: 'user_id,source,logged_at,activity_type'` + `ignoreDuplicates: true` (store test asserts the conflict target + flag).
2. **Rate-limit off-by-one / not resetting per day.** Exactly `cap` AI calls must be allowed per user per calendar day — the `cap`-th allowed, the `cap+1`-th denied — and the counter must reset at midnight (new `date` key), never leaking yesterday's count. → Task 5: `evaluateUsage` test (`null,50→{true,1}`; `49,50→{true,50}`; `50,50→{false,51}`) + controller RPC smoke test that a new `date` starts at 1.
3. **Offline queue losing or double-inserting a meal on flaky reconnect.** A flush interrupted mid-way must not drop the un-inserted meals and must not re-insert an already-inserted one when the flush retries; concurrent flushes must not double-insert. → Task 3: `mealQueue` de-dupes by client `id`; `mealsStore.flushQueue` inserts with the explicit client `id` (duplicate-key ⇒ treated as done), stops on a real failure keeping the remainder, and is guarded by a `flushing` flag (store tests cover each).
4. **Push token duplicate / stale.** Registering the same device twice, or a device whose token was reassigned to another user, must not create duplicate `push_tokens` rows; a token Expo reports as `DeviceNotRegistered` must be removed so the coach note isn't sent into the void. → Task 2: `buildPushTokenRow` rejects empty/garbage tokens; `pushStore.registerForPush` upserts with `onConflict: 'token'`; `send-push` deletes tokens Expo reports unregistered (store test covers the upsert conflict target).
5. **Store not reset across users on the same device.** After user A signs out and user B signs in on the same device, none of A's meals/plans/summary/etc. may remain in memory. → Task 4: `resetAllStores` clears every data store to its initial state and `authStore.signOut` calls it (tests cover both).

---

## File Structure

```
poshan-ai/
├── app/
│   ├── _layout.tsx                         # MODIFY: ErrorBoundary wrap, register health-connect route, register push token on login, NetInfo/foreground offline flush
│   ├── health-connect.tsx                  # NEW: HC permission/onboarding + Sync now + not-available fallback (Task 1)
│   ├── (tabs)/
│   │   ├── _layout.tsx                     # MODIFY: pending-meal badge on Meals tab (Task 3)
│   │   ├── index.tsx                       # MODIFY: HC availability check + foreground sync + steps/active-cal into rings (Task 1)
│   │   └── settings.tsx                    # MODIFY: "Health Connect" entry link (Task 1)
├── components/
│   └── ErrorBoundary.tsx                   # NEW: top-level error boundary → telemetry (Task 6)
├── lib/
│   ├── api/
│   │   ├── agent.ts                        # MODIFY: 429 → AI_LIMIT_MESSAGE (Task 5)
│   │   ├── inbody.ts                       # MODIFY: 429 → AI_LIMIT_MESSAGE (Task 5)
│   │   └── mealAnalysis.ts                 # MODIFY: 429 → AI_LIMIT_MESSAGE (Task 5)
│   ├── telemetry.ts                        # NEW: shapeError / logError / logEvent (Task 6)
│   ├── storeReset.ts                       # NEW: resetAllStores (Task 4)
│   └── utils/
│       ├── healthConnect.ts               # NEW: dedup key + aggregation + session mapping (Task 1)
│       ├── pushToken.ts                    # NEW: buildPushTokenRow (Task 2)
│       ├── mealQueue.ts                    # NEW: enqueue/remove pure queue ops (Task 3)
│       └── rateLimit.ts                    # NEW: evaluateUsage + AI_LIMIT_MESSAGE (Task 5)
├── stores/
│   ├── healthConnectStore.ts              # NEW (Task 1)
│   ├── pushStore.ts                       # NEW (Task 2)
│   ├── mealsStore.ts                      # MODIFY: offline queue + flushQueue + pendingCount (Task 3)
│   └── authStore.ts                       # MODIFY: signOut → resetAllStores (Task 4)
├── types/
│   └── index.ts                           # MODIFY: ActivitySource + ActivityLog.source, PushPlatform (Task 1/2)
├── supabase/
│   ├── functions/
│   │   ├── _shared/logError.ts            # NEW: logEdgeError (Task 6, deployed with each fn)
│   │   ├── send-push/index.ts             # NEW: Expo Push API, cron-secret-guarded (Task 2)
│   │   ├── generate-daily-summary/index.ts# MODIFY: cron sends coach note via send-push (Task 2); error_logs (Task 6)
│   │   ├── ai-agent/index.ts              # MODIFY: rate-limit guard (Task 5); error_logs (Task 6)
│   │   ├── ai-meal-analysis/index.ts      # MODIFY: rate-limit guard (Task 5); error_logs (Task 6)
│   │   └── ai-inbody-analysis/index.ts    # MODIFY: rate-limit guard (Task 5); error_logs (Task 6)
│   └── migrations/
│       ├── 20260929040000_phase4_activity_source.sql   # NEW: activity_logs.source + dedup index (Task 1)
│       ├── 20260929050000_phase4_push_tokens.sql       # NEW: push_tokens + RLS (Task 2)
│       ├── 20260929060000_phase4_rls_audit.sql         # NEW: idempotent RLS hardening (Task 4)
│       ├── 20260929070000_phase4_ai_usage.sql          # NEW: ai_usage + atomic RPC (Task 5)
│       └── 20260929080000_phase4_telemetry.sql         # NEW: error_logs + events + RLS (Task 6)
├── app.json                               # MODIFY: HC + notifications plugins, permissions (Task 1/2), privacy-policy (Task 7)
├── eas.json                               # MODIFY: production AAB + submit profile (Task 7)
├── package.json                           # MODIFY: 3 new deps across Tasks 1/2/3
├── docs/
│   ├── play-store-listing.md              # NEW (Task 7)
│   └── privacy-policy.md                  # NEW: placeholder (Task 7)
└── __tests__/
    ├── lib/
    │   ├── healthConnect.test.ts          # NEW (Task 1)
    │   ├── pushToken.test.ts              # NEW (Task 2)
    │   ├── mealQueue.test.ts              # NEW (Task 3)
    │   ├── rateLimit.test.ts              # NEW (Task 5)
    │   └── telemetry.test.ts              # NEW (Task 6)
    └── stores/
        ├── healthConnectStore.test.ts     # NEW (Task 1)
        ├── pushStore.test.ts              # NEW (Task 2)
        ├── mealsStore.test.ts             # MODIFY: offline queue tests (Task 3)
        └── storeReset.test.ts             # NEW (Task 4)
```

---

### Task 1: Health Connect activity sync

**Files:**
- Create: `lib/utils/healthConnect.ts`
- Create: `__tests__/lib/healthConnect.test.ts`
- Create: `stores/healthConnectStore.ts`
- Create: `__tests__/stores/healthConnectStore.test.ts`
- Create: `app/health-connect.tsx`
- Create: `supabase/migrations/20260929040000_phase4_activity_source.sql`
- Modify: `types/index.ts` (add `ActivitySource`; extend `ActivityLog`)
- Modify: `app.json` (add `react-native-health-connect` plugin + Health Connect read permissions)
- Modify: `package.json` (adds `react-native-health-connect` via `npx expo install`)
- Modify: `app/_layout.tsx` (register `health-connect` route)
- Modify: `app/(tabs)/settings.tsx` (Health Connect entry link)
- Modify: `app/(tabs)/index.tsx` (availability check + foreground sync + steps/active-cal into rings)
- Regenerated by controller: `lib/database.types.ts`

**Interfaces:**
- Consumes: `ActivityType` from `types`; typed `supabase` client; `react-native-health-connect`.
- Produces (TS): `ActivitySource = 'manual' | 'health_connect'`, `HcExerciseSession`, `HcActivityRow`, `hcExerciseToActivityType(exerciseType: number): ActivityType`, `hcDedupKey(userId, loggedAt, activityType): string`, `sessionsToActivityRows(userId: string, sessions: HcExerciseSession[]): HcActivityRow[]`, `sumStepsRecords(records: { count: number }[]): number`, `sumActiveCaloriesRecords(records: { energy: { inKilocalories: number } }[]): number` from `lib/utils/healthConnect.ts`.
- Produces (store): `useHealthConnectStore` — `{ available: boolean | null, permissionGranted: boolean, todaySteps: number, todayActiveCalories: number, syncing: boolean, error: string | null, lastSyncedAt: string | null, checkAvailability(): Promise<void>, requestPermissions(): Promise<void>, syncNow(userId: string): Promise<void> }`.
- Produces (DB): `activity_logs.source` column + dedup unique index.

- [ ] **Step 1: Add the dependency** (native dep; the one place Phase 4 adds a Health Connect module)

Run: `npx expo install react-native-health-connect`
Expected: `package.json` gains `react-native-health-connect` under `dependencies`; install completes with no peer-dependency error.

- [ ] **Step 2: Write the failing pure-helper test** (Review Focus #1 — stable dedup key / no in-pull duplicates)

`__tests__/lib/healthConnect.test.ts`:
```typescript
import {
  hcExerciseToActivityType,
  hcDedupKey,
  sessionsToActivityRows,
  sumStepsRecords,
  sumActiveCaloriesRecords,
  HcExerciseSession,
} from '../../lib/utils/healthConnect'

describe('hcExerciseToActivityType', () => {
  it('maps known Health Connect exercise types', () => {
    expect(hcExerciseToActivityType(79)).toBe('walk')
    expect(hcExerciseToActivityType(56)).toBe('run')
    expect(hcExerciseToActivityType(8)).toBe('cycle')
    expect(hcExerciseToActivityType(73)).toBe('swim')
    expect(hcExerciseToActivityType(70)).toBe('gym')
    expect(hcExerciseToActivityType(83)).toBe('yoga')
  })
  it('falls back to "other" for an unknown type', () => {
    expect(hcExerciseToActivityType(9999)).toBe('other')
  })
})

describe('hcDedupKey', () => {
  it('is stable for the same user + start time + activity type', () => {
    const a = hcDedupKey('u1', '2026-09-29T06:00:00.000Z', 'run')
    const b = hcDedupKey('u1', '2026-09-29T06:00:00.000Z', 'run')
    expect(a).toBe(b)
    expect(a).toBe('u1|health_connect|2026-09-29T06:00:00.000Z|run')
  })
})

describe('sessionsToActivityRows', () => {
  const sessions: HcExerciseSession[] = [
    { startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56, title: 'Morning run' },
    { startTime: '2026-09-29T18:00:00.000Z', endTime: '2026-09-29T18:45:00.000Z', exerciseType: 70 },
  ]
  it('maps each session, using startTime as the stable logged_at', () => {
    const rows = sessionsToActivityRows('u1', sessions)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      user_id: 'u1', source: 'health_connect', activity_type: 'run',
      duration_min: 30, steps: 0, calories_burned: 0, notes: 'Morning run',
      logged_at: '2026-09-29T06:00:00.000Z',
    })
    expect(rows[1].activity_type).toBe('gym')
    expect(rows[1].duration_min).toBe(45)
    expect(rows[1].notes).toBe('')
  })
  it('collapses duplicate sessions within a single pull (no double row for one session)', () => {
    const dup = [sessions[0], { ...sessions[0] }]
    expect(sessionsToActivityRows('u1', dup)).toHaveLength(1)
  })
})

describe('aggregation helpers', () => {
  it('sums step counts', () => {
    expect(sumStepsRecords([{ count: 1200 }, { count: 800 }])).toBe(2000)
  })
  it('sums active kilocalories, rounded', () => {
    expect(sumActiveCaloriesRecords([{ energy: { inKilocalories: 120.4 } }, { energy: { inKilocalories: 79.9 } }])).toBe(200)
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest __tests__/lib/healthConnect.test.ts`
Expected: FAIL — cannot find module `lib/utils/healthConnect`.

- [ ] **Step 4: Implement the pure helpers**

`lib/utils/healthConnect.ts`:
```typescript
import { ActivityType } from '../../types'

export type ActivitySource = 'manual' | 'health_connect'

export interface HcExerciseSession {
  startTime: string
  endTime: string
  exerciseType: number
  title?: string
}

export interface HcActivityRow {
  user_id: string
  source: 'health_connect'
  activity_type: ActivityType
  duration_min: number
  steps: number
  calories_burned: number
  notes: string
  logged_at: string
}

// androidx Health Connect ExerciseSessionRecord type constants. Best-effort mapping;
// unknown types fall back to 'other'. The specific int↔type pairing is verified
// on-device (native behavior cannot be unit-tested here).
const EXERCISE_TYPE_TO_ACTIVITY: Record<number, ActivityType> = {
  8: 'cycle', // EXERCISE_TYPE_BIKING
  56: 'run', // EXERCISE_TYPE_RUNNING
  70: 'gym', // EXERCISE_TYPE_STRENGTH_TRAINING
  73: 'swim', // EXERCISE_TYPE_SWIMMING_POOL
  79: 'walk', // EXERCISE_TYPE_WALKING
  83: 'yoga', // EXERCISE_TYPE_YOGA
}

export function hcExerciseToActivityType(exerciseType: number): ActivityType {
  return EXERCISE_TYPE_TO_ACTIVITY[exerciseType] ?? 'other'
}

// Stable dedup key matching the DB unique index (user_id, source, logged_at, activity_type).
// Same session on a later re-sync yields the same key, so upsert never duplicates it.
export function hcDedupKey(userId: string, loggedAt: string, activityType: ActivityType): string {
  return `${userId}|health_connect|${loggedAt}|${activityType}`
}

export function sessionsToActivityRows(userId: string, sessions: HcExerciseSession[]): HcActivityRow[] {
  const byKey = new Map<string, HcActivityRow>()
  for (const s of sessions) {
    const activity_type = hcExerciseToActivityType(s.exerciseType)
    const duration_min = Math.max(0, Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000))
    const row: HcActivityRow = {
      user_id: userId,
      source: 'health_connect',
      activity_type,
      duration_min,
      steps: 0,
      calories_burned: 0,
      notes: s.title ?? '',
      logged_at: s.startTime, // stable => idempotent key on re-sync
    }
    byKey.set(hcDedupKey(userId, row.logged_at, activity_type), row)
  }
  return Array.from(byKey.values())
}

export function sumStepsRecords(records: { count: number }[]): number {
  return records.reduce((a, r) => a + (r.count ?? 0), 0)
}

export function sumActiveCaloriesRecords(records: { energy: { inKilocalories: number } }[]): number {
  return Math.round(records.reduce((a, r) => a + (r.energy?.inKilocalories ?? 0), 0))
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest __tests__/lib/healthConnect.test.ts`
Expected: PASS.

- [ ] **Step 6: Extend the types** — append to `types/index.ts` and extend `ActivityLog`

Change the existing `ActivityLog` interface to add a `source` field:
```typescript
export interface ActivityLog {
  id: string
  user_id: string
  logged_at: string
  activity_type: ActivityType
  duration_min: number
  steps: number
  calories_burned: number
  notes: string
  source: ActivitySource
  created_at: string
}
```
Add above it (after the `ActivityType` export):
```typescript
export type ActivitySource = 'manual' | 'health_connect'
```

- [ ] **Step 7: Author the schema migration**

`supabase/migrations/20260929040000_phase4_activity_source.sql`:
```sql
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
```

- [ ] **Step 8: Write the failing store test** (Review Focus #1 — idempotent upsert conflict target)

`__tests__/stores/healthConnectStore.test.ts`:
```typescript
/// <reference types="jest" />
import { useHealthConnectStore } from '../../stores/healthConnectStore'
import { supabase } from '../../lib/supabase'
import * as HC from 'react-native-health-connect'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(),
  getSdkStatus: jest.fn(),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3, SDK_UNAVAILABLE: 1 },
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
}))

describe('healthConnectStore', () => {
  beforeEach(() => {
    useHealthConnectStore.setState({
      available: null, permissionGranted: false, todaySteps: 0, todayActiveCalories: 0,
      syncing: false, error: null, lastSyncedAt: null,
    })
    jest.clearAllMocks()
  })

  it('checkAvailability sets available=true when the SDK is available', async () => {
    ;(HC.getSdkStatus as jest.Mock).mockResolvedValue(3)
    await useHealthConnectStore.getState().checkAvailability()
    expect(useHealthConnectStore.getState().available).toBe(true)
  })

  it('syncNow upserts sessions with the dedup conflict target and sets today aggregates', async () => {
    ;(HC.readRecords as jest.Mock).mockImplementation((type: string) => {
      if (type === 'Steps') return Promise.resolve({ records: [{ count: 1200 }, { count: 800 }] })
      if (type === 'ActiveCaloriesBurned') return Promise.resolve({ records: [{ energy: { inKilocalories: 150 } }] })
      return Promise.resolve({
        records: [{ startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56 }],
      })
    })
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await useHealthConnectStore.getState().syncNow('u1')

    expect(supabase.from).toHaveBeenCalledWith('activity_logs')
    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      { onConflict: 'user_id,source,logged_at,activity_type', ignoreDuplicates: true }
    )
    expect(useHealthConnectStore.getState().todaySteps).toBe(2000)
    expect(useHealthConnectStore.getState().todayActiveCalories).toBe(150)
    expect(useHealthConnectStore.getState().error).toBeNull()
  })

  it('syncNow surfaces an upsert error', async () => {
    ;(HC.readRecords as jest.Mock).mockImplementation((type: string) =>
      type === 'ExerciseSession'
        ? Promise.resolve({ records: [{ startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56 }] })
        : Promise.resolve({ records: [] })
    )
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: { message: 'sync boom' } }) })

    await useHealthConnectStore.getState().syncNow('u1')
    expect(useHealthConnectStore.getState().error).toBe('sync boom')
  })
})
```

- [ ] **Step 9: Run the test to confirm it fails**

Run: `npx jest __tests__/stores/healthConnectStore.test.ts`
Expected: FAIL — cannot find module `stores/healthConnectStore`.

- [ ] **Step 10: Implement the store**

`stores/healthConnectStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  readRecords,
} from 'react-native-health-connect'
import { supabase } from '../lib/supabase'
import {
  sessionsToActivityRows,
  sumStepsRecords,
  sumActiveCaloriesRecords,
  HcExerciseSession,
} from '../lib/utils/healthConnect'

// Read-only Health Connect permissions the spec requires.
const HC_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'ExerciseSession' },
]

interface HealthConnectState {
  available: boolean | null
  permissionGranted: boolean
  todaySteps: number
  todayActiveCalories: number
  syncing: boolean
  error: string | null
  lastSyncedAt: string | null
  checkAvailability: () => Promise<void>
  requestPermissions: () => Promise<void>
  syncNow: (userId: string) => Promise<void>
}

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() } as const
}

export const useHealthConnectStore = create<HealthConnectState>()(
  immer((set) => ({
    available: null,
    permissionGranted: false,
    todaySteps: 0,
    todayActiveCalories: 0,
    syncing: false,
    error: null,
    lastSyncedAt: null,

    checkAvailability: async () => {
      try {
        const status = await getSdkStatus()
        set((s) => { s.available = status === SdkAvailabilityStatus.SDK_AVAILABLE })
      } catch {
        // iOS / no Health Connect: not available, fall back to manual logging.
        set((s) => { s.available = false })
      }
    },

    requestPermissions: async () => {
      set((s) => { s.error = null })
      try {
        const ok = await initialize()
        if (!ok) {
          set((s) => { s.available = false; s.error = 'Health Connect is not available on this device.' })
          return
        }
        const granted = await requestPermission(HC_PERMISSIONS as unknown as Parameters<typeof requestPermission>[0])
        set((s) => { s.permissionGranted = Array.isArray(granted) && granted.length > 0 })
      } catch (e) {
        set((s) => { s.error = e instanceof Error ? e.message : String(e) })
      }
    },

    syncNow: async (userId) => {
      set((s) => { s.syncing = true; s.error = null })
      try {
        const range = todayRange()
        const [stepsRes, calRes, sessionRes] = await Promise.all([
          readRecords('Steps', { timeRangeFilter: range }),
          readRecords('ActiveCaloriesBurned', { timeRangeFilter: range }),
          readRecords('ExerciseSession', { timeRangeFilter: range }),
        ])
        const steps = sumStepsRecords((stepsRes.records ?? []) as { count: number }[])
        const activeCalories = sumActiveCaloriesRecords((calRes.records ?? []) as { energy: { inKilocalories: number } }[])
        const rows = sessionsToActivityRows(userId, (sessionRes.records ?? []) as unknown as HcExerciseSession[])

        let error: string | null = null
        if (rows.length > 0) {
          // Idempotent: the dedup unique index collapses a re-synced session (Review Focus #1).
          const { error: upsertError } = await supabase
            .from('activity_logs')
            .upsert(rows as unknown as never, { onConflict: 'user_id,source,logged_at,activity_type', ignoreDuplicates: true })
          error = upsertError?.message ?? null
        }

        set((s) => {
          s.syncing = false
          s.todaySteps = steps
          s.todayActiveCalories = activeCalories
          s.lastSyncedAt = new Date().toISOString()
          s.error = error
        })
      } catch (e) {
        set((s) => { s.syncing = false; s.error = e instanceof Error ? e.message : String(e) })
      }
    },
  }))
)
```

- [ ] **Step 11: Run the store test to confirm it passes**

Run: `npx jest __tests__/stores/healthConnectStore.test.ts`
Expected: PASS.

- [ ] **Step 12: Build the Health Connect screen** (composes the tested store; no dedicated screen test)

`app/health-connect.tsx`:
```typescript
import { useEffect } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useHealthConnectStore } from '../stores/healthConnectStore'

export default function HealthConnectScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { available, permissionGranted, todaySteps, todayActiveCalories, syncing, error, lastSyncedAt, checkAvailability, requestPermissions, syncNow } =
    useHealthConnectStore()

  useEffect(() => { checkAvailability() }, [])

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">Health Connect</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}

      <View className="px-6 pt-4">
        {Platform.OS !== 'android' || available === false ? (
          <View className="bg-white rounded-xl p-4 border border-gray-100">
            <Text className="text-gray-800 font-semibold mb-1">Not available on this device</Text>
            <Text className="text-gray-500 text-sm">
              Health Connect is an Android feature. Install the Health Connect app (Android) to auto-sync steps, active
              calories, heart rate and workouts. You can keep logging activity manually in the meantime.
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-gray-600 mb-4">
              Sync steps, active calories, heart rate and workouts that Google Fit and other apps write into Health Connect.
            </Text>
            {!permissionGranted ? (
              <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-4" onPress={requestPermissions}>
                <Text className="text-white font-semibold text-base">Connect Health Connect</Text>
              </Pressable>
            ) : (
              <>
                <View className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
                  <Text className="text-gray-800 font-semibold mb-2">Today (from Health Connect)</Text>
                  <Text className="text-sm text-gray-600">Steps: {todaySteps}</Text>
                  <Text className="text-sm text-gray-600">Active calories: {todayActiveCalories} kcal</Text>
                  {lastSyncedAt ? <Text className="text-xs text-gray-400 mt-2">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</Text> : null}
                </View>
                <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-4" disabled={syncing} onPress={() => user && syncNow(user.id)}>
                  {syncing ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Sync now</Text>}
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 13: Register the route + settings entry + dashboard wiring**

In `app/_layout.tsx`, add the screen to the `<Stack>` (after `<Stack.Screen name="progress" />`):
```typescript
          <Stack.Screen name="health-connect" />
```

In `app/(tabs)/settings.tsx`, add an entry that navigates to the screen. Change the imports to include `useHealthConnectStore` is NOT needed here; only navigation. Add, immediately after the opening `<ScrollView ...>`'s AI Provider `</View>` block closes (i.e., after the AI-provider card `View`), a new section:
```typescript
      <View className="px-4 pt-2">
        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">Integrations</Text>
        <Pressable className="bg-white rounded-xl border border-gray-100 px-4 py-4" onPress={() => router.push('/health-connect')}>
          <Text className="text-gray-800 font-semibold">Health Connect</Text>
          <Text className="text-gray-500 text-xs mt-1">Auto-sync steps, calories, heart rate and workouts (Android)</Text>
        </Pressable>
      </View>
```
(`router` is already imported in settings.tsx.)

In `app/(tabs)/index.tsx`, wire the foreground sync and feed steps/active-calories into the rings. Add the import near the other store imports:
```typescript
import { useHealthConnectStore } from '../../stores/healthConnectStore'
```
Inside `HomeScreen`, after the `useActivityStore()` line add:
```typescript
  const { available: hcAvailable, permissionGranted: hcGranted, todaySteps: hcSteps, checkAvailability, syncNow } = useHealthConnectStore()
```
Add a foreground-sync effect after the existing lazy-coach-note effect:
```typescript
  useEffect(() => { checkAvailability() }, [])
  useEffect(() => {
    if (user && hcAvailable && hcGranted) syncNow(user.id)
  }, [user, hcAvailable, hcGranted])
```
Change the steps line so Health Connect augments (never double-counts) manual steps:
```typescript
  const stepsToday = Math.max(sumSteps(todayActivity), hcSteps)
```

- [ ] **Step 14: Configure the Expo config plugin + permissions** in `app.json`

Add the Health Connect read permissions to `android.permissions` (append to the existing array):
```json
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_EXERCISE"
```
Add the config plugin to the `plugins` array (append after the `expo-image-picker` entry):
```json
      "react-native-health-connect"
```
(The plugin injects the Health Connect `<queries>` and the permission-rationale activity into the Android manifest; verified on-device by the user.)

- [ ] **Step 15: CONTROLLER — apply the migration + regenerate types** (implementer cannot run MCP)

On project `ggjrtgowmauoimpvficl`, record each in the ledger:
- `mcp__supabase__apply_migration` name `phase4_activity_source` with the Step 7 SQL.
- `mcp__supabase__generate_typescript_types`; overwrite `lib/database.types.ts`.

Expected: migration applies; `lib/database.types.ts` shows `activity_logs.Row.source: string` and `Insert.source?: string`.

- [ ] **Step 16: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest __tests__/lib/healthConnect.test.ts __tests__/stores/healthConnectStore.test.ts`
Expected: tsc exit 0 (against the regenerated types); both suites PASS.

- [ ] **Step 17: Commit**

```bash
git add lib/utils/healthConnect.ts stores/healthConnectStore.ts app/health-connect.tsx supabase/migrations/20260929040000_phase4_activity_source.sql types/index.ts app.json package.json package-lock.json app/_layout.tsx "app/(tabs)/settings.tsx" "app/(tabs)/index.tsx" lib/database.types.ts __tests__/lib/healthConnect.test.ts __tests__/stores/healthConnectStore.test.ts
git commit -m "feat: Health Connect sync (steps/active-cal/HR/workouts) with idempotent dedup + settings/onboarding screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Push notifications

**Files:**
- Create: `lib/utils/pushToken.ts`
- Create: `__tests__/lib/pushToken.test.ts`
- Create: `stores/pushStore.ts`
- Create: `__tests__/stores/pushStore.test.ts`
- Create: `supabase/functions/send-push/index.ts`
- Create: `supabase/migrations/20260929050000_phase4_push_tokens.sql`
- Modify: `types/index.ts` (add `PushPlatform`)
- Modify: `supabase/functions/generate-daily-summary/index.ts` (cron sends coach note via send-push)
- Modify: `app/_layout.tsx` (register push token on login)
- Modify: `app.json` (`expo-notifications` plugin + POST_NOTIFICATIONS)
- Modify: `package.json` (adds `expo-notifications`)
- Regenerated by controller: `lib/database.types.ts`

**Interfaces:**
- Consumes: typed `supabase`; `expo-notifications`; app.json EAS `projectId`.
- Produces (TS): `PushPlatform = 'android' | 'ios'`; `PushTokenRow`; `buildPushTokenRow(userId: string, token: string, platform: PushPlatform): PushTokenRow | null` from `lib/utils/pushToken.ts`.
- Produces (store): `usePushStore` — `{ token: string | null, permissionGranted: boolean, registering: boolean, error: string | null, registerForPush(userId: string): Promise<void> }`.
- Produces (edge): `POST /functions/v1/send-push` — cron mode (`x-cron-secret`), body `{ notifications: { user_id, title, body, data? }[] }` → `{ ok, sent }`.
- Produces (DB): `push_tokens` table.

- [ ] **Step 1: Add the dependency**

Run: `npx expo install expo-notifications`
Expected: `package.json` gains `expo-notifications`; install completes cleanly.

- [ ] **Step 2: Write the failing pure-helper test** (Review Focus #4 — reject garbage tokens)

`__tests__/lib/pushToken.test.ts`:
```typescript
import { buildPushTokenRow } from '../../lib/utils/pushToken'

describe('buildPushTokenRow', () => {
  it('builds a row for a valid Expo push token', () => {
    expect(buildPushTokenRow('u1', 'ExponentPushToken[abc123]', 'android')).toEqual({
      user_id: 'u1', token: 'ExponentPushToken[abc123]', platform: 'android',
    })
  })
  it('accepts the ExpoPushToken[...] variant and trims whitespace', () => {
    expect(buildPushTokenRow('u1', '  ExpoPushToken[xyz]  ', 'ios')).toEqual({
      user_id: 'u1', token: 'ExpoPushToken[xyz]', platform: 'ios',
    })
  })
  it('returns null for an empty or garbage token', () => {
    expect(buildPushTokenRow('u1', '', 'android')).toBeNull()
    expect(buildPushTokenRow('u1', 'not-a-token', 'android')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest __tests__/lib/pushToken.test.ts`
Expected: FAIL — cannot find module `lib/utils/pushToken`.

- [ ] **Step 4: Implement the helper + add `PushPlatform` to types**

`lib/utils/pushToken.ts`:
```typescript
import { PushPlatform } from '../../types'

export interface PushTokenRow {
  user_id: string
  token: string
  platform: PushPlatform
}

// Normalise a token registration into the row we upsert. Rejects empty/garbage so a
// bad token can never be stored (dup/stale guard part 1; the unique index handles dups).
export function buildPushTokenRow(userId: string, token: string, platform: PushPlatform): PushTokenRow | null {
  const t = token.trim()
  if (!t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken[')) return null
  return { user_id: userId, token: t, platform }
}
```
Append to `types/index.ts`:
```typescript
export type PushPlatform = 'android' | 'ios'
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest __tests__/lib/pushToken.test.ts`
Expected: PASS.

- [ ] **Step 6: Author the schema migration**

`supabase/migrations/20260929050000_phase4_push_tokens.sql`:
```sql
-- Phase 4: Expo push tokens, one row per device token. token is UNIQUE so
-- re-registering the same device (or a token reassigned to a new user) upserts in
-- place instead of duplicating; RLS keeps a user's tokens private to them.
create table push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy "Users manage own push tokens" on push_tokens
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index push_tokens_user_idx on push_tokens (user_id);
```

- [ ] **Step 7: Write the failing store test** (Review Focus #4 — upsert conflict on token)

`__tests__/stores/pushStore.test.ts`:
```typescript
/// <reference types="jest" />
import { usePushStore } from '../../stores/pushStore'
import { supabase } from '../../lib/supabase'
import * as Notifications from 'expo-notifications'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}))
jest.mock('expo-constants', () => ({ default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } } }))

describe('pushStore', () => {
  beforeEach(() => {
    usePushStore.setState({ token: null, permissionGranted: false, registering: false, error: null })
    jest.clearAllMocks()
  })

  it('registers and upserts the token on the unique token conflict target', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[abc]' })
    const upsert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await usePushStore.getState().registerForPush('u1')

    expect(supabase.from).toHaveBeenCalledWith('push_tokens')
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', token: 'ExponentPushToken[abc]', platform: expect.any(String) },
      { onConflict: 'token' }
    )
    expect(usePushStore.getState().token).toBe('ExponentPushToken[abc]')
    expect(usePushStore.getState().error).toBeNull()
  })

  it('does nothing and records an error when permission is denied', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' })
    const upsert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await usePushStore.getState().registerForPush('u1')

    expect(upsert).not.toHaveBeenCalled()
    expect(usePushStore.getState().permissionGranted).toBe(false)
  })

  it('does not upsert a garbage token', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'garbage' })
    const upsert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ upsert })

    await usePushStore.getState().registerForPush('u1')
    expect(upsert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Run the test to confirm it fails**

Run: `npx jest __tests__/stores/pushStore.test.ts`
Expected: FAIL — cannot find module `stores/pushStore`.

- [ ] **Step 9: Implement the store**

`stores/pushStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { buildPushTokenRow, PushTokenRow } from '../lib/utils/pushToken'
import { PushPlatform } from '../types'

interface PushState {
  token: string | null
  permissionGranted: boolean
  registering: boolean
  error: string | null
  registerForPush: (userId: string) => Promise<void>
}

export const usePushStore = create<PushState>()(
  immer((set) => ({
    token: null,
    permissionGranted: false,
    registering: false,
    error: null,

    registerForPush: async (userId) => {
      set((s) => { s.registering = true; s.error = null })
      try {
        let { status } = await Notifications.getPermissionsAsync()
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync()
          status = req.status
        }
        if (status !== 'granted') {
          set((s) => { s.registering = false; s.permissionGranted = false })
          return
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
        const tokenRes = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
        const platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android'
        const row: PushTokenRow | null = buildPushTokenRow(userId, tokenRes.data, platform)
        if (!row) {
          set((s) => { s.registering = false; s.permissionGranted = true; s.error = 'Received an invalid push token.' })
          return
        }
        // token is UNIQUE: re-registering the same device upserts in place (Review Focus #4).
        const { error } = await supabase.from('push_tokens').upsert(row, { onConflict: 'token' })
        set((s) => {
          s.registering = false
          s.permissionGranted = true
          s.token = row.token
          s.error = error?.message ?? null
        })
      } catch (e) {
        set((s) => { s.registering = false; s.error = e instanceof Error ? e.message : String(e) })
      }
    },
  }))
)
```

- [ ] **Step 10: Run the store test to confirm it passes**

Run: `npx jest __tests__/stores/pushStore.test.ts`
Expected: PASS.

- [ ] **Step 11: Write the `send-push` edge function** (cron-secret-guarded like `generate-daily-summary`; single send path; deletes stale tokens — Review Focus #4)

`supabase/functions/send-push/index.ts`:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

interface Notification {
  user_id: string
  title: string
  body: string
  data?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // Server-only send path: require the cron secret exactly (no user-invocable send).
    const cronSecret = req.headers.get('x-cron-secret')
    if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const notifications: Notification[] = Array.isArray(body.notifications) ? body.notifications : []
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Resolve each user's device tokens.
    const messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[] = []
    const tokenToUser = new Map<string, string>()
    for (const n of notifications) {
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', n.user_id)
      for (const t of ((tokens ?? []) as { token: string }[])) {
        tokenToUser.set(t.token, n.user_id)
        messages.push({ to: t.token, title: n.title, body: n.body, data: n.data })
      }
    }
    if (messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Expo Push API (chunks of 100).
    let sent = 0
    const stale: string[] = []
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100)
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      })
      if (!res.ok) continue
      const json = await res.json()
      const tickets = (json.data ?? []) as { status: string; details?: { error?: string } }[]
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') { sent += 1; return }
        if (ticket.details?.error === 'DeviceNotRegistered') stale.push(chunk[idx].to)
      })
    }

    // Prune tokens Expo reports as unregistered so we stop sending into the void.
    if (stale.length > 0) await supabase.from('push_tokens').delete().in('token', stale)

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
```

- [ ] **Step 12: Wire the morning cron to send the coach note** in `supabase/functions/generate-daily-summary/index.ts`

At the top, add the send-push URL constant after the existing env constants (after the `CRON_SECRET` line):
```typescript
const SEND_PUSH_URL = `${SUPABASE_URL}/functions/v1/send-push`
```
Change `generateForUser` so callers can read the coach note back: it already returns `todayRow` (which contains `ai_coach_note`). In the **cron branch** only, accumulate notifications and fire one `send-push` call. Replace the cron loop body so it collects notes:
```typescript
      let generated = 0
      const notifications: { user_id: string; title: string; body: string }[] = []
      for (const p of (profiles ?? []) as { id: string }[]) {
        try {
          const row = await generateForUser(p.id, supabase)
          generated += 1
          const note = (row?.ai_coach_note as string | undefined) ?? ''
          if (note) notifications.push({ user_id: p.id, title: 'Your morning coach note', body: note })
        } catch (_e) { /* skip one bad user, keep the batch going */ }
      }
      // Best-effort: one send-push call for the whole batch (the single send path).
      if (notifications.length > 0) {
        try {
          await fetch(SEND_PUSH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': CRON_SECRET,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ notifications }),
          })
        } catch (_e) { /* push is best-effort; never fail the cron over it */ }
      }
      return new Response(JSON.stringify({ ok: true, generated }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
```

- [ ] **Step 13: Register push on login** in `app/_layout.tsx`

Add the import:
```typescript
import { usePushStore } from '../stores/pushStore'
```
Pull the action from the store inside `RootLayout` (next to the other store hooks):
```typescript
  const { registerForPush } = usePushStore()
```
Extend the existing `session && user` effect to register the token once signed in — change the effect body to:
```typescript
  useEffect(() => {
    if (session && user) {
      fetchProfile(user.id).finally(() => setProfileChecked(true))
      registerForPush(user.id)
    } else {
      setProfileChecked(false)
    }
  }, [session, user])
```

- [ ] **Step 14: Configure the plugin + permission** in `app.json`

Append to `android.permissions`:
```json
        "android.permission.POST_NOTIFICATIONS"
```
Append to `plugins`:
```json
      [
        "expo-notifications",
        { "icon": "./assets/icon.png", "color": "#16a34a" }
      ]
```

- [ ] **Step 15: CONTROLLER — apply migration, regenerate types, deploy functions** (implementer cannot run MCP)

On `ggjrtgowmauoimpvficl`, record each in the ledger:
1. `mcp__supabase__apply_migration` name `phase4_push_tokens` (Step 6 SQL).
2. `mcp__supabase__generate_typescript_types`; overwrite `lib/database.types.ts` (now includes `push_tokens`).
3. `mcp__supabase__deploy_edge_function` slug `send-push`, `verify_jwt: true`, Step 11 source. (`verify_jwt` at the gateway is satisfied by the service-role bearer the cron/caller sends; the function additionally enforces the cron secret.)
4. `mcp__supabase__deploy_edge_function` slug `generate-daily-summary`, `verify_jwt: true`, updated source (Step 12).

Expected: `push_tokens` in the regenerated types; both functions listed by `mcp__supabase__list_edge_functions`.

- [ ] **Step 16: CONTROLLER — smoke test the send path (Review Focus #4)**

```bash
# no cron secret -> 401 (never user-invocable)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "apikey: <SERVICE_ROLE_KEY>"

# correct cron secret, empty notifications -> {"ok":true,"sent":0}
curl -s -X POST https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" \
  -d '{"notifications":[]}'
```
Expected: (a) `401`; (b) `{"ok":true,"sent":0}`. On-device push receipt (with a real token) is a user verification step and requires the FCM credential upload below.

- [ ] **Step 17: USER STEP — FCM credentials (documented, not code)**

Android delivery via Expo needs the project's FCM v1 service-account key uploaded to EAS: `eas credentials` → Android → Push Notifications (FCM V1) → upload the service-account JSON from the Firebase console. This is a one-time manual step; the code is complete without it. (Recorded in Task 7's `docs/play-store-listing.md` prerequisites too.)

- [ ] **Step 18: Typecheck + run new tests**

Run: `npx tsc --noEmit && npx jest __tests__/lib/pushToken.test.ts __tests__/stores/pushStore.test.ts`
Expected: tsc exit 0; both suites PASS.

- [ ] **Step 19: Commit**

```bash
git add lib/utils/pushToken.ts stores/pushStore.ts supabase/functions/send-push/ supabase/functions/generate-daily-summary/index.ts supabase/migrations/20260929050000_phase4_push_tokens.sql types/index.ts app/_layout.tsx app.json package.json package-lock.json lib/database.types.ts __tests__/lib/pushToken.test.ts __tests__/stores/pushStore.test.ts
git commit -m "feat: push notifications — expo-notifications token registration, push_tokens table, send-push edge fn, morning coach-note push

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Offline meal logging

**Files:**
- Create: `lib/utils/mealQueue.ts`
- Create: `__tests__/lib/mealQueue.test.ts`
- Modify: `stores/mealsStore.ts` (offline queue + `flushQueue` + `pendingCount` + `flushing`)
- Modify: `__tests__/stores/mealsStore.test.ts` (offline enqueue + flush tests)
- Modify: `app/_layout.tsx` (NetInfo + foreground flush)
- Modify: `app/(tabs)/_layout.tsx` (pending-meal badge on the Meals tab)
- Modify: `package.json` (adds `@react-native-community/netinfo`)

**Interfaces:**
- Consumes: `AsyncStorage` (already a dep), `@react-native-community/netinfo`, `MealType`, typed `supabase`, `Meal`.
- Produces (TS): `QueuedMeal`, `enqueueMeal(queue: QueuedMeal[], meal: QueuedMeal): QueuedMeal[]`, `removeMeal(queue: QueuedMeal[], id: string): QueuedMeal[]` from `lib/utils/mealQueue.ts`.
- Produces (store): `mealsStore` gains `pendingCount: number`, `flushing: boolean`, `flushQueue(): Promise<void>`; `addMeal` enqueues on network failure.

- [ ] **Step 1: Add the dependency** (new dep; AsyncStorage is already present)

Run: `npx expo install @react-native-community/netinfo`
Expected: `package.json` gains `@react-native-community/netinfo`.

- [ ] **Step 2: Write the failing pure-queue test** (Review Focus #3 — order preserved, no double by id)

`__tests__/lib/mealQueue.test.ts`:
```typescript
import { enqueueMeal, removeMeal, QueuedMeal } from '../../lib/utils/mealQueue'

const meal = (id: string): QueuedMeal => ({
  id, user_id: 'u1', meal_type: 'lunch', description: `m${id}`,
  total_calories: 100, protein_g: 10, carbs_g: 10, fat_g: 5, fiber_g: 1, queued_at: `2026-09-29T0${id}:00:00Z`,
})

describe('mealQueue', () => {
  it('appends to the tail preserving order', () => {
    const q = enqueueMeal(enqueueMeal([], meal('1')), meal('2'))
    expect(q.map((m) => m.id)).toEqual(['1', '2'])
  })
  it('does not enqueue the same client id twice', () => {
    const q = enqueueMeal(enqueueMeal([], meal('1')), meal('1'))
    expect(q).toHaveLength(1)
  })
  it('removes a meal by id and leaves order intact', () => {
    const q = [meal('1'), meal('2'), meal('3')]
    expect(removeMeal(q, '2').map((m) => m.id)).toEqual(['1', '3'])
  })
  it('removing an absent id is a no-op', () => {
    const q = [meal('1')]
    expect(removeMeal(q, 'x')).toEqual(q)
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest __tests__/lib/mealQueue.test.ts`
Expected: FAIL — cannot find module `lib/utils/mealQueue`.

- [ ] **Step 4: Implement the pure queue ops**

`lib/utils/mealQueue.ts`:
```typescript
import { MealType } from '../../types'

export interface QueuedMeal {
  id: string // client-generated uuid — the meals.id too, so a re-insert collides (idempotent)
  user_id: string
  meal_type: MealType
  description: string
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  photo_local_uri?: string
  queued_at: string
}

// Append to the tail, preserving order. De-dupe by client id so a double-enqueue
// (e.g. a retry that also queued) never stores the same meal twice.
export function enqueueMeal(queue: QueuedMeal[], meal: QueuedMeal): QueuedMeal[] {
  if (queue.some((m) => m.id === meal.id)) return queue
  return [...queue, meal]
}

// Remove a meal by id after a successful insert.
export function removeMeal(queue: QueuedMeal[], id: string): QueuedMeal[] {
  return queue.filter((m) => m.id !== id)
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest __tests__/lib/mealQueue.test.ts`
Expected: PASS.

- [ ] **Step 6: Rewrite `stores/mealsStore.ts`** with the offline queue

`stores/mealsStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { Meal } from '../types'
import { QueuedMeal, enqueueMeal, removeMeal } from '../lib/utils/mealQueue'

type MealInsert = Database['public']['Tables']['meals']['Insert']

const QUEUE_KEY = 'poshan.mealQueue.v1'

async function readQueue(): Promise<QueuedMeal[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as QueuedMeal[] } catch { return [] }
}
async function writeQueue(q: QueuedMeal[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// A queued local photo is uploaded on flush; returns the public URL or undefined.
async function uploadQueuedPhoto(item: QueuedMeal): Promise<string | undefined> {
  if (!item.photo_local_uri) return undefined
  const fileName = `${item.user_id}/${item.id}.jpg`
  const base64 = await FileSystem.readAsStringAsync(item.photo_local_uri, { encoding: FileSystem.EncodingType.Base64 })
  const { error } = await supabase.storage.from('meal-photos').upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: true })
  if (error) return undefined
  return supabase.storage.from('meal-photos').getPublicUrl(fileName).data.publicUrl
}

const isDuplicateKey = (message: string): boolean => /duplicate key|already exists/i.test(message)

interface MealsState {
  meals: Meal[]
  loading: boolean
  error: string | null
  pendingCount: number
  flushing: boolean
  fetchTodayMeals: (userId: string) => Promise<void>
  loadPendingCount: () => Promise<void>
  flushQueue: () => Promise<void>
  addMeal: (
    meal: Omit<Meal, 'id' | 'created_at' | 'logged_at' | 'ai_suggestions' | 'photo_url'> & {
      photo_url?: string
      ai_suggestions?: string | null
    }
  ) => Promise<Meal | null>
}

export const useMealsStore = create<MealsState>()(
  immer((set, get) => ({
    meals: [],
    loading: false,
    error: null,
    pendingCount: 0,
    flushing: false,

    fetchTodayMeals: async (userId) => {
      const today = new Date().toISOString().split('T')[0]
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .order('logged_at', { ascending: false })
      set((s) => {
        s.loading = false
        s.meals = error ? [] : (data as Meal[])
        s.error = error?.message ?? null
      })
    },

    loadPendingCount: async () => {
      const q = await readQueue()
      set((s) => { s.pendingCount = q.length })
    },

    addMeal: async (meal) => {
      set((s) => { s.loading = true; s.error = null })
      const id = crypto.randomUUID()
      const loggedAt = new Date().toISOString()
      const payload = { id, ...meal, logged_at: loggedAt } as unknown as MealInsert
      try {
        const { data, error } = await supabase.from('meals').insert(payload).select().single()
        set((s) => {
          s.loading = false
          if (!error && data) s.meals.unshift(data as Meal)
          s.error = error?.message ?? null
        })
        return error ? null : (data as Meal)
      } catch (_networkErr) {
        // No connectivity: queue for flush on reconnect (photos keep their local URI).
        const queued: QueuedMeal = {
          id, user_id: meal.user_id, meal_type: meal.meal_type, description: meal.description,
          total_calories: meal.total_calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g,
          fat_g: meal.fat_g, fiber_g: meal.fiber_g ?? 0,
          photo_local_uri: meal.photo_url && meal.photo_url.startsWith('file:') ? meal.photo_url : undefined,
          queued_at: loggedAt,
        }
        const q = enqueueMeal(await readQueue(), queued)
        await writeQueue(q)
        set((s) => { s.loading = false; s.pendingCount = q.length; s.error = 'Saved offline — will sync when you reconnect.' })
        return null
      }
    },

    flushQueue: async () => {
      if (get().flushing) return // concurrency guard: never double-insert (Review Focus #3)
      set((s) => { s.flushing = true })
      let q = await readQueue()
      for (const item of q) {
        try {
          const photo_url = await uploadQueuedPhoto(item)
          const { error } = await supabase.from('meals').insert({
            id: item.id, user_id: item.user_id, meal_type: item.meal_type, description: item.description,
            total_calories: item.total_calories, protein_g: item.protein_g, carbs_g: item.carbs_g,
            fat_g: item.fat_g, fiber_g: item.fiber_g, photo_url: photo_url ?? null, logged_at: item.queued_at,
          } as unknown as MealInsert)
          // Duplicate PK => this meal was already inserted by an earlier flaky flush: done, not an error.
          if (error && !isDuplicateKey(error.message)) break // real failure: keep this + the rest, preserve order
          q = removeMeal(q, item.id)
          await writeQueue(q)
        } catch (_networkErr) {
          break // dropped mid-flush: keep remaining for next time (no data loss)
        }
      }
      set((s) => { s.flushing = false; s.pendingCount = q.length })
    },
  }))
)
```

- [ ] **Step 7: Add offline tests** to `__tests__/stores/mealsStore.test.ts` (keep the existing test; add these)

Replace the file's `beforeEach` to reset the new fields, and add offline tests:
```typescript
import { useMealsStore } from '../../stores/mealsStore'
import { supabase } from '../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}))

const mockInsertResult = (error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: { id: 'meal-1' }, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('mealsStore', () => {
  beforeEach(() => {
    useMealsStore.setState({ meals: [], loading: false, error: null, pendingCount: 0, flushing: false })
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
  })

  it('sets error on a failed (non-network) insert', async () => {
    mockInsertResult({ message: 'insert failed' })
    await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
    expect(useMealsStore.getState().error).toBe('insert failed')
  })

  it('queues the meal offline when the insert throws (no connectivity)', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
    chain.insert.mockReturnValue(chain)
    chain.select.mockReturnValue(chain)
    chain.single.mockRejectedValue(new Error('Network request failed'))
    ;(supabase.from as jest.Mock).mockReturnValue(chain)

    const res = await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })

    expect(res).toBeNull()
    expect(AsyncStorage.setItem).toHaveBeenCalled()
    const written = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])
    expect(written).toHaveLength(1)
    expect(useMealsStore.getState().pendingCount).toBe(1)
  })

  it('flushQueue inserts each queued meal exactly once, in order, then clears', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
      { id: 'b', user_id: 'u1', meal_type: 'dinner', description: 'b', total_calories: 2, protein_g: 2, carbs_g: 2, fat_g: 2, fiber_g: 0, queued_at: 't2' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    expect(insert).toHaveBeenCalledTimes(2)
    expect((insert.mock.calls[0][0] as { id: string }).id).toBe('a')
    expect((insert.mock.calls[1][0] as { id: string }).id).toBe('b')
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite)).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it('flushQueue stops on a real failure and keeps the remaining meals (no loss, no double-insert)', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
      { id: 'b', user_id: 'u1', meal_type: 'dinner', description: 'b', total_calories: 2, protein_g: 2, carbs_g: 2, fat_g: 2, fiber_g: 0, queued_at: 't2' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'server 500' } })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    expect(insert).toHaveBeenCalledTimes(2)
    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite).map((m: { id: string }) => m.id)).toEqual(['b'])
    expect(useMealsStore.getState().pendingCount).toBe(1)
  })

  it('treats a duplicate-key insert as already-done (idempotent re-flush)', async () => {
    const queued = [
      { id: 'a', user_id: 'u1', meal_type: 'lunch', description: 'a', total_calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0, queued_at: 't1' },
    ]
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queued))
    const insert = jest.fn().mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint "meals_pkey"' } })
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })

    await useMealsStore.getState().flushQueue()

    const lastWrite = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1]
    expect(JSON.parse(lastWrite)).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
  })

  it('does not run a second concurrent flush', async () => {
    useMealsStore.setState({ flushing: true })
    const insert = jest.fn()
    ;(supabase.from as jest.Mock).mockReturnValue({ insert })
    await useMealsStore.getState().flushQueue()
    expect(insert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Run the store tests to confirm they pass**

Run: `npx jest __tests__/stores/mealsStore.test.ts`
Expected: PASS (all six).

- [ ] **Step 9: Flush on reconnect + foreground** in `app/_layout.tsx`

Add imports:
```typescript
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useMealsStore } from '../stores/mealsStore'
```
Pull the actions in `RootLayout`:
```typescript
  const { flushQueue, loadPendingCount } = useMealsStore()
```
Add an effect that flushes when connectivity returns and when the app foregrounds (only while signed in):
```typescript
  useEffect(() => {
    if (!session || !user) return
    loadPendingCount()
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) flushQueue()
    })
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') flushQueue()
    })
    return () => { unsubscribeNet(); sub.remove() }
  }, [session, user])
```

- [ ] **Step 10: Pending-meal badge** on the Meals tab in `app/(tabs)/_layout.tsx`

Rewrite the file so the Meals tab shows a badge when meals are queued (reads the tested store):
```typescript
import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useMealsStore } from '../../stores/mealsStore'

export default function TabsLayout() {
  const pendingCount = useMealsStore((s) => s.pendingCount)
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#16a34a' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text> }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarBadge: pendingCount > 0 ? pendingCount : undefined, tabBarIcon: ({ color }) => <Text style={{ color }}>🍽️</Text> }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: ({ color }) => <Text style={{ color }}>📋</Text> }} />
      <Tabs.Screen name="chat" options={{ title: 'Coach', tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color }}>⚙️</Text> }} />
    </Tabs>
  )
}
```

- [ ] **Step 11: Typecheck + run tests**

Run: `npx tsc --noEmit && npx jest __tests__/lib/mealQueue.test.ts __tests__/stores/mealsStore.test.ts`
Expected: tsc exit 0; both suites PASS.

- [ ] **Step 12: Commit**

```bash
git add lib/utils/mealQueue.ts stores/mealsStore.ts app/_layout.tsx "app/(tabs)/_layout.tsx" package.json package-lock.json __tests__/lib/mealQueue.test.ts __tests__/stores/mealsStore.test.ts
git commit -m "feat: offline meal logging — AsyncStorage queue, idempotent ordered flush on reconnect/foreground, pending badge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: RLS multi-user audit + store reset on sign-out

**Files:**
- Create: `lib/storeReset.ts`
- Create: `__tests__/stores/storeReset.test.ts`
- Create: `supabase/migrations/20260929060000_phase4_rls_audit.sql`
- Modify: `stores/authStore.ts` (`signOut` → `resetAllStores`)

**Interfaces:**
- Consumes: every data store's `setState`.
- Produces: `resetAllStores(): void` from `lib/storeReset.ts`.

- [ ] **Step 1: Write the failing store-reset test** (Review Focus #5)

`__tests__/stores/storeReset.test.ts`:
```typescript
import { resetAllStores } from '../../lib/storeReset'
import { useMealsStore } from '../../stores/mealsStore'
import { useDailySummaryStore } from '../../stores/dailySummaryStore'
import { usePlansStore } from '../../stores/plansStore'
import { useProfileStore } from '../../stores/profileStore'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

describe('resetAllStores', () => {
  it('clears every data store back to its empty initial state (no cross-user leak)', () => {
    useMealsStore.setState({ meals: [{ id: 'm1' } as never], pendingCount: 3 })
    useDailySummaryStore.setState({ summary: { id: 's1' } as never, recent: [{ id: 's1' } as never], loaded: true })
    usePlansStore.setState({ mealPlan: { id: 'p1' } as never })
    useProfileStore.setState({ profile: { id: 'u1' } as never, goals: { id: 'g1' } as never })

    resetAllStores()

    expect(useMealsStore.getState().meals).toEqual([])
    expect(useMealsStore.getState().pendingCount).toBe(0)
    expect(useDailySummaryStore.getState().summary).toBeNull()
    expect(useDailySummaryStore.getState().recent).toEqual([])
    expect(useDailySummaryStore.getState().loaded).toBe(false)
    expect(usePlansStore.getState().mealPlan).toBeNull()
    expect(useProfileStore.getState().profile).toBeNull()
    expect(useProfileStore.getState().goals).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest __tests__/stores/storeReset.test.ts`
Expected: FAIL — cannot find module `lib/storeReset`.

- [ ] **Step 3: Implement `resetAllStores`**

`lib/storeReset.ts`:
```typescript
import { useMealsStore } from '../stores/mealsStore'
import { useActivityStore } from '../stores/activityStore'
import { useDailySummaryStore } from '../stores/dailySummaryStore'
import { usePlansStore } from '../stores/plansStore'
import { useProfileStore } from '../stores/profileStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { useChatStore } from '../stores/chatStore'
import { usePushStore } from '../stores/pushStore'
import { useHealthConnectStore } from '../stores/healthConnectStore'

// Wipe every per-user data store on sign-out so a second user on the same device
// never sees the previous user's cached data (Review Focus #5). authStore resets itself.
export function resetAllStores(): void {
  useMealsStore.setState({ meals: [], loading: false, error: null, pendingCount: 0, flushing: false })
  useActivityStore.setState({ todayActivity: [], loading: false, error: null })
  useDailySummaryStore.setState({ summary: null, recent: [], loading: false, loaded: false, error: null })
  usePlansStore.setState({ mealPlan: null, workoutPlan: null, loading: false, generating: false, error: null })
  useProfileStore.setState({ profile: null, goals: null, loading: false, error: null })
  useInbodyStore.setState({ reports: [], latest: null, loading: false, error: null })
  useChatStore.setState({ messages: [], conversationId: null, loading: false, error: null })
  usePushStore.setState({ token: null, permissionGranted: false, registering: false, error: null })
  useHealthConnectStore.setState({ available: null, permissionGranted: false, todaySteps: 0, todayActiveCalories: 0, syncing: false, error: null, lastSyncedAt: null })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest __tests__/stores/storeReset.test.ts`
Expected: PASS.

- [ ] **Step 5: Call `resetAllStores` from `signOut`** in `stores/authStore.ts`

Change the `signOut` action body to reset all stores after Supabase clears the session. Use a dynamic import so `authStore` never statically imports the data stores (avoids any module-init cycle):
```typescript
    signOut: async () => {
      set((s) => { s.loading = true; s.error = null })
      const { error } = await supabase.auth.signOut()
      const { resetAllStores } = await import('../lib/storeReset')
      resetAllStores()
      set((s) => {
        s.loading = false
        s.session = null
        s.user = null
        s.error = error?.message ?? null
      })
    },
```

- [ ] **Step 6: Author the idempotent RLS-hardening migration**

`supabase/migrations/20260929060000_phase4_rls_audit.sql`:
```sql
-- Phase 4: multi-user RLS hardening. Idempotently (re)assert row level security on
-- every user-scoped table so a missing ALTER can never leave one world-readable.
-- Policies were created in the phase 1-4 migrations; this is a belt-and-braces
-- guarantee the audit can point to. push_tokens / ai_usage / error_logs / events
-- enable RLS in their own migrations.
alter table profiles enable row level security;
alter table goals enable row level security;
alter table meals enable row level security;
alter table daily_summaries enable row level security;
alter table chat_messages enable row level security;
alter table inbody_reports enable row level security;
alter table activity_logs enable row level security;
alter table meal_plans enable row level security;
alter table workout_plans enable row level security;
```

- [ ] **Step 7: CONTROLLER — run advisors, verify cross-user isolation, apply migration** (implementer cannot run MCP)

On `ggjrtgowmauoimpvficl`, record each in the ledger:
1. `mcp__supabase__get_advisors` type `security`, then type `performance`; capture findings.
2. For every user-scoped table confirm a policy exists and is `auth.uid() = user_id` (using + with check). Verify storage policies for `inbody-photos` are per-user-folder (Phase 2). **Flag the `meal-photos` bucket:** it is public (client uses `getPublicUrl`); confirm this is an accepted decision or convert to private per-user policies in a follow-up — record the ruling in the ledger either way.
3. Fix any advisor finding by authoring an additional numbered migration and applying it (only if a finding requires it).
4. `mcp__supabase__apply_migration` name `phase4_rls_audit` with the Step 6 SQL.
5. Cross-user smoke test (with two test users' JWTs):
   ```sql
   -- via mcp__supabase__execute_sql impersonating user B's JWT context is not possible in SQL;
   -- instead verify from the client: signed in as user B, select from each table filtered by user A's id.
   ```
   Expected: querying another user's rows returns 0 rows for every table; reading another user's `inbody-photos` object returns 403.

- [ ] **Step 8: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc exit 0; **all** suites pass (existing + healthConnect, pushToken, pushStore, mealQueue, mealsStore offline, storeReset).

- [ ] **Step 9: Commit**

```bash
git add lib/storeReset.ts stores/authStore.ts supabase/migrations/20260929060000_phase4_rls_audit.sql __tests__/stores/storeReset.test.ts
git commit -m "feat: reset all Zustand stores on sign-out + idempotent RLS-hardening migration for the multi-user audit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: AI rate-limiting + cost controls

**Files:**
- Create: `lib/utils/rateLimit.ts`
- Create: `__tests__/lib/rateLimit.test.ts`
- Create: `supabase/migrations/20260929070000_phase4_ai_usage.sql`
- Modify: `supabase/functions/ai-agent/index.ts` (guard)
- Modify: `supabase/functions/ai-meal-analysis/index.ts` (guard)
- Modify: `supabase/functions/ai-inbody-analysis/index.ts` (guard)
- Modify: `lib/api/agent.ts`, `lib/api/mealAnalysis.ts`, `lib/api/inbody.ts` (429 → friendly message)

**Interfaces:**
- Consumes: typed `supabase`; the `check_and_increment_ai_usage` RPC; env `AI_DAILY_CALL_CAP`.
- Produces (TS): `AI_LIMIT_MESSAGE: string`; `evaluateUsage(existingCount: number | null, cap: number): { allowed: boolean; nextCount: number }`; `messageForStatus(status: number, fallback: string): string` from `lib/utils/rateLimit.ts`.
- Produces (DB): `ai_usage` table + `check_and_increment_ai_usage(p_user_id uuid, p_cap int) returns boolean` (atomic; resets per calendar day via the `date` key).

- [ ] **Step 1: Write the failing rate-limit test** (Review Focus #2 — off-by-one)

`__tests__/lib/rateLimit.test.ts`:
```typescript
import { evaluateUsage, messageForStatus, AI_LIMIT_MESSAGE } from '../../lib/utils/rateLimit'

describe('evaluateUsage', () => {
  it('allows the first call of the day (no prior count)', () => {
    expect(evaluateUsage(null, 50)).toEqual({ allowed: true, nextCount: 1 })
  })
  it('allows exactly the cap-th call', () => {
    expect(evaluateUsage(49, 50)).toEqual({ allowed: true, nextCount: 50 })
  })
  it('denies the cap+1-th call', () => {
    expect(evaluateUsage(50, 50)).toEqual({ allowed: false, nextCount: 51 })
  })
  it('stays denied beyond the cap', () => {
    expect(evaluateUsage(80, 50)).toEqual({ allowed: false, nextCount: 81 })
  })
})

describe('messageForStatus', () => {
  it('maps 429 to the friendly AI-limit message', () => {
    expect(messageForStatus(429, 'other')).toBe(AI_LIMIT_MESSAGE)
  })
  it('passes other statuses through to the fallback', () => {
    expect(messageForStatus(500, 'server exploded')).toBe('server exploded')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest __tests__/lib/rateLimit.test.ts`
Expected: FAIL — cannot find module `lib/utils/rateLimit`.

- [ ] **Step 3: Implement the rate-limit util**

`lib/utils/rateLimit.ts`:
```typescript
export const AI_LIMIT_MESSAGE = "You've reached today's AI limit. It resets at midnight."

// The daily-cap rule, expressed purely: the (cap)-th call is allowed, the (cap+1)-th
// denied. The DB RPC applies exactly this arithmetic atomically per (user_id, date),
// so the count resets each calendar day (Review Focus #2).
export function evaluateUsage(existingCount: number | null, cap: number): { allowed: boolean; nextCount: number } {
  const nextCount = (existingCount ?? 0) + 1
  return { allowed: nextCount <= cap, nextCount }
}

// Clients call this so a 429 always surfaces the friendly limit message.
export function messageForStatus(status: number, fallback: string): string {
  return status === 429 ? AI_LIMIT_MESSAGE : fallback
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest __tests__/lib/rateLimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Author the `ai_usage` migration + atomic RPC**

`supabase/migrations/20260929070000_phase4_ai_usage.sql`:
```sql
-- Phase 4: per-user daily AI call budget. One row per (user_id, date) so the count
-- resets every calendar day. Writes go only through the SECURITY DEFINER function
-- (called by the service-role edge functions); users may read their own usage.
create table ai_usage (
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  count int not null default 0,
  primary key (user_id, date)
);
alter table ai_usage enable row level security;
create policy "Users read own ai usage" on ai_usage
  for select using (auth.uid() = user_id);

-- Atomic increment-and-check: bumps today's count and returns whether the resulting
-- count is within the cap. The (cap)-th call returns true, the (cap+1)-th false.
create or replace function check_and_increment_ai_usage(p_user_id uuid, p_cap int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into ai_usage (user_id, date, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, date)
  do update set count = ai_usage.count + 1
  returning count into new_count;
  return new_count <= p_cap;
end;
$$;
```

- [ ] **Step 6: Add the guard to `ai-agent`** in `supabase/functions/ai-agent/index.ts`

Immediately after the service client is created (`const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`), before persisting the user's message, insert:
```typescript
    // Per-user daily cap to prevent runaway OpenAI spend (env-configurable, default 50).
    const cap = Number(Deno.env.get('AI_DAILY_CALL_CAP') ?? '50')
    const { data: allowed } = await supabase.rpc('check_and_increment_ai_usage', { p_user_id: userId, p_cap: cap })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "You've reached today's AI limit. It resets at midnight." }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
```

- [ ] **Step 7: Add the guard to `ai-meal-analysis` and `ai-inbody-analysis`**

In each of `supabase/functions/ai-meal-analysis/index.ts` and `supabase/functions/ai-inbody-analysis/index.ts`, immediately after their `const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` line (which currently precedes the storage `createSignedUrl` call), insert the same guard, using `userData.user.id` for the user id:
```typescript
    const cap = Number(Deno.env.get('AI_DAILY_CALL_CAP') ?? '50')
    const { data: allowed } = await supabase.rpc('check_and_increment_ai_usage', { p_user_id: userData.user.id, p_cap: cap })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "You've reached today's AI limit. It resets at midnight." }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
```

- [ ] **Step 8: Surface the friendly message client-side** in the three API clients

In `lib/api/agent.ts`, add the import and map 429. Change the `!response.ok` block:
```typescript
import { messageForStatus } from '../utils/rateLimit'
```
```typescript
  if (!response.ok) {
    const fallback = (body as { error?: string } | null)?.error ?? `Agent request failed with status ${response.status}`
    throw new Error(messageForStatus(response.status, fallback))
  }
```
In `lib/api/mealAnalysis.ts`, add `import { messageForStatus } from '../utils/rateLimit'` and change its `!response.ok` block:
```typescript
  if (!response.ok) {
    const fallback = (body as { error?: string } | null)?.error ?? `Meal analysis request failed with status ${response.status}`
    throw new Error(messageForStatus(response.status, fallback))
  }
```
In `lib/api/inbody.ts`, add `import { messageForStatus } from '../utils/rateLimit'` and change its `!response.ok` block:
```typescript
  if (!response.ok) {
    const fallback = (body as { error?: string } | null)?.error ?? `InBody analysis request failed with status ${response.status}`
    throw new Error(messageForStatus(response.status, fallback))
  }
```

- [ ] **Step 9: CONTROLLER — apply migration, regenerate types, redeploy the three AI functions** (implementer cannot run MCP)

On `ggjrtgowmauoimpvficl`, record each in the ledger:
1. `mcp__supabase__apply_migration` name `phase4_ai_usage` (Step 5 SQL).
2. `mcp__supabase__generate_typescript_types`; overwrite `lib/database.types.ts` (now includes `ai_usage` and the RPC in `Functions`).
3. Optionally set the `AI_DAILY_CALL_CAP` function secret (default 50 if unset).
4. `mcp__supabase__deploy_edge_function` for `ai-agent` (with `tools.ts` + `context.ts`), `ai-meal-analysis`, and `ai-inbody-analysis`, `verify_jwt: true`.

Expected: `ai_usage` + `check_and_increment_ai_usage` in the regenerated types; three functions redeployed.

- [ ] **Step 10: CONTROLLER — smoke test cap + per-day reset (Review Focus #2)**

```sql
-- via mcp__supabase__execute_sql on ggjrtgowmauoimpvficl
select check_and_increment_ai_usage('<TEST_USER_ID>', 3); -- expect t (count 1)
select check_and_increment_ai_usage('<TEST_USER_ID>', 3); -- expect t (count 2)
select check_and_increment_ai_usage('<TEST_USER_ID>', 3); -- expect t (count 3, the cap)
select check_and_increment_ai_usage('<TEST_USER_ID>', 3); -- expect f (count 4 > cap)
select count, date from ai_usage where user_id = '<TEST_USER_ID>' and date = current_date;
-- A row keyed on a different date starts fresh at 1 (per-day reset).
```
Then confirm a live 429: exhaust the cap for the test user via repeated `ai-agent` calls and assert the last returns HTTP `429` with body `{"error":"You've reached today's AI limit. It resets at midnight."}`. Clean up the test row afterward.

- [ ] **Step 11: Typecheck + run tests**

Run: `npx tsc --noEmit && npx jest __tests__/lib/rateLimit.test.ts`
Expected: tsc exit 0; suite PASS.

- [ ] **Step 12: Commit**

```bash
git add lib/utils/rateLimit.ts supabase/migrations/20260929070000_phase4_ai_usage.sql supabase/functions/ai-agent/index.ts supabase/functions/ai-meal-analysis/index.ts supabase/functions/ai-inbody-analysis/index.ts lib/api/agent.ts lib/api/mealAnalysis.ts lib/api/inbody.ts lib/database.types.ts __tests__/lib/rateLimit.test.ts
git commit -m "feat: per-user daily AI call cap (atomic RPC) enforced in AI edge fns → friendly 429; client surfaces the limit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Error monitoring + analytics (self-hosted)

**Files:**
- Create: `lib/telemetry.ts`
- Create: `__tests__/lib/telemetry.test.ts`
- Create: `components/ErrorBoundary.tsx`
- Create: `supabase/functions/_shared/logError.ts`
- Create: `supabase/migrations/20260929080000_phase4_telemetry.sql`
- Modify: `app/_layout.tsx` (wrap in `ErrorBoundary`)
- Modify: `stores/mealsStore.ts` (`logEvent('meal_logged')`), `stores/plansStore.ts` (`logEvent('plan_generated')`), `stores/healthConnectStore.ts` (`logEvent('hc_synced')`)
- Modify: `supabase/functions/{ai-agent,generate-daily-summary,send-push,ai-meal-analysis,ai-inbody-analysis}/index.ts` (catch → `logEdgeError`)
- Regenerated by controller: `lib/database.types.ts`

**Interfaces:**
- Consumes: typed `supabase` (client + service-role in edge).
- Produces (TS): `shapeError(context: string, error: unknown): { context: string; message: string; stack: string | null }`; `logError(context: string, error: unknown, userId?: string): Promise<void>`; `logEvent(name: string, props?: Record<string, unknown>, userId?: string): Promise<void>` from `lib/telemetry.ts`.
- Produces (Deno): `logEdgeError(supabase, context, error, userId?): Promise<void>` from `supabase/functions/_shared/logError.ts`.
- Produces (DB): `error_logs`, `events` tables.

- [ ] **Step 1: Write the failing telemetry-shaping test** (pure logic)

`__tests__/lib/telemetry.test.ts`:
```typescript
import { shapeError } from '../../lib/telemetry'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

describe('shapeError', () => {
  it('extracts message + stack from an Error and keeps the context', () => {
    const err = new Error('kaboom')
    const shaped = shapeError('meal-log', err)
    expect(shaped.context).toBe('meal-log')
    expect(shaped.message).toBe('kaboom')
    expect(typeof shaped.stack).toBe('string')
  })
  it('stringifies a non-Error and returns a null stack', () => {
    expect(shapeError('ctx', 'plain string')).toEqual({ context: 'ctx', message: 'plain string', stack: null })
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest __tests__/lib/telemetry.test.ts`
Expected: FAIL — cannot find module `lib/telemetry`.

- [ ] **Step 3: Implement `lib/telemetry.ts`**

`lib/telemetry.ts`:
```typescript
import { supabase } from './supabase'

export function shapeError(context: string, error: unknown): { context: string; message: string; stack: string | null } {
  if (error instanceof Error) return { context, message: error.message, stack: error.stack ?? null }
  return { context, message: String(error), stack: null }
}

// Telemetry must never throw into the app: swallow its own failures.
export async function logError(context: string, error: unknown, userId?: string): Promise<void> {
  try {
    const shaped = shapeError(context, error)
    await supabase.from('error_logs').insert({ ...shaped, user_id: userId ?? null })
  } catch { /* swallow */ }
}

export async function logEvent(name: string, props: Record<string, unknown> = {}, userId?: string): Promise<void> {
  try {
    await supabase.from('events').insert({ name, props, user_id: userId ?? null })
  } catch { /* swallow */ }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest __tests__/lib/telemetry.test.ts`
Expected: PASS.

- [ ] **Step 5: Author the telemetry migration**

`supabase/migrations/20260929080000_phase4_telemetry.sql`:
```sql
-- Phase 4: self-hosted error monitoring + analytics (NOT Sentry). Authenticated
-- users insert their own rows; reads are restricted to the owner. Edge functions
-- write via the service role (bypasses RLS). user_id nullable + on delete set null
-- so a log survives account deletion for aggregate debugging.
create table error_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  context text not null,
  message text not null,
  stack text,
  created_at timestamptz not null default now()
);
alter table error_logs enable row level security;
create policy "Users insert own error logs" on error_logs
  for insert with check (auth.uid() = user_id);
create policy "Users read own error logs" on error_logs
  for select using (auth.uid() = user_id);

create table events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table events enable row level security;
create policy "Users insert own events" on events
  for insert with check (auth.uid() = user_id);
create policy "Users read own events" on events
  for select using (auth.uid() = user_id);
```

- [ ] **Step 6: Build the top-level error boundary** (class component; composes tested `logError` — no dedicated component test)

`components/ErrorBoundary.tsx`:
```typescript
import { Component, ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import { logError } from '../lib/telemetry'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    logError('react-error-boundary', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-gray-50 px-8">
          <Text className="text-lg font-bold text-gray-900 mb-2">Something went wrong</Text>
          <Text className="text-gray-500 text-center mb-6">The app hit an unexpected error. It has been logged.</Text>
          <Pressable className="bg-green-600 rounded-lg px-6 py-3" onPress={() => this.setState({ hasError: false })}>
            <Text className="text-white font-semibold">Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 7: Wrap the app** in `app/_layout.tsx`

Add the import:
```typescript
import { ErrorBoundary } from '../components/ErrorBoundary'
```
Wrap the returned tree — change the outer `<GestureHandlerRootView style={{ flex: 1 }}>...</GestureHandlerRootView>` so `ErrorBoundary` is the outermost element:
```typescript
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="inbody" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="progress" />
            <Stack.Screen name="health-connect" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
```

- [ ] **Step 8: Emit key events from the stores**

In `stores/mealsStore.ts`, add `import { logEvent } from '../lib/telemetry'` and, in `addMeal`'s success branch (after `s.meals.unshift(data as Meal)` set completes), fire the event — add right before `return error ? null : (data as Meal)` in the try block:
```typescript
        if (!error && data) logEvent('meal_logged', { meal_type: meal.meal_type }, meal.user_id)
```
In `stores/plansStore.ts`, add `import { logEvent } from '../lib/telemetry'` and, at the end of both `generateMealPlan` and `generateWorkoutPlan` (after `await get().fetchPlans(userId)`), add:
```typescript
      logEvent('plan_generated', { kind: 'meal' }, userId) // 'workout' in generateWorkoutPlan
```
In `stores/healthConnectStore.ts`, add `import { logEvent } from '../lib/telemetry'` and, in `syncNow`'s success `set(...)` path, fire after setting state:
```typescript
        logEvent('hc_synced', { steps, sessions: rows.length }, userId)
```

- [ ] **Step 9: Add the shared edge logger + wire the catch blocks**

`supabase/functions/_shared/logError.ts`:
```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-role insert into error_logs. Never throws (a logging failure must not
// mask the original error).
export async function logEdgeError(
  supabase: SupabaseClient,
  context: string,
  error: unknown,
  userId?: string | null
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? (error.stack ?? null) : null
    await supabase.from('error_logs').insert({ context, message, stack, user_id: userId ?? null })
  } catch (_e) { /* swallow */ }
}
```
Apply this exact edit to each of the five functions — only the `context` string differs (listed per file). Add the import at the top:
```typescript
import { logEdgeError } from '../_shared/logError.ts'
```
and replace the top-level `catch (e) { return new Response(... 500 ...) }` with:
```typescript
  } catch (e) {
    try {
      const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      await logEdgeError(svc, '<CONTEXT>', e)
    } catch (_ignore) { /* logging is best-effort */ }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
```
`<CONTEXT>` per file: `ai-agent`, `generate-daily-summary`, `send-push`, `ai-meal-analysis`, `ai-inbody-analysis`. (`createClient`, `SUPABASE_URL`, `SERVICE_ROLE_KEY`, `CORS` are already imported/defined in every one of these functions.)

- [ ] **Step 10: CONTROLLER — apply migration, regenerate types, redeploy the five functions** (implementer cannot run MCP)

On `ggjrtgowmauoimpvficl`, record each in the ledger:
1. `mcp__supabase__apply_migration` name `phase4_telemetry` (Step 5 SQL).
2. `mcp__supabase__generate_typescript_types`; overwrite `lib/database.types.ts` (now includes `error_logs`, `events`).
3. `mcp__supabase__deploy_edge_function` for `ai-agent`, `generate-daily-summary`, `send-push`, `ai-meal-analysis`, `ai-inbody-analysis` — each including `_shared/logError.ts` in the deploy file set, `verify_jwt: true`.

Expected: `error_logs` + `events` in the regenerated types; all five functions redeployed; a deliberately-triggered edge error appears as a row in `error_logs`.

- [ ] **Step 11: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc exit 0; **all** suites pass (including telemetry).

- [ ] **Step 12: Commit**

```bash
git add lib/telemetry.ts components/ErrorBoundary.tsx supabase/functions/_shared/logError.ts supabase/functions/ai-agent/index.ts supabase/functions/generate-daily-summary/index.ts supabase/functions/send-push/index.ts supabase/functions/ai-meal-analysis/index.ts supabase/functions/ai-inbody-analysis/index.ts supabase/migrations/20260929080000_phase4_telemetry.sql app/_layout.tsx stores/mealsStore.ts stores/plansStore.ts stores/healthConnectStore.ts lib/database.types.ts __tests__/lib/telemetry.test.ts
git commit -m "feat: self-hosted telemetry — error_logs + events tables, lib/telemetry, top-level error boundary, edge-fn error logging, key events

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Play Store preparation

**Files:**
- Modify: `eas.json` (production AAB + `eas submit` profile)
- Modify: `app.json` (privacy-policy URL placeholder in `extra`)
- Create: `docs/play-store-listing.md`
- Create: `docs/privacy-policy.md`

**Interfaces:**
- Consumes: existing EAS project id; the config plugins added in Tasks 1–2.
- Produces: an `eas build --profile production` that yields an AAB with `autoIncrement` versionCode; an `eas submit --profile production` config; store metadata + data-safety docs. **Account creation + submission are the user's manual steps.**

- [ ] **Step 1: Configure the production AAB + submit profile** in `eas.json`

Replace the `build.production` and `submit.production` blocks so production builds an app-bundle and the submit profile is wired (keep `cli.appVersionSource: "remote"` + `autoIncrement` for versionCode):
```json
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./play-service-account.json",
        "track": "internal"
      }
    }
  }
```

- [ ] **Step 2: Add the privacy-policy URL placeholder** in `app.json`

Add to `expo.extra` (Health Connect + Play data-safety both require a reachable privacy-policy URL):
```json
      "privacyPolicyUrl": "https://poshanai.app/privacy"
```
(Placeholder — the user replaces it with the live URL where `docs/privacy-policy.md` is published, then enters the same URL in the Play Console and the Health Connect data-sharing section.)

- [ ] **Step 3: Write the privacy-policy placeholder**

`docs/privacy-policy.md`:
```markdown
# Poshan AI — Privacy Policy (DRAFT / PLACEHOLDER)

_Last updated: 2026-09-29. Replace this draft with counsel-reviewed copy before publishing at https://poshanai.app/privacy._

## Data we collect
- Account: email (authentication).
- Health & fitness you enter or connect: meals and macros, activity logs, InBody body-composition scans, goals, and — if you connect Health Connect — steps, active calories, heart rate, and exercise sessions read from Health Connect.
- Photos: meal and InBody photos you capture (stored in your private/per-user storage).
- Diagnostics: crash/error logs and product-analytics events (self-hosted in our Supabase database; not shared with third-party analytics).

## How we use it
- To provide coaching, daily summaries, and plans (processed by OpenAI `gpt-4o` via our backend).
- To send you push notifications (your morning coach note) via Expo/FCM.

## Health Connect
Poshan AI reads Steps, Active Calories, Heart Rate, and Exercise Sessions from Health Connect only after you grant permission, and uses them solely to show your activity in-app. We do not sell Health Connect data or use it for advertising. You can revoke access anytime in Health Connect.

## Data sharing, retention, deletion
- Shared only with the processors needed to run the app (Supabase, OpenAI, Expo/FCM). No sale of personal data.
- Delete your account to remove your data; contact <support@poshanai.app>.
```

- [ ] **Step 4: Write the Play Store listing doc**

`docs/play-store-listing.md`:
```markdown
# Poshan AI — Play Store Listing & Release Checklist

> The Google Play Developer account and the actual submission are the user's manual steps.
> This doc + the EAS config prepare everything needed to submit.

## Prerequisites (user manual steps)
- [ ] Google Play Developer account created ($25 one-time).
- [ ] FCM v1 service-account key uploaded to EAS: `eas credentials` → Android → Push Notifications (FCM V1). (Required for push delivery; see Task 2.)
- [ ] Play service-account JSON saved at `./play-service-account.json` (path referenced by `eas.json` submit profile) — do NOT commit it (add to `.gitignore`).
- [ ] Privacy policy published at the URL set in `app.json` `extra.privacyPolicyUrl`.

## Build & submit (controller / user run; not the implementer)
- Production AAB: `eas build --platform android --profile production` (yields an .aab; versionCode auto-increments via `appVersionSource: remote`).
- Submit: `eas submit --platform android --profile production` (uploads to the `internal` track first).

## Store listing copy
- **App name:** Poshan AI
- **Short description (≤80 chars):** AI health coach: log meals, track activity, hit your macro and step goals.
- **Full description:** Poshan AI is your personal AI health coach. Snap a photo of your meal for instant macros, get a proactive morning coach note and daily targets, generate weekly meal and workout plans, track InBody body-composition trends, and auto-sync steps, calories, heart rate, and workouts from Health Connect. Works offline — meals you log without a connection sync automatically when you're back online.
- **Category:** Health & Fitness
- **Contact email:** support@poshanai.app
- **Privacy policy URL:** (from `app.json` `extra.privacyPolicyUrl`)

## Screenshots checklist (phone, min 2; 1080×1920 or similar)
- [ ] Dashboard with progress rings + morning coach note
- [ ] Meal logging (photo → macros)
- [ ] Plans tab (meal + workout plan)
- [ ] Progress screen (InBody line charts + calorie-adherence bar chart)
- [ ] Health Connect connect/sync screen
- [ ] Feature graphic 1024×500

## Data safety form answers
- **Data collected:** Email (account); Health & fitness (meals/macros, activity, InBody, goals); Photos; Diagnostics (crash logs) + Analytics (app events, self-hosted).
- **Health Connect data types read:** Steps, Active Calories Burned, Heart Rate, Exercise Sessions — used only for in-app activity tracking; not sold; not used for ads.
- **Encrypted in transit:** Yes. **Users can request deletion:** Yes.
- **Data shared with third parties:** Processing only (Supabase, OpenAI, Expo/FCM); no sale.
```

- [ ] **Step 5: Verify config sanity**

Run: `npx expo-doctor`
Expected: all checks pass (config plugins for `react-native-health-connect` and `expo-notifications` recognized; no schema errors in `app.json`/`eas.json`).
Run: `npx tsc --noEmit && npx jest`
Expected: tsc exit 0; all suites pass (no code change in this task, but confirm the branch is green before the release build).

- [ ] **Step 6: CONTROLLER / USER — production build + submit** (implementer cannot run EAS)

- Controller (or user) runs `eas build --platform android --profile production` and records the build URL/artifact in the ledger.
- User installs the AAB/APK on a physical Android device and verifies: Health Connect read (grant permission → Sync now populates steps/calories/workouts, and a second Sync now does NOT duplicate rows), push receipt (morning coach note arrives), and offline meal logging (airplane mode → log → reconnect → meal syncs, badge clears).
- User completes the Play Console listing from `docs/play-store-listing.md` and runs `eas submit --platform android --profile production`.

- [ ] **Step 7: Commit**

```bash
git add eas.json app.json docs/play-store-listing.md docs/privacy-policy.md
git commit -m "chore: Play Store prep — production AAB + eas submit profile, privacy-policy placeholder, listing + data-safety docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 Complete

Delivers:
- **Health Connect** activity sync (steps, active calories, heart rate, exercise sessions) with idempotent dedup (`activity_logs.source` + unique index), a permission/onboarding screen with a graceful "not available"/iOS fallback, dashboard foreground sync, and TDD'd dedup/aggregation helpers.
- **Push notifications** via `expo-notifications` + `push_tokens` (RLS, unique token), token registration on login, a cron-secret-guarded `send-push` edge function (Expo Push API, prunes stale tokens), and the morning cron sending the coach note through it. FCM upload = documented user step.
- **Offline meal logging**: AsyncStorage queue in `mealsStore`, ordered idempotent flush on reconnect (NetInfo) / foreground, queued-photo upload, pending badge — TDD'd queue + flush logic.
- **RLS multi-user audit**: controller advisors + verification, idempotent RLS-hardening migration, and store-reset-on-signout so a second user on the same device sees no stale data.
- **AI rate-limiting**: `ai_usage` + atomic per-day RPC enforced in the three AI edge functions → friendly 429; clients surface "daily AI limit reached." TDD'd counter logic.
- **Self-hosted monitoring + analytics**: `error_logs` + `events` tables (RLS), `lib/telemetry.ts`, a top-level error boundary, edge-fn failure logging, and key events — TDD'd shaping. No Sentry.
- **Play Store prep**: production AAB EAS profile + `eas submit` config + privacy-policy placeholder + listing/data-safety docs. Account + submission = user steps.

**Next:** Apple HealthKit (iOS activity sync); optional Sentry swap; web build.

---

## Self-Review

Run against the spec after writing. Findings and fixes recorded here.

**1. Spec coverage** — every spec section maps to a task: Health Connect §1 → Task 1; Push §2 → Task 2; Offline §3 → Task 3; RLS audit §4 → Task 4; Rate-limiting §5 → Task 5; Monitoring §6 → Task 6; Play Store §7 → Task 7. The "custom config-plugin build" note maps to Task 1/2 `app.json` plugin edits + Task 7 EAS profile. FCM-as-user-step, account+submission-as-user-step, and device-verification-as-user-step are all stated. No uncovered requirement.

**2. Placeholder scan** — every code step contains real code; every run step has a real command + expected output; every commit ends with the Co-Authored-By line. The one file literally named a placeholder (`docs/privacy-policy.md`) is intentional draft legal copy the user replaces, and it is fully written, not a stub.

**3. Type consistency** — `ActivitySource`/`ActivityLog.source` (Task 1) reused by `resetAllStores` and HC upsert; `PushPlatform` (Task 2) used by `buildPushTokenRow` + `pushStore`; `QueuedMeal` (Task 3) used by `mealsStore`; `evaluateUsage`/`AI_LIMIT_MESSAGE`/`messageForStatus` (Task 5) used by the three API clients; `logEvent`/`logError`/`logEdgeError` (Task 6) used by stores + edge fns. `resetAllStores` (Task 4) resets `mealsStore`'s Task-3 fields (`pendingCount`, `flushing`), `pushStore` (Task 2), and `healthConnectStore` (Task 1) — consistent with each store's declared shape. Store action names match across tasks.

**4. Review Focus** — all five (HC re-sync dup, rate-limit off-by-one/reset, offline lose/double, push token dup/stale, store-not-reset leak) are pinned to a test/verification in their owning task (Tasks 1, 5, 3, 2, 4 respectively).

Self-Review passed; no inline fixes required.
