# Phase 2: Health Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add InBody body-composition scans (photo → AI extraction), manual activity logging, progress-timeline charts, and AI-driven goal adjustment, so the coach can adapt the plan to real results.

**Architecture:** Extends Phase 1 (React Native + Expo Router + Supabase). One new Deno Edge Function (`ai-inbody-analysis`, gpt-4o vision) extracts InBody metrics from a photo. Two new tables (`inbody_reports`, `activity_logs`) with RLS and a private `inbody-photos` bucket. New Zustand v5 + immer stores (`inbodyStore`, `activityStore`) mirror the Phase 1 store contract exactly. Charts are hand-built with `react-native-svg`. The existing `ai-agent` gains three tools and enriched context/system-prompt. Navigation keeps the 4-tab bar; InBody / Activity / Progress are stack screens reached from Home.

**Tech Stack:** React Native, Expo SDK 52+, Expo Router v4, TypeScript (strict), NativeWind v4, Zustand v5 + immer, Supabase JS v2, Supabase Edge Functions (Deno, OpenAI gpt-4o), `react-native-svg`, `expo-file-system/legacy` + `base64-arraybuffer`, Jest + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-2-health-tracking-design.md`

**Prerequisite:** Phase 1 complete, all tests green (`npx tsc --noEmit` clean, `npx jest` all pass).

## Global Constraints

Carry every Phase 1 constraint, plus the following (copied verbatim from the spec):

- Android API 26+ (Android 8.0) minimum; iOS 16+ compatible.
- TypeScript strict mode — no `any`; typed Supabase client, **no read-site casts**; narrow `as unknown as <Insert>` only at write sites.
- All new Supabase tables have RLS enabled: `auth.uid() = user_id` (using + with check). No table is readable without an authenticated user.
- Zustand v5 with `immer` middleware for all stores. Every store action that touches Supabase captures `{ data, error }`, sets `error = error?.message ?? null`, and toggles `loading`. Every screen renders its store `error`; navigation/proceed only on success.
- NativeWind v4 (Tailwind v3 syntax).
- **InBody ingestion is photo-only** (camera/gallery → gpt-4o vision OCR). PDF ingestion is out of scope.
- **Charts use `react-native-svg`** (already installed), hand-built. **Do NOT add a charting library.** No new dependency is required for Phase 2 (`react-native-svg`, `expo-file-system`, `base64-arraybuffer`, `expo-image-picker` are all installed).
- **Navigation keeps the existing 4-tab bar** (Home / Meals / Chat / Settings). InBody, Activity, and Body/Progress are stack screens reached via dashboard quick-actions — **not new tabs**.
- **Goals remain append-only / latest-wins.** Any goal write is an `.insert()` of a new row; reads take the most-recent by `created_at`. `adjust_diet_plan` inserts a new goals row.
- **Private buckets:** store the storage **PATH** in the DB column (never `getPublicUrl`), and sign on read via the service-role client (Phase 1 IMP-3 lesson).
- **Edge functions:** `verify_jwt: true`; derive the user from the JWT (`authClient.auth.getUser()`); never trust a body `user_id`. OpenAI `gpt-4o`. The model must return `null` for any InBody metric it cannot read — no fabrication.
- AI API keys stay Supabase Edge Function secrets only. `OPENAI_API_KEY` is already set (Phase 1); no new secret needed.
- **Schema + edge deploys are split:** the **implementer** authors the migration SQL file and edge-function source and cannot run Supabase MCP. The **controller** applies the migration via Supabase MCP to remote project `ggjrtgowmauoimpvficl`, regenerates `lib/database.types.ts`, deploys/redeploys edge functions, and records these in the execution ledger (as in Phase 1 Task 2) so no implementer re-runs MCP.
- Quality gates per task: `npx tsc --noEmit` clean **and** `npx jest` all pass. TDD for stores and pure utils. Screens that only compose already-tested store actions do not need dedicated tests (noted per task). `npx expo-doctor` 21/21 before shipping.

## Review Focus

These are the failure classes the spec implies but that could slip through; each is pinned to a test/verification in the owning task.

1. **InBody analysis returns `null`s or garbage.** A metric the model can't read must arrive as `null` and be stored as `null` (never fabricated `0`). → Task 4, `inbodyStore` test asserts null metrics pass straight through to the insert payload unchanged; Task 2, controller smoke test confirms the function returns `null` (not `0`) for an unreadable field.
2. **Activity steps aggregation for "today".** Summing an empty list must be `0`, and the day filter must use the same UTC-day boundary as meals so a scan and a meal on the same calendar-UTC day agree. → Task 3, `sumSteps` util test (empty → 0, sums correctly) + `fetchTodayActivity` uses `${today}T00:00:00` like `mealsStore`.
3. **Empty / single-scan timeline.** A user with <2 scans must see an empty state, never a crashed chart or a divide-by-zero. → Task 5, `scalePoints` test (empty → `[]`, single point → centered, all-equal → mid-line) + Progress screen renders empty state when a series has <2 points.
4. **Upload failure surfacing.** A failed photo upload or a failed row insert must show an error, not silently save nothing. → Task 4, `InBodyPhotoCapture` renders `uploadError`; `inbodyStore.addReport` test asserts `error` is set on insert failure and the screen renders it.
5. **`adjust_diet_plan` inserts rather than updates.** The tool must append a new goals row (latest-wins), never mutate the existing one. → Task 6, controller smoke test: call the tool, confirm `select count(*) from goals where user_id = ...` incremented by exactly 1 and the newest row holds the new targets.

---

## File Structure

```
poshan-ai/
├── app/
│   ├── _layout.tsx                       # MODIFY: Slot -> Stack so root stack screens render
│   ├── (tabs)/
│   │   └── index.tsx                     # MODIFY: steps ring from activity (Task 3) + quick-actions (Task 7)
│   ├── inbody.tsx                        # NEW: capture -> analyze -> confirm -> save
│   ├── activity.tsx                      # NEW: manual activity log + today's list
│   └── progress.tsx                      # NEW: Body/Progress timeline charts
├── components/
│   ├── ui/
│   │   └── LineChart.tsx                 # NEW: react-native-svg line chart
│   └── inbody/
│       └── InBodyPhotoCapture.tsx        # NEW: base64 upload to inbody-photos, returns PATH
├── lib/
│   ├── api/
│   │   └── inbody.ts                     # NEW: calls ai-inbody-analysis edge fn
│   └── utils/
│       ├── activity.ts                   # NEW: sumSteps / sumActiveCalories
│       └── chart.ts                      # NEW: scalePoints (pure chart math)
├── stores/
│   ├── inbodyStore.ts                    # NEW
│   └── activityStore.ts                  # NEW
├── types/
│   └── index.ts                          # MODIFY: InBodyReport, ActivityLog, ActivityType
├── supabase/
│   ├── migrations/
│   │   └── 20260929010000_phase2_health_tracking.sql   # NEW
│   └── functions/
│       ├── ai-inbody-analysis/index.ts   # NEW
│       └── ai-agent/
│           ├── tools.ts                  # MODIFY: log_activity, get_inbody_history, adjust_diet_plan
│           ├── context.ts                # MODIFY: latest InBody + recent activity
│           └── index.ts                  # MODIFY: coaching principles in system prompt
└── __tests__/
    ├── stores/
    │   ├── inbodyStore.test.ts           # NEW
    │   └── activityStore.test.ts         # NEW
    └── lib/
        ├── activity.test.ts              # NEW
        ├── chart.test.ts                 # NEW
        └── inbody.test.ts                # NEW
```

---

### Task 1: Supabase Schema — `inbody_reports` + `activity_logs` + `inbody-photos` bucket

**Files:**
- Create: `supabase/migrations/20260929010000_phase2_health_tracking.sql`
- Modify: `types/index.ts` (append InBody + activity types)
- Regenerated by controller: `lib/database.types.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (DB): tables `inbody_reports`, `activity_logs` (RLS on), private bucket `inbody-photos` with per-user-folder insert/select/delete policies.
- Produces (TS): `InBodyReport`, `ActivityLog`, `ActivityType` in `types/index.ts`; regenerated `Database['public']['Tables']['inbody_reports']` and `['activity_logs']` in `lib/database.types.ts`.

- [ ] **Step 1: Author the migration SQL**

`supabase/migrations/20260929010000_phase2_health_tracking.sql`:
```sql
-- Phase 2: health tracking — InBody reports + activity logs + private inbody-photos bucket.
-- uuid-ossp is already enabled by the Phase 1 migration.

-- InBody body-composition reports (photo -> AI extraction).
create table inbody_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  scanned_at timestamptz not null default now(),
  photo_url text,                       -- storage PATH in private inbody-photos bucket
  weight_kg float,
  body_fat_pct float,
  muscle_mass_kg float,
  visceral_fat float,
  bmr int,
  raw_extracted_json jsonb,             -- full OCR/extraction output
  ai_notes text,                        -- short coach note on this scan
  created_at timestamptz not null default now()
);
alter table inbody_reports enable row level security;
create policy "Users manage own inbody reports" on inbody_reports
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Manual activity logs (steps summed client-side into the day's dashboard).
create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  activity_type text not null check (activity_type in ('walk','run','gym','cycle','swim','yoga','other')),
  duration_min int not null default 0,
  steps int not null default 0,
  calories_burned int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table activity_logs enable row level security;
create policy "Users manage own activity logs" on activity_logs
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket for InBody photos. Store the PATH in inbody_reports.photo_url; sign on read.
insert into storage.buckets (id, name, public)
values ('inbody-photos', 'inbody-photos', false)
on conflict (id) do nothing;

create policy "Users upload own inbody photos" on storage.objects
  for insert with check (bucket_id = 'inbody-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own inbody photos" on storage.objects
  for select using (bucket_id = 'inbody-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own inbody photos" on storage.objects
  for delete using (bucket_id = 'inbody-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Append shared types** to `types/index.ts` (add at the end; do not touch existing exports)

```typescript
export type ActivityType = 'walk' | 'run' | 'gym' | 'cycle' | 'swim' | 'yoga' | 'other'

export interface InBodyReport {
  id: string
  user_id: string
  scanned_at: string
  photo_url: string | null
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  raw_extracted_json: unknown | null
  ai_notes: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  logged_at: string
  activity_type: ActivityType
  duration_min: number
  steps: number
  calories_burned: number
  notes: string
  created_at: string
}
```

- [ ] **Step 3: CONTROLLER — apply migration + regenerate types via Supabase MCP**

The implementer cannot run MCP. The controller performs (and records in the execution ledger, as in Phase 1 Task 2):
- `mcp__supabase__apply_migration` on project `ggjrtgowmauoimpvficl` with name `phase2_health_tracking` and the SQL from Step 1.
- `mcp__supabase__generate_typescript_types` on `ggjrtgowmauoimpvficl`; write the output to `lib/database.types.ts` (overwrite).

Expected: migration applies with no error; `lib/database.types.ts` now contains `inbody_reports` and `activity_logs` under `Database['public']['Tables']`.

- [ ] **Step 4: Verify types compile against the regenerated schema**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (Confirms `types/index.ts` additions and the regenerated `database.types.ts` are consistent.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929010000_phase2_health_tracking.sql types/index.ts lib/database.types.ts
git commit -m "feat: add Phase 2 schema (inbody_reports, activity_logs, inbody-photos bucket) with RLS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Edge Function — `ai-inbody-analysis`

**Files:**
- Create: `supabase/functions/ai-inbody-analysis/index.ts`

**Interfaces:**
- Consumes: `inbody-photos` bucket (Task 1); `OPENAI_API_KEY` secret (already set).
- Produces: `POST /functions/v1/ai-inbody-analysis`.
  - Request: `{ photo_url: string }` — the storage PATH in `inbody-photos` (a full URL containing `/inbody-photos/` is also accepted).
  - Response `200`: `{ weight_kg: number|null, body_fat_pct: number|null, muscle_mass_kg: number|null, visceral_fat: number|null, bmr: number|null, raw: object, notes: string }`.
  - Response `4xx/5xx`: `{ error: string }`.

- [ ] **Step 1: Write the Edge Function** (mirrors `ai-meal-analysis`: JWT-derived user, service-role signed URL, gpt-4o vision, JSON-object response)

`supabase/functions/ai-inbody-analysis/index.ts`:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!

// A metric the model cannot clearly read must come back as null — never a guess.
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const authClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    // Accept a storage path ("<userId>/<file>.jpg") or a full URL containing it.
    const raw: string = body.photo_path ?? body.photo_url ?? ''
    const path = raw.includes('/inbody-photos/') ? raw.split('/inbody-photos/')[1] : raw
    if (!path) {
      return new Response(JSON.stringify({ error: 'Missing photo_url' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: signed, error: signErr } = await supabase.storage.from('inbody-photos').createSignedUrl(path, 120)
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: `Could not access photo: ${signErr?.message ?? 'unknown'}` }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const prompt = `This is a photo of an InBody (or similar) body-composition scan printout. Read the printed values. Respond with ONLY a JSON object, no markdown, with exactly these fields:
{
  "weight_kg": number or null,
  "body_fat_pct": number or null,
  "muscle_mass_kg": number or null,
  "visceral_fat": number or null,
  "bmr": number or null,
  "raw": { "<label>": "<value as printed>", ... },
  "notes": "one short, encouraging coach note about this scan"
}
Rules: Use kilograms for weight and muscle mass, a percentage for body fat, kcal for BMR. If a value is not clearly printed or you are unsure, return null for that field — DO NOT guess or fabricate a number. Put every label/value pair you can read into "raw".`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: signed.signedUrl } },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return new Response(JSON.stringify({ error: `OpenAI error ${res.status}: ${text}` }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const data = await res.json()
    const text: string = data.choices[0].message.content ?? '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch {
      const m = text.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : {}
    }

    const result = {
      weight_kg: numOrNull(parsed.weight_kg),
      body_fat_pct: numOrNull(parsed.body_fat_pct),
      muscle_mass_kg: numOrNull(parsed.muscle_mass_kg),
      visceral_fat: numOrNull(parsed.visceral_fat),
      bmr: numOrNull(parsed.bmr),
      raw: (parsed.raw && typeof parsed.raw === 'object') ? parsed.raw : parsed,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    }

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
```

- [ ] **Step 2: CONTROLLER — deploy via Supabase MCP**

Implementer cannot deploy. Controller runs `mcp__supabase__deploy_edge_function` on `ggjrtgowmauoimpvficl` with slug `ai-inbody-analysis`, `verify_jwt: true`, and the source above; records it in the ledger.

Expected: function deployed; listed by `mcp__supabase__list_edge_functions`.

- [ ] **Step 3: CONTROLLER — smoke test (Review Focus #1)**

Upload a real InBody photo to `inbody-photos/<userId>/test.jpg` (via dashboard), then:
```bash
curl -X POST https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/ai-inbody-analysis \
  -H "Authorization: Bearer <A_LOGGED_IN_USER_JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"photo_url":"<userId>/test.jpg"}'
```
Expected: JSON with numeric metrics for readable fields and **`null`** (not `0`) for any field the printout does not contain — confirm at least one deliberately-cropped field returns `null`. `raw` is a non-empty object; `notes` is a short string.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-inbody-analysis/
git commit -m "feat: add ai-inbody-analysis edge function (gpt-4o vision, null for unreadable metrics)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Activity — store, log screen, dashboard steps wiring

**Files:**
- Create: `stores/activityStore.ts`
- Create: `lib/utils/activity.ts`
- Create: `app/activity.tsx`
- Create: `__tests__/stores/activityStore.test.ts`
- Create: `__tests__/lib/activity.test.ts`
- Modify: `app/(tabs)/index.tsx` (steps ring reads today's summed steps)

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts`; `ActivityLog`, `ActivityType` from `types`; `Database['public']['Tables']['activity_logs']['Insert']`.
- Produces: `useActivityStore` — `{ todayActivity: ActivityLog[], loading: boolean, error: string|null, fetchTodayActivity(userId: string): Promise<void>, addActivity(activity: NewActivity): Promise<ActivityLog|null> }` where `NewActivity = { user_id: string; activity_type: ActivityType; duration_min: number; steps: number; calories_burned: number; notes: string }`.
- Produces: `sumSteps(logs: ActivityLog[]): number`, `sumActiveCalories(logs: ActivityLog[]): number` from `lib/utils/activity.ts`.

- [ ] **Step 1: Write failing activity util test** (Review Focus #2)

`__tests__/lib/activity.test.ts`:
```typescript
import { sumSteps, sumActiveCalories } from '../../lib/utils/activity'
import { ActivityLog } from '../../types'

const log = (steps: number, calories_burned: number): ActivityLog => ({
  id: 'x', user_id: 'u', logged_at: '2026-09-29T10:00:00Z', activity_type: 'walk',
  duration_min: 0, steps, calories_burned, notes: '', created_at: '2026-09-29T10:00:00Z',
})

describe('activity utils', () => {
  it('sumSteps returns 0 for an empty list', () => {
    expect(sumSteps([])).toBe(0)
  })
  it('sumSteps totals steps across logs', () => {
    expect(sumSteps([log(4000, 0), log(2500, 0)])).toBe(6500)
  })
  it('sumActiveCalories totals calories across logs', () => {
    expect(sumActiveCalories([log(0, 120), log(0, 80)])).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest __tests__/lib/activity.test.ts`
Expected: FAIL — cannot find module `lib/utils/activity`.

- [ ] **Step 3: Implement activity utils**

`lib/utils/activity.ts`:
```typescript
import { ActivityLog } from '../../types'

export function sumSteps(logs: ActivityLog[]): number {
  return logs.reduce((acc, l) => acc + l.steps, 0)
}

export function sumActiveCalories(logs: ActivityLog[]): number {
  return logs.reduce((acc, l) => acc + l.calories_burned, 0)
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest __tests__/lib/activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing activity store test** (Review Focus #2 — UTC-day fetch + error handling)

`__tests__/stores/activityStore.test.ts`:
```typescript
import { useActivityStore } from '../../stores/activityStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const mockInsert = (data: unknown, error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('activityStore', () => {
  beforeEach(() => useActivityStore.setState({ todayActivity: [], loading: false, error: null }))

  it('sets error on failed insert and returns null', async () => {
    mockInsert(null, { message: 'insert failed' })
    const result = await useActivityStore.getState().addActivity({
      user_id: 'u1', activity_type: 'run', duration_min: 30, steps: 5000, calories_burned: 300, notes: '',
    })
    expect(result).toBeNull()
    expect(useActivityStore.getState().error).toBe('insert failed')
  })

  it('prepends the new log on success', async () => {
    mockInsert({ id: 'a1', user_id: 'u1', activity_type: 'run', duration_min: 30, steps: 5000, calories_burned: 300, notes: '', logged_at: '2026-09-29T10:00:00Z', created_at: '2026-09-29T10:00:00Z' })
    const result = await useActivityStore.getState().addActivity({
      user_id: 'u1', activity_type: 'run', duration_min: 30, steps: 5000, calories_burned: 300, notes: '',
    })
    expect(result?.id).toBe('a1')
    expect(useActivityStore.getState().todayActivity).toHaveLength(1)
    expect(useActivityStore.getState().error).toBeNull()
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

Run: `npx jest __tests__/stores/activityStore.test.ts`
Expected: FAIL — cannot find module `stores/activityStore`.

- [ ] **Step 7: Implement the activity store** (mirrors `mealsStore` exactly)

`stores/activityStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { ActivityLog, ActivityType } from '../types'

type ActivityInsert = Database['public']['Tables']['activity_logs']['Insert']

export interface NewActivity {
  user_id: string
  activity_type: ActivityType
  duration_min: number
  steps: number
  calories_burned: number
  notes: string
}

interface ActivityState {
  todayActivity: ActivityLog[]
  loading: boolean
  error: string | null
  fetchTodayActivity: (userId: string) => Promise<void>
  addActivity: (activity: NewActivity) => Promise<ActivityLog | null>
}

export const useActivityStore = create<ActivityState>()(
  immer((set) => ({
    todayActivity: [],
    loading: false,
    error: null,

    fetchTodayActivity: async (userId) => {
      // Same UTC-day boundary as mealsStore so meals and activity agree on "today".
      const today = new Date().toISOString().split('T')[0]
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .order('logged_at', { ascending: false })
      set((s) => {
        s.loading = false
        s.todayActivity = error ? [] : (data as ActivityLog[])
        s.error = error?.message ?? null
      })
    },

    addActivity: async (activity) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('activity_logs')
        .insert({ ...activity, logged_at: new Date().toISOString() } as unknown as ActivityInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) s.todayActivity.unshift(data as ActivityLog)
        s.error = error?.message ?? null
      })
      return error ? null : (data as ActivityLog)
    },
  }))
)
```

- [ ] **Step 8: Run store test to confirm it passes**

Run: `npx jest __tests__/stores/activityStore.test.ts`
Expected: PASS.

- [ ] **Step 9: Build the activity log screen** (composes tested store; no dedicated screen test)

`app/activity.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useActivityStore } from '../stores/activityStore'
import { ActivityType } from '../types'

const TYPES: ActivityType[] = ['walk', 'run', 'gym', 'cycle', 'swim', 'yoga', 'other']

export default function ActivityScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { todayActivity, fetchTodayActivity, addActivity, loading, error } = useActivityStore()
  const [type, setType] = useState<ActivityType>('walk')
  const [duration, setDuration] = useState('')
  const [steps, setSteps] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => { if (user) fetchTodayActivity(user.id) }, [user])

  const handleSave = async () => {
    if (!user) return
    const result = await addActivity({
      user_id: user.id,
      activity_type: type,
      duration_min: parseInt(duration, 10) || 0,
      steps: parseInt(steps, 10) || 0,
      calories_burned: parseInt(calories, 10) || 0,
      notes,
    })
    if (result) { setDuration(''); setSteps(''); setCalories(''); setNotes('') }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">Log activity</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}

      <View className="px-6 pt-4">
        <Text className="text-gray-600 mb-1">Type</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} className={`px-4 py-2 rounded-lg border ${type === t ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
              <Text className={type === t ? 'text-white' : 'text-gray-700'}>{t}</Text>
            </Pressable>
          ))}
        </View>
        {[
          { label: 'Duration (min)', value: duration, setter: setDuration },
          { label: 'Steps', value: steps, setter: setSteps },
          { label: 'Calories burned (kcal)', value: calories, setter: setCalories },
        ].map(({ label, value, setter }) => (
          <View key={label} className="mb-4">
            <Text className="text-gray-600 mb-1">{label}</Text>
            <TextInput className="border border-gray-300 rounded-lg px-4 py-3" keyboardType="number-pad" value={value} onChangeText={setter} placeholder="0" />
          </View>
        ))}
        <Text className="text-gray-600 mb-1">Notes</Text>
        <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-6" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
        <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-6" onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Save activity</Text>}
        </Pressable>

        <Text className="font-semibold text-gray-700 mb-3">Today's activity</Text>
        {todayActivity.length === 0
          ? <Text className="text-gray-400 text-center py-8">No activity logged yet today</Text>
          : todayActivity.map((a) => (
            <View key={a.id} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <View className="flex-row justify-between">
                <Text className="font-semibold text-gray-900 capitalize">{a.activity_type}</Text>
                <Text className="text-green-700 font-bold">{a.calories_burned} kcal</Text>
              </View>
              <Text className="text-xs text-gray-500 mt-1">{a.duration_min} min · {a.steps} steps</Text>
              {a.notes ? <Text className="text-xs text-gray-500 mt-1">{a.notes}</Text> : null}
            </View>
          ))}
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 10: Wire the steps ring on the dashboard** — replace the placeholder steps ring in `app/(tabs)/index.tsx`.

Add imports near the other store/util imports:
```typescript
import { useActivityStore } from '../../stores/activityStore'
import { sumSteps } from '../../lib/utils/activity'
```
Inside `HomeScreen`, add the store hook alongside the others:
```typescript
  const { todayActivity, fetchTodayActivity, error: activityError } = useActivityStore()
```
In the existing `useEffect(() => { if (user) { ... } }, [user])`, add:
```typescript
      fetchTodayActivity(user.id)
```
After the `const fatTarget = ...` line add:
```typescript
  const stepsToday = sumSteps(todayActivity)
  const stepsTarget = goals?.daily_steps_target ?? 8000
```
Extend the error line to include activity:
```typescript
  const errorMessage = mealsError ?? profileError ?? summaryError ?? activityError
```
Replace the placeholder steps ring:
```typescript
          <ProgressRing percentage={0} label="Steps" value="—" color="#d97706" />
```
with:
```typescript
          <ProgressRing percentage={calcProgress(stepsToday, stepsTarget)} label="Steps" value={`${stepsToday}`} color="#d97706" />
```

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 12: Commit**

```bash
git add stores/activityStore.ts lib/utils/activity.ts app/activity.tsx app/(tabs)/index.tsx __tests__/stores/activityStore.test.ts __tests__/lib/activity.test.ts
git commit -m "feat: manual activity logging with store, screen, and dashboard steps ring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: InBody — store, capture component, upload/analyze/confirm/save screen

**Files:**
- Create: `stores/inbodyStore.ts`
- Create: `lib/api/inbody.ts`
- Create: `components/inbody/InBodyPhotoCapture.tsx`
- Create: `app/inbody.tsx`
- Create: `__tests__/stores/inbodyStore.test.ts`
- Create: `__tests__/lib/inbody.test.ts`

**Interfaces:**
- Consumes: `supabase`; `InBodyReport` from `types`; `Database['public']['Tables']['inbody_reports']['Insert']`; `ai-inbody-analysis` (Task 2).
- Produces: `analyzeInBodyPhoto(photoPath: string): Promise<InBodyAnalysisResult>` from `lib/api/inbody.ts`, where
  `InBodyAnalysisResult = { weight_kg: number|null; body_fat_pct: number|null; muscle_mass_kg: number|null; visceral_fat: number|null; bmr: number|null; raw: Record<string, unknown>; notes: string }`.
- Produces: `useInbodyStore` — `{ reports: InBodyReport[], latest: InBodyReport|null, loading: boolean, error: string|null, fetchReports(userId: string): Promise<void>, addReport(report: NewInBodyReport): Promise<InBodyReport|null> }` where
  `NewInBodyReport = { user_id: string; photo_url: string; weight_kg: number|null; body_fat_pct: number|null; muscle_mass_kg: number|null; visceral_fat: number|null; bmr: number|null; raw_extracted_json: Record<string, unknown>|null; ai_notes: string|null }`.
- Produces: `InBodyPhotoCapture` — `{ onUploaded(path: string): void }` (uploads to `inbody-photos/<userId>/<ts>.jpg`, calls back with the storage **PATH**, not a public URL).

> **Design reconciliation (spec §Client features 1):** the spec says `addReport` "uploads … calls analysis … then inserts". Phase 1's established split (`MealPhotoCapture` uploads, the screen calls the analysis API, the store only inserts) is preserved here because the spec's own UX for InBody is *capture → analyze → show metrics for confirmation → save*: analysis must run **before** the row exists so the user can confirm/edit. So upload lives in `InBodyPhotoCapture`, analysis in `lib/api/inbody.ts` called by the screen, and `inbodyStore.addReport` performs the INSERT storing the PATH. Every spec requirement (base64→ArrayBuffer upload, store PATH not public URL, call `ai-inbody-analysis`, insert the row) is satisfied; only placement differs, driven by the confirmation UX.

- [ ] **Step 1: Write failing analysis-API test** (Review Focus #1 — nulls pass through)

`__tests__/lib/inbody.test.ts`:
```typescript
import { analyzeInBodyPhoto } from '../../lib/api/inbody'

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) } },
}))

describe('analyzeInBodyPhoto', () => {
  const realFetch = global.fetch
  afterEach(() => { global.fetch = realFetch })

  it('passes null metrics through unchanged', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ weight_kg: 72.5, body_fat_pct: null, muscle_mass_kg: null, visceral_fat: 8, bmr: null, raw: { Weight: '72.5' }, notes: 'nice' }),
    }) as unknown as typeof fetch
    const result = await analyzeInBodyPhoto('u1/scan.jpg')
    expect(result.weight_kg).toBe(72.5)
    expect(result.body_fat_pct).toBeNull()
    expect(result.muscle_mass_kg).toBeNull()
    expect(result.bmr).toBeNull()
  })

  it('throws with the server error message on non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'bad photo' }) }) as unknown as typeof fetch
    await expect(analyzeInBodyPhoto('u1/scan.jpg')).rejects.toThrow('bad photo')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest __tests__/lib/inbody.test.ts`
Expected: FAIL — cannot find module `lib/api/inbody`.

- [ ] **Step 3: Implement the analysis API client** (mirrors `lib/api/mealAnalysis.ts` exactly)

`lib/api/inbody.ts`:
```typescript
import { supabase } from '../supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export interface InBodyAnalysisResult {
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  raw: Record<string, unknown>
  notes: string
}

export async function analyzeInBodyPhoto(photoPath: string): Promise<InBodyAnalysisResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-inbody-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ photo_url: photoPath }),
  })

  const body: unknown = await response.json()

  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `InBody analysis request failed with status ${response.status}`
    throw new Error(message)
  }

  return body as InBodyAnalysisResult
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest __tests__/lib/inbody.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing inbody store test** (Review Focus #1 nulls stored + #4 error surfacing)

`__tests__/stores/inbodyStore.test.ts`:
```typescript
import { useInbodyStore } from '../../stores/inbodyStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const mockInsert = (data: unknown, error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

const nullMetrics = {
  user_id: 'u1', photo_url: 'u1/scan.jpg',
  weight_kg: 72.5, body_fat_pct: null, muscle_mass_kg: null, visceral_fat: null, bmr: null,
  raw_extracted_json: { Weight: '72.5' }, ai_notes: 'ok',
}

describe('inbodyStore', () => {
  beforeEach(() => useInbodyStore.setState({ reports: [], latest: null, loading: false, error: null }))

  it('inserts null metrics unchanged (no fabrication to 0)', async () => {
    const chain = mockInsert({ id: 'r1', scanned_at: '2026-09-29T10:00:00Z', created_at: '2026-09-29T10:00:00Z', ...nullMetrics })
    await useInbodyStore.getState().addReport(nullMetrics)
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ body_fat_pct: null, muscle_mass_kg: null, bmr: null }))
    expect(useInbodyStore.getState().latest?.id).toBe('r1')
  })

  it('sets error on failed insert and returns null', async () => {
    mockInsert(null, { message: 'insert failed' })
    const result = await useInbodyStore.getState().addReport(nullMetrics)
    expect(result).toBeNull()
    expect(useInbodyStore.getState().error).toBe('insert failed')
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

Run: `npx jest __tests__/stores/inbodyStore.test.ts`
Expected: FAIL — cannot find module `stores/inbodyStore`.

- [ ] **Step 7: Implement the inbody store**

`stores/inbodyStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { InBodyReport } from '../types'

type InBodyInsert = Database['public']['Tables']['inbody_reports']['Insert']

export interface NewInBodyReport {
  user_id: string
  photo_url: string // storage PATH in inbody-photos
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  raw_extracted_json: Record<string, unknown> | null
  ai_notes: string | null
}

interface InbodyState {
  reports: InBodyReport[]
  latest: InBodyReport | null
  loading: boolean
  error: string | null
  fetchReports: (userId: string) => Promise<void>
  addReport: (report: NewInBodyReport) => Promise<InBodyReport | null>
}

export const useInbodyStore = create<InbodyState>()(
  immer((set) => ({
    reports: [],
    latest: null,
    loading: false,
    error: null,

    fetchReports: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('inbody_reports')
        .select('*')
        .eq('user_id', userId)
        .order('scanned_at', { ascending: false })
      set((s) => {
        s.loading = false
        const rows = error ? [] : (data as InBodyReport[])
        s.reports = rows
        s.latest = rows[0] ?? null
        s.error = error?.message ?? null
      })
    },

    addReport: async (report) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('inbody_reports')
        .insert(report as unknown as InBodyInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) {
          s.reports.unshift(data as InBodyReport)
          s.latest = data as InBodyReport
        }
        s.error = error?.message ?? null
      })
      return error ? null : (data as InBodyReport)
    },
  }))
)
```

- [ ] **Step 8: Run store test to confirm it passes**

Run: `npx jest __tests__/stores/inbodyStore.test.ts`
Expected: PASS.

- [ ] **Step 9: Build the capture component** (Review Focus #4 — surfaces upload errors; returns the PATH)

`components/inbody/InBodyPhotoCapture.tsx`:
```typescript
import { useState } from 'react'
import { View, Pressable, Image, ActivityIndicator, Text } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  onUploaded: (path: string) => void
}

export function InBodyPhotoCapture({ onUploaded }: Props) {
  const { user } = useAuthStore()
  const [uri, setUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return
    setUri(asset.uri)
    setUploading(true)
    setUploadError(null)
    // Private bucket: store the PATH; the analysis fn and reads sign it server-side.
    const path = `${user.id}/${Date.now()}.jpg`
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = decode(base64)
    const { error } = await supabase.storage
      .from('inbody-photos')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false })
    setUploading(false)
    if (error) { setUploadError(error.message); return }
    onUploaded(path)
  }

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (!result.canceled) await upload(result.assets[0])
  }
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (!result.canceled) await upload(result.assets[0])
  }

  if (uploading) return <ActivityIndicator className="my-4" />

  return (
    <View>
      <View className="border-2 border-dashed border-gray-300 rounded-xl h-40 items-center justify-center mb-3 overflow-hidden">
        {uri ? <Image source={{ uri }} className="w-full h-full" resizeMode="contain" /> : <Text className="text-gray-400">No scan selected</Text>}
      </View>
      <View className="flex-row gap-2 mb-2">
        <Pressable onPress={takePhoto} className="flex-1 bg-green-600 rounded-lg py-3 items-center"><Text className="text-white font-semibold">Take photo</Text></Pressable>
        <Pressable onPress={pickPhoto} className="flex-1 bg-white border border-gray-300 rounded-lg py-3 items-center"><Text className="text-gray-700 font-semibold">Choose from gallery</Text></Pressable>
      </View>
      {uploadError && <Text className="text-red-500 text-xs mb-2">{uploadError}</Text>}
    </View>
  )
}
```

- [ ] **Step 10: Build the InBody screen** (capture → analyze → confirm/edit → save; composes tested store/API, no dedicated screen test)

`app/inbody.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { InBodyPhotoCapture } from '../components/inbody/InBodyPhotoCapture'
import { analyzeInBodyPhoto, InBodyAnalysisResult } from '../lib/api/inbody'

const numOrEmpty = (v: number | null) => (v === null ? '' : String(v))
const parseOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export default function InBodyScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { reports, fetchReports, addReport, loading, error } = useInbodyStore()

  const [path, setPath] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<InBodyAnalysisResult | null>(null)
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [muscle, setMuscle] = useState('')
  const [visceral, setVisceral] = useState('')
  const [bmr, setBmr] = useState('')

  useEffect(() => { if (user) fetchReports(user.id) }, [user])

  const onUploaded = async (uploadedPath: string) => {
    setPath(uploadedPath)
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const result = await analyzeInBodyPhoto(uploadedPath)
      setAnalysis(result)
      setWeight(numOrEmpty(result.weight_kg))
      setBodyFat(numOrEmpty(result.body_fat_pct))
      setMuscle(numOrEmpty(result.muscle_mass_kg))
      setVisceral(numOrEmpty(result.visceral_fat))
      setBmr(numOrEmpty(result.bmr))
    } catch (e) {
      setAnalyzeError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!user || !path) return
    const result = await addReport({
      user_id: user.id,
      photo_url: path,
      weight_kg: parseOrNull(weight),
      body_fat_pct: parseOrNull(bodyFat),
      muscle_mass_kg: parseOrNull(muscle),
      visceral_fat: parseOrNull(visceral),
      bmr: parseOrNull(bmr) === null ? null : Math.round(parseOrNull(bmr) as number),
      raw_extracted_json: analysis?.raw ?? null,
      ai_notes: analysis?.notes ?? null,
    })
    if (result) {
      setPath(null); setAnalysis(null)
      setWeight(''); setBodyFat(''); setMuscle(''); setVisceral(''); setBmr('')
    }
  }

  const metricFields: { label: string; value: string; setter: (v: string) => void }[] = [
    { label: 'Weight (kg)', value: weight, setter: setWeight },
    { label: 'Body fat (%)', value: bodyFat, setter: setBodyFat },
    { label: 'Muscle mass (kg)', value: muscle, setter: setMuscle },
    { label: 'Visceral fat', value: visceral, setter: setVisceral },
    { label: 'BMR (kcal)', value: bmr, setter: setBmr },
  ]

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">InBody scan</Text>
      </View>

      <View className="px-6 pt-4">
        <InBodyPhotoCapture onUploaded={onUploaded} />
        {analyzing && <ActivityIndicator className="my-4" color="#16a34a" />}
        {analyzeError && <Text className="text-red-500 mb-2">{analyzeError}</Text>}
        {error && <Text className="text-red-500 mb-2">{error}</Text>}

        {analysis && (
          <View className="mt-2">
            <Text className="text-gray-500 text-sm mb-3">Review the extracted values. Blank fields could not be read from the photo — leave them blank rather than guessing.</Text>
            {metricFields.map(({ label, value, setter }) => (
              <View key={label} className="mb-4">
                <Text className="text-gray-600 mb-1">{label}</Text>
                <TextInput className="border border-gray-300 rounded-lg px-4 py-3" keyboardType="decimal-pad" value={value} onChangeText={setter} placeholder="Not read" />
              </View>
            ))}
            <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-6" onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Save scan</Text>}
            </Pressable>
          </View>
        )}

        <Text className="font-semibold text-gray-700 mb-3">Past scans</Text>
        {reports.length === 0
          ? <Text className="text-gray-400 text-center py-8">No scans yet</Text>
          : reports.map((r) => (
            <View key={r.id} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <Text className="text-xs text-gray-400 mb-1">{new Date(r.scanned_at).toLocaleDateString()}</Text>
              <View className="flex-row flex-wrap gap-x-4">
                <Text className="text-sm text-gray-700">Wt: {r.weight_kg ?? '—'} kg</Text>
                <Text className="text-sm text-gray-700">BF: {r.body_fat_pct ?? '—'}%</Text>
                <Text className="text-sm text-gray-700">Muscle: {r.muscle_mass_kg ?? '—'} kg</Text>
              </View>
              {r.ai_notes ? <Text className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">{r.ai_notes}</Text> : null}
            </View>
          ))}
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 11: Typecheck + run new tests**

Run: `npx tsc --noEmit && npx jest __tests__/stores/inbodyStore.test.ts __tests__/lib/inbody.test.ts`
Expected: tsc exit 0; both suites PASS.

- [ ] **Step 12: Commit**

```bash
git add stores/inbodyStore.ts lib/api/inbody.ts components/inbody/ app/inbody.tsx __tests__/stores/inbodyStore.test.ts __tests__/lib/inbody.test.ts
git commit -m "feat: InBody scan capture, AI extraction, confirm-and-save (stores PATH, nulls preserved)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: InBody timeline charts — `LineChart` + Body/Progress screen

**Files:**
- Create: `lib/utils/chart.ts`
- Create: `components/ui/LineChart.tsx`
- Create: `app/progress.tsx`
- Create: `__tests__/lib/chart.test.ts`

**Interfaces:**
- Consumes: `react-native-svg` (installed); `useInbodyStore` (Task 4); `InBodyReport` from `types`.
- Produces: `scalePoints(values: number[], width: number, height: number, padding?: number): { x: number; y: number }[]` from `lib/utils/chart.ts`.
- Produces: `LineChart` — `{ data: { label: string; value: number }[]; color: string; width?: number; height?: number }`.

- [ ] **Step 1: Write failing chart-math test** (Review Focus #3 — empty/single/all-equal)

`__tests__/lib/chart.test.ts`:
```typescript
import { scalePoints } from '../../lib/utils/chart'

describe('scalePoints', () => {
  it('returns [] for no values', () => {
    expect(scalePoints([], 100, 100)).toEqual([])
  })

  it('centers a single value', () => {
    const pts = scalePoints([5], 100, 100, 8)
    expect(pts).toHaveLength(1)
    expect(pts[0].x).toBe(50) // 8 + (100-16)/2
    expect(pts[0].y).toBe(50) // all-equal -> vertical mid
  })

  it('places min at the bottom and max at the top', () => {
    const pts = scalePoints([0, 10], 100, 100, 8)
    expect(pts[0]).toEqual({ x: 8, y: 92 })  // min -> bottom
    expect(pts[1]).toEqual({ x: 92, y: 8 })  // max -> top
  })

  it('draws a flat mid-line when all values are equal', () => {
    const pts = scalePoints([5, 5, 5], 100, 100, 8)
    expect(pts.every((p) => p.y === 50)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest __tests__/lib/chart.test.ts`
Expected: FAIL — cannot find module `lib/utils/chart`.

- [ ] **Step 3: Implement chart math**

`lib/utils/chart.ts`:
```typescript
export interface ChartPoint {
  x: number
  y: number
}

// Map a series of values to SVG coordinates. Y is inverted (max at top).
// Guards the degenerate cases so a 0- or 1-point series never divides by zero.
export function scalePoints(values: number[], width: number, height: number, padding = 8): ChartPoint[] {
  const n = values.length
  if (n === 0) return []
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return values.map((v, i) => {
    const x = n === 1 ? padding + innerW / 2 : padding + (i / (n - 1)) * innerW
    const y = range === 0 ? padding + innerH / 2 : padding + innerH - ((v - min) / range) * innerH
    return { x, y }
  })
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest __tests__/lib/chart.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the LineChart component** (uses the same `react-native-svg` import style as `ProgressRing`)

`components/ui/LineChart.tsx`:
```typescript
import { View, Text } from 'react-native'
import Svg, { Polyline, Circle, Line } from 'react-native-svg'
import { scalePoints } from '../../lib/utils/chart'

interface Props {
  data: { label: string; value: number }[]
  color: string
  width?: number
  height?: number
}

export function LineChart({ data, color, width = 300, height = 140 }: Props) {
  if (data.length < 2) {
    return <Text className="text-gray-400 text-center py-6">Need at least 2 scans to chart this.</Text>
  }
  const points = scalePoints(data.map((d) => d.value), width, height)
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const min = Math.min(...data.map((d) => d.value))
  const max = Math.max(...data.map((d) => d.value))

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={8} y1={height - 8} x2={width - 8} y2={height - 8} stroke="#e5e7eb" strokeWidth={1} />
        <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
      </Svg>
      <View className="flex-row justify-between px-1">
        <Text className="text-[10px] text-gray-400">{min}</Text>
        <Text className="text-[10px] text-gray-400">{max}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 6: Build the Body/Progress screen** (Review Focus #3 — empty state <2 scans; composes tested store/util, no dedicated screen test)

`app/progress.tsx`:
```typescript
import { useEffect } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { LineChart } from '../components/ui/LineChart'
import { InBodyReport } from '../types'

// Oldest-first series of a single metric, dropping scans where it was not read.
function series(reports: InBodyReport[], key: 'weight_kg' | 'body_fat_pct' | 'muscle_mass_kg') {
  return [...reports]
    .sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime())
    .filter((r) => r[key] !== null)
    .map((r) => ({ label: new Date(r.scanned_at).toLocaleDateString(), value: r[key] as number }))
}

export default function ProgressScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { reports, fetchReports, loading, error } = useInbodyStore()

  useEffect(() => { if (user) fetchReports(user.id) }, [user])

  const charts: { title: string; color: string; data: { label: string; value: number }[] }[] = [
    { title: 'Weight (kg)', color: '#16a34a', data: series(reports, 'weight_kg') },
    { title: 'Body fat (%)', color: '#dc2626', data: series(reports, 'body_fat_pct') },
    { title: 'Muscle mass (kg)', color: '#2563eb', data: series(reports, 'muscle_mass_kg') },
  ]

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">Body progress</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}
      {loading && <ActivityIndicator className="mt-8" color="#16a34a" />}

      {!loading && reports.length < 2 ? (
        <View className="flex-1 items-center justify-center px-8 py-20">
          <Text className="text-gray-400 text-center">Add at least 2 InBody scans to see your trends over time.</Text>
          <Pressable className="bg-green-600 rounded-lg py-3 px-6 mt-4" onPress={() => router.push('/inbody')}>
            <Text className="text-white font-semibold">Add a scan</Text>
          </Pressable>
        </View>
      ) : (
        <View className="px-6 pt-4">
          {charts.map((c) => (
            <View key={c.title} className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
              <Text className="font-semibold text-gray-700 mb-2">{c.title}</Text>
              <LineChart data={c.data} color={c.color} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
```

- [ ] **Step 7: Typecheck + run chart tests**

Run: `npx tsc --noEmit && npx jest __tests__/lib/chart.test.ts`
Expected: tsc exit 0; suite PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/utils/chart.ts components/ui/LineChart.tsx app/progress.tsx __tests__/lib/chart.test.ts
git commit -m "feat: InBody timeline charts (react-native-svg LineChart + Body/Progress screen)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Agent upgrade — `log_activity`, `get_inbody_history`, `adjust_diet_plan` + context + coaching prompt

**Files:**
- Modify: `supabase/functions/ai-agent/tools.ts`
- Modify: `supabase/functions/ai-agent/context.ts`
- Modify: `supabase/functions/ai-agent/index.ts`

**Interfaces:**
- Consumes: service-role `SupabaseClient`; `inbody_reports`, `activity_logs`, `goals` tables.
- Produces (tool contracts): `log_activity(activity_type, duration_min?, steps?, calories_burned?, notes?)`; `get_inbody_history(limit?)`; `adjust_diet_plan(notes, daily_calorie_target?, daily_protein_g?, daily_carbs_g?, daily_fat_g?, daily_steps_target?, target_weight_kg?)` — **inserts a new goals row**.
- Produces (context): appends `Latest InBody scan:` and `Recent activity (today):` to the assembled context string.

- [ ] **Step 1: Add the three tool definitions** to the `TOOL_DEFINITIONS` array in `supabase/functions/ai-agent/tools.ts` (insert after the existing `update_goals` entry, before the closing `]`)

```typescript
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log a physical activity the user did (walk, run, gym, cycle, swim, yoga, other) with optional duration, steps, and calories burned.',
      parameters: {
        type: 'object',
        properties: {
          activity_type: { type: 'string', enum: ['walk', 'run', 'gym', 'cycle', 'swim', 'yoga', 'other'] },
          duration_min: { type: 'number' },
          steps: { type: 'number' },
          calories_burned: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['activity_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inbody_history',
      description: "Get the user's InBody body-composition scans over time (weight, body fat %, muscle mass, visceral fat, BMR), most recent first.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Max scans to return, default 10' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_diet_plan',
      description: "Adjust the user's nutrition/step targets based on their progress and latest InBody results. Inserts a NEW goals row (goals are append-only; latest wins). Provide only the fields you want to change; unspecified fields carry over from the current goals. Always include a short rationale in notes.",
      parameters: {
        type: 'object',
        properties: {
          daily_calorie_target: { type: 'number' },
          daily_protein_g: { type: 'number' },
          daily_carbs_g: { type: 'number' },
          daily_fat_g: { type: 'number' },
          daily_steps_target: { type: 'number' },
          target_weight_kg: { type: 'number' },
          notes: { type: 'string', description: 'Short rationale for the adjustment' },
        },
        required: ['notes'],
      },
    },
  },
```

- [ ] **Step 2: Add the three executors** in `executeTool` in `supabase/functions/ai-agent/tools.ts` (insert before the final `return \`Unknown tool: ${name}\``)

```typescript
  if (name === 'log_activity') {
    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId,
      activity_type: input.activity_type,
      duration_min: input.duration_min ?? 0,
      steps: input.steps ?? 0,
      calories_burned: input.calories_burned ?? 0,
      notes: input.notes ?? '',
      logged_at: new Date().toISOString(),
    })
    if (error) return `Error logging activity: ${error.message}`
    return `Activity logged: ${input.activity_type}${input.duration_min ? `, ${input.duration_min} min` : ''}${input.steps ? `, ${input.steps} steps` : ''}${input.calories_burned ? `, ${input.calories_burned} kcal` : ''}`
  }

  if (name === 'get_inbody_history') {
    const limit = typeof input.limit === 'number' ? input.limit : 10
    const { data, error } = await supabase
      .from('inbody_reports')
      .select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, bmr, ai_notes')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit)
    if (error) return `Error reading InBody history: ${error.message}`
    if (!data || data.length === 0) return 'No InBody scans on record yet.'
    return JSON.stringify(data)
  }

  if (name === 'adjust_diet_plan') {
    const { data: existing } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!existing) return 'No existing goals to adjust. The user should set goals in onboarding first.'
    const { notes, ...changes } = input
    // Goals are append-only / latest-wins: INSERT a new row, never mutate the old one.
    const { id: _id, created_at: _createdAt, ...carryOver } = existing
    const { error } = await supabase.from('goals').insert({
      ...carryOver,
      ...changes,
      notes: typeof notes === 'string' ? notes : (carryOver.notes ?? ''),
      user_id: userId,
    })
    if (error) return `Error adjusting diet plan: ${error.message}`
    return `Diet plan adjusted; new targets saved as a new goals row. Rationale: ${notes ?? ''}`
  }
```

- [ ] **Step 3: Extend the context assembler** in `supabase/functions/ai-agent/context.ts`

Replace the `Promise.all` destructuring and array with:
```typescript
  const [profileRes, goalsRes, mealsRes, historyRes, inbodyRes, activityRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meals').select('*').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`),
    supabase.from('daily_summaries').select('date, total_calories_consumed, ai_coach_note').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('inbody_reports').select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, bmr, ai_notes').eq('user_id', userId).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('activity_logs').select('activity_type, duration_min, steps, calories_burned').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`),
  ])
```
Then replace the returned template literal with:
```typescript
  return `
## User Health Context
Today's date: ${today}
Profile: ${JSON.stringify(profileRes.data)}
Current Goals: ${JSON.stringify(goalsRes.data)}
Today's meals: ${JSON.stringify(mealsRes.data)}
Today's calories so far: ${todayCalories} kcal
Latest InBody scan: ${JSON.stringify(inbodyRes.data)}
Recent activity (today): ${JSON.stringify(activityRes.data)}
Last 7 days summaries: ${JSON.stringify(historyRes.data)}
`.trim()
```

- [ ] **Step 4: Add coaching principles + wire them into the system prompt** in `supabase/functions/ai-agent/index.ts`

After the `const MODEL = 'gpt-4o'` line, add:
```typescript
// Coaching principles adapted (content only, not its file-storage mechanics) from the
// MIT-licensed NataMoroz/nutrition-coach skill: https://github.com/NataMoroz/nutrition-coach
const COACHING_PRINCIPLES = `
Coaching principles (apply when advising or adjusting the plan):
- Protein first: prioritise hitting the daily protein target — it preserves lean mass in a deficit and drives recovery. Never cut protein to make calories fit.
- Moderate deficit over aggressive: prefer a sustainable ~10-20% calorie deficit for fat loss; aggressive deficits cost muscle and adherence.
- Carbs are training fuel: keep carbohydrates around training days; do not fear them when the user is active.
- Peri-workout fueling: suggest carbs + protein before and after workouts for performance and recovery.
- Scale-weight is noisy: daily weight swings are water, glycogen, and gut content. Judge trends over 1-2 weeks and cross-check against InBody body-fat and muscle-mass trends, not single readings.
- Sex-based and female-physiology nuance: for women, expect cycle-phase water shifts; do NOT push an aggressive deficit while breastfeeding (protect milk supply — keep adequate calories and fluids); prioritise postpartum recovery over fat loss; keep iron/ferritin and bone-density (calcium, vitamin D) awareness.
- Safety floors: never recommend calories below a safe floor (~1200 kcal/day for women, ~1500 kcal/day for men) and never below the user's protein target. If the math would breach a floor, extend the timeline instead.
`.trim()
```
Then change the system message content from:
```typescript
        content: `You are Poshan AI, a warm, encouraging personal health coach. You have full access to the user's health data below. Be concise, practical, and specific. When the user tells you what they ate, estimate macros and log the meal with the log_meal tool. Use tools to read goals and daily summaries when relevant.\n\n${systemContext}`,
```
to:
```typescript
        content: `You are Poshan AI, a warm, encouraging personal health coach. You have full access to the user's health data below. Be concise, practical, and specific. When the user tells you what they ate, estimate macros and log the meal with the log_meal tool. When they describe a workout, log it with log_activity. Use get_inbody_history and daily summaries to judge progress, and use adjust_diet_plan (which appends a new goals row) when results warrant a change.\n\n${COACHING_PRINCIPLES}\n\n${systemContext}`,
```

- [ ] **Step 5: CONTROLLER — redeploy `ai-agent` via Supabase MCP**

Implementer cannot deploy. Controller runs `mcp__supabase__deploy_edge_function` on `ggjrtgowmauoimpvficl` with slug `ai-agent`, `verify_jwt: true`, and all three files (`index.ts`, `tools.ts`, `context.ts`); records it in the ledger.

- [ ] **Step 6: CONTROLLER — smoke test `adjust_diet_plan` inserts (Review Focus #5)**

Note the current goals count for the test user:
```sql
-- via mcp__supabase__execute_sql on ggjrtgowmauoimpvficl
select count(*) as n from goals where user_id = '<TEST_USER_ID>';
```
Then send a chat message that triggers an adjustment:
```bash
curl -X POST https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/ai-agent \
  -H "Authorization: Bearer <TEST_USER_JWT>" -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"message":"My body fat went up. Please lower my daily calories by 200 and bump protein by 20g."}'
```
Re-run the count query. Expected: `n` increased by **exactly 1**, and the newest row (`order by created_at desc limit 1`) holds the new `daily_calorie_target`/`daily_protein_g` — confirming an insert, not an update.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ai-agent/
git commit -m "feat: agent gains log_activity, get_inbody_history, adjust_diet_plan + InBody/activity context + coaching principles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Navigation wiring + dashboard quick-actions

**Files:**
- Modify: `app/_layout.tsx` (root `Slot` → `Stack` so root stack screens render with a back stack)
- Modify: `app/(tabs)/index.tsx` (quick-actions: Log Activity, Add InBody, Body Progress)

**Interfaces:**
- Consumes: routes `app/inbody.tsx`, `app/activity.tsx`, `app/progress.tsx` (Tasks 3-5).
- Produces: root stack navigator; dashboard quick-action buttons that `router.push('/activity' | '/inbody' | '/progress')`.

> The 4-tab bar is untouched (still Home / Meals / Chat / Settings). InBody, Activity, and Progress render as root-level stack screens; a `Stack` at the root auto-registers those sibling route files and gives them a proper back stack, while each screen renders its own header + Back control (consistent with the Phase 1 self-headers).

- [ ] **Step 1: Convert the root layout from `Slot` to `Stack`** in `app/_layout.tsx`

Change the import on line 3 from:
```typescript
import { Slot, useRouter, useSegments } from 'expo-router'
```
to:
```typescript
import { Stack, useRouter, useSegments } from 'expo-router'
```
Replace the `<Slot />` in the returned JSX with:
```typescript
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="inbody" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="progress" />
        </Stack>
```
(The auth-gate `useEffect`s using `useSegments`/`router.replace` are unchanged; `segments[0]` still resolves for the group routes.)

- [ ] **Step 2: Add the quick-actions row to the dashboard** in `app/(tabs)/index.tsx`

Directly after the existing quick-actions `View` (the one containing the `Log Meal` / `Ask Coach` buttons), add a second row:
```typescript
      <View className="flex-row px-4 gap-3 mb-4">
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/activity')}>
          <Text className="text-gray-700 font-semibold">Log Activity</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/inbody')}>
          <Text className="text-gray-700 font-semibold">Add InBody</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/progress')}>
          <Text className="text-gray-700 font-semibold">Progress</Text>
        </Pressable>
      </View>
```

- [ ] **Step 3: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc exit 0; **all** suites pass (auth, profile, meals, chat, daily-summary, macros, activity, inbody, chart, inbody-api).

- [ ] **Step 4: Verify navigation on device**

Run on Android. From Home, tap Log Activity → log a walk with 5000 steps → back to Home → confirm the Steps ring shows 5000. Tap Add InBody → capture/pick a scan photo → confirm metrics populate (unreadable ones blank) → Save → confirm it appears under Past scans. Add a second scan, then tap Progress → confirm the three line charts render; with <2 scans confirm the empty state shows instead.

- [ ] **Step 5: expo-doctor**

Run: `npx expo-doctor`
Expected: 21/21 checks pass.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx app/(tabs)/index.tsx
git commit -m "feat: register InBody/Activity/Progress stack screens and add dashboard quick-actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 Complete

Delivers:
- `inbody_reports` + `activity_logs` tables (RLS) and a private `inbody-photos` bucket with per-user-folder policies.
- `ai-inbody-analysis` edge function (gpt-4o vision) that returns `null` for unreadable metrics.
- Manual activity logging (store + screen) and a live dashboard steps ring.
- InBody capture → AI extraction → confirm/edit → save (stores the storage PATH, signs on read).
- Body/Progress timeline charts (weight, body-fat %, muscle mass) built on `react-native-svg`, with a <2-scan empty state.
- An upgraded coach: `log_activity`, `get_inbody_history`, `adjust_diet_plan` (append-only goals), InBody + activity context, and vetted coaching principles.
- InBody / Activity / Progress reachable from Home via stack screens; the 4-tab bar unchanged.

**Next:** Phase 2b — Health Connect (Amazfit/Zepp) auto-sync; Phase 3 — plan generation, morning coach cron, analytics.
