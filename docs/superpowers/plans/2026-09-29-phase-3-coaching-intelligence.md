# Phase 3: Coaching Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the coach proactive — a daily morning coach note + AI daily goals (pg_cron + lazy fallback), AI-generated weekly meal and workout plans, a calorie-adherence analytics chart, and an in-context meal-suggestion capability.

**Architecture:** Extends Phases 1 & 2 (React Native + Expo Router + Supabase). Two new append-only tables (`meal_plans`, `workout_plans`) with RLS. One new Deno Edge Function (`generate-daily-summary`, gpt-4o) runs in two modes — a `pg_cron` batch (service-role, all profiles) and a client "lazy" mode (JWT, current user) — writing `ai_daily_goals` + `ai_coach_note` into the existing `daily_summaries` table by idempotent upsert on `(user_id, date)`. The existing `ai-agent` gains four tools (`generate_meal_plan`, `generate_workout_plan`, `get_progress_report`, `get_meal_suggestion`); the model supplies the full `plan_json` as tool args (no nested LLM call). The client gets a `plansStore`, a new **Plans** bottom tab (5 tabs total), a dashboard coach-note + lazy-fallback + low-fuel card, and a calorie-adherence `BarChart` added to the existing `app/progress.tsx`.

**Tech Stack:** React Native, Expo SDK 52+, Expo Router v4, TypeScript (strict), NativeWind v4, Zustand v5 + immer, Supabase JS v2, Supabase Edge Functions (Deno, OpenAI `gpt-4o`), `pg_cron` + `pg_net` + Supabase Vault, `react-native-svg`, Jest + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-3-coaching-intelligence-design.md`

**Prerequisite:** Phase 2 complete, all tests green (`npx tsc --noEmit` clean, `npx jest` all pass).

## Global Constraints

Carry every Phase 1 & 2 constraint, plus the following (copied verbatim from the spec):

- **Morning coach note = pg_cron (6am) + lazy fallback.** A `pg_cron` job invokes `generate-daily-summary` daily; if the cron did not run (or today's row lacks `ai_coach_note`), the client lazily invokes it for the current user on app open. Both paths hit the same function.
- **Plans get a new bottom tab** → tabs become **Home / Meals / Plans / Chat / Settings** (5). This intentionally supersedes the Phase-2 "keep 4 tabs" guideline.
- **Charts stay `react-native-svg`, hand-built.** Reuse the Phase-2 `LineChart`; ADD a `BarChart` for calorie adherence. **Do NOT add `victory-native`** — no charting library. The analytics view EXTENDS the existing `app/progress.tsx` (do not create a second progress screen/tab).
- **Goals AND plans remain append-only / latest-wins.** Any goal or plan write inserts a new row; reads take the most-recent by `created_at` (goals) or the latest `meal_plans`/`workout_plans` row.
- **Edge functions:** `verify_jwt: true`, OpenAI `gpt-4o`, user from JWT (`authClient.auth.getUser()`); never trust a body `user_id`. CORS + `OPTIONS`. Path-ownership 403 check where signing storage.
- **`generate-daily-summary` two modes:** cron mode (header `x-cron-secret` matches the `CRON_SECRET` function secret → service-role client, loop all `profiles`) and user/lazy mode (JWT → current user only). `401` if neither a valid cron secret nor a valid user JWT is present. Idempotent upsert into `daily_summaries` on `(user_id, date)`; safe to re-run per day.
- **Agent `generate_meal_plan` / `generate_workout_plan`:** the MODEL supplies the full `plan_json` as tool args (like `log_meal` supplies macros — NO nested LLM call in the executor); the executor persists a new `meal_plans` / `workout_plans` row. Plans-screen "Regenerate" reuses `ai-agent` with a directive message, then refetches.
- **No new npm dependency** is required (`react-native-svg`, `expo-*` all present).
- TypeScript strict mode — no `any`; typed Supabase client, **no read-site `as unknown as`**; narrow `as unknown as <Insert>` only at write sites; read-site `as X[]` is OK (mealsStore precedent).
- Zustand v5 with `immer`. Every store action that touches Supabase captures `{ data, error }`, sets `error = error?.message ?? null`, and toggles `loading`. Every screen renders its store `error`.
- All new tables have RLS: `auth.uid() = user_id` (using + with check). The cron secret never ships in client code; no client-side AI keys.
- **Schema + edge deploys are split:** the **implementer** authors the migration SQL files and edge-function source and cannot run Supabase MCP. The **controller** applies migrations via Supabase MCP to remote project `ggjrtgowmauoimpvficl`, enables `pg_cron` + `pg_net`, stores the Vault secrets, sets the `CRON_SECRET` function secret, schedules the cron, regenerates `lib/database.types.ts`, deploys/redeploys functions, and smoke-tests — recording each in the execution ledger (as in Phase 2 Tasks 1/2/6).
- Quality gates per task: `npx tsc --noEmit` clean **and** `npx jest` all pass. TDD for stores and pure utils. Screens that only compose already-tested store actions do not need dedicated tests (noted per task). `npx expo-doctor` 21/21 before shipping.

## Review Focus

These are the failure classes the spec implies but that could slip through; each is pinned to a test/verification in the owning task.

1. **Cron-secret auth bypass.** A request with no `x-cron-secret` and no valid user JWT must `401`; a request whose `x-cron-secret` is wrong or empty must NOT enter cron mode (must not loop all profiles) — and cron mode must be impossible when `CRON_SECRET` is unset. → Task 2, controller smoke test: no auth → 401; wrong secret + service-role bearer → 401 (falls to user mode, `getUser()` yields no user); correct secret → `{ ok: true, generated: n }`.
2. **Coach-note idempotency / duplicate rows.** Running `generate-daily-summary` twice in one day must regenerate the note on the SAME `(user_id, date)` row (upsert), never insert a second row, and must NOT zero out today's meal totals already on the row. → Task 2, controller smoke test: invoke twice; `select count(*) from daily_summaries where user_id=… and date=today` stays 1 and `total_calories_consumed` is unchanged.
3. **Lazy fallback firing repeatedly.** The dashboard must call the lazy generate at most once per session/day: once attempted today it must not fire again even while `ai_coach_note` is still null. → Task 3, `shouldGenerateCoachNote` test (null note + not-attempted → true; null note + attempted-today → false; note present → false).
4. **`plan_json` malformed from the model.** A plan whose `plan_json` is missing/`null`/non-`{days:[…]}` must not crash the Plans screen — it renders an empty/needs-regenerate state; and the executor must refuse to persist a malformed plan. → Task 5, `planDays` test (null → `[]`, `{}` → `[]`, `{days:[…]}` → array); Task 4, controller smoke test asserts the executor returns an error and inserts no row for a malformed `plan` arg.
5. **Adherence bar with missing days / divide-by-zero.** A day with no `ai_daily_goals` (target 0) or an empty range must produce `pct = 0` (never `NaN`/`Infinity`) and an empty series must render an empty state, not a crashed chart. → Task 6, `adherenceSeries` test (empty → `[]`; `ai_daily_goals` null → `target 0, pct 0`; target 0 → `pct 0`; normal → correct pct) + `BarChart` renders an empty state for `[]`.

---

## File Structure

```
poshan-ai/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx                   # MODIFY: add Plans tab (5 tabs, order Home/Meals/Plans/Chat/Settings)
│   │   ├── index.tsx                     # MODIFY: coach-note lazy fallback (once/session) + low-fuel card
│   │   └── plans.tsx                     # NEW: meal + workout plan display + Regenerate
│   └── progress.tsx                      # MODIFY: add calorie-adherence BarChart section
├── components/
│   └── ui/
│       └── BarChart.tsx                  # NEW: react-native-svg bar chart
├── lib/
│   ├── api/
│   │   └── dailySummary.ts               # NEW: calls generate-daily-summary (user/lazy mode)
│   └── utils/
│       ├── chart.ts                      # MODIFY: append adherenceSeries + AdherenceBar
│       ├── coachNote.ts                  # NEW: shouldGenerateCoachNote / shouldShowLowFuelPrompt
│       └── plan.ts                       # NEW: planDays (defensive plan_json reader)
├── stores/
│   ├── dailySummaryStore.ts             # MODIFY: add recent + fetchRecent
│   └── plansStore.ts                    # NEW
├── types/
│   └── index.ts                         # MODIFY: MealPlan/WorkoutPlan + plan_json shapes
├── supabase/
│   ├── migrations/
│   │   ├── 20260929020000_phase3_coaching_intelligence.sql   # NEW: meal_plans + workout_plans + RLS
│   │   └── 20260929030000_phase3_daily_coach_cron.sql        # NEW: pg_cron schedule (applied after fn deploy)
│   └── functions/
│       ├── generate-daily-summary/index.ts   # NEW: cron + user modes, gpt-4o, idempotent upsert
│       └── ai-agent/
│           ├── tools.ts                 # MODIFY: 4 new tools + executors
│           └── context.ts              # MODIFY: latest plan week_start context
└── __tests__/
    ├── stores/
    │   ├── dailySummaryStore.test.ts    # MODIFY: add fetchRecent tests
    │   └── plansStore.test.ts           # NEW
    └── lib/
        ├── chart.test.ts               # MODIFY: add adherenceSeries tests
        ├── coachNote.test.ts           # NEW
        └── plan.test.ts                # NEW
```

---

### Task 1: Schema — `meal_plans` + `workout_plans` tables + plan TypeScript types

**Files:**
- Create: `supabase/migrations/20260929020000_phase3_coaching_intelligence.sql`
- Modify: `types/index.ts` (append plan types)
- Regenerated by controller: `lib/database.types.ts`

**Interfaces:**
- Consumes: nothing (first task); `MealType` already exported from `types/index.ts`.
- Produces (DB): tables `meal_plans`, `workout_plans` (RLS on), both append-only / latest-wins.
- Produces (TS): `MealPlanMeal`, `MealPlanDay`, `MealPlanJson`, `MealPlan`, `WorkoutExercise`, `WorkoutPlanDay`, `WorkoutPlanJson`, `WorkoutPlan` in `types/index.ts`; regenerated `Database['public']['Tables']['meal_plans']` and `['workout_plans']` in `lib/database.types.ts`.

- [ ] **Step 1: Author the migration SQL**

`supabase/migrations/20260929020000_phase3_coaching_intelligence.sql`:
```sql
-- Phase 3: coaching intelligence — weekly meal_plans + workout_plans.
-- uuid-ossp is already enabled by the Phase 1 migration.
-- Both tables are APPEND-ONLY / latest-wins: a regenerate inserts a new row;
-- reads take the most recent row per user (order by created_at desc, limit 1).

-- AI-generated weekly meal plans.
create table meal_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start_date date not null,
  plan_json jsonb not null,   -- { days: [ { day, meals: [ { meal_type, description, calories, protein_g, carbs_g, fat_g } ] } ] }
  created_at timestamptz not null default now()
);
alter table meal_plans enable row level security;
create policy "Users manage own meal plans" on meal_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index meal_plans_user_created_idx on meal_plans (user_id, created_at desc);

-- AI-generated weekly workout plans.
create table workout_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start_date date not null,
  plan_json jsonb not null,   -- { days: [ { day, focus, exercises: [ { name, sets, reps, notes } ] } ] }
  created_at timestamptz not null default now()
);
alter table workout_plans enable row level security;
create policy "Users manage own workout plans" on workout_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index workout_plans_user_created_idx on workout_plans (user_id, created_at desc);
```

- [ ] **Step 2: Append plan types** to `types/index.ts` (add at the end; do not touch existing exports; `MealType` is already exported above)

```typescript
export interface MealPlanMeal {
  meal_type: MealType
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealPlanDay {
  day: string
  meals: MealPlanMeal[]
}

export interface MealPlanJson {
  days: MealPlanDay[]
}

export interface MealPlan {
  id: string
  user_id: string
  week_start_date: string
  plan_json: MealPlanJson
  created_at: string
}

export interface WorkoutExercise {
  name: string
  sets: number
  reps: string
  notes: string
}

export interface WorkoutPlanDay {
  day: string
  focus: string
  exercises: WorkoutExercise[]
}

export interface WorkoutPlanJson {
  days: WorkoutPlanDay[]
}

export interface WorkoutPlan {
  id: string
  user_id: string
  week_start_date: string
  plan_json: WorkoutPlanJson
  created_at: string
}
```

- [ ] **Step 3: CONTROLLER — apply migration + regenerate types via Supabase MCP**

The implementer cannot run MCP. The controller performs (and records in the execution ledger):
- `mcp__supabase__apply_migration` on project `ggjrtgowmauoimpvficl` with name `phase3_coaching_intelligence` and the SQL from Step 1.
- `mcp__supabase__generate_typescript_types` on `ggjrtgowmauoimpvficl`; write the output to `lib/database.types.ts` (overwrite).

Expected: migration applies with no error; `lib/database.types.ts` now contains `meal_plans` and `workout_plans` under `Database['public']['Tables']`, each with `plan_json: Json`.

- [ ] **Step 4: Verify types compile against the regenerated schema**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (Confirms `types/index.ts` additions and the regenerated `database.types.ts` are consistent.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929020000_phase3_coaching_intelligence.sql types/index.ts lib/database.types.ts
git commit -m "feat: add Phase 3 schema (meal_plans, workout_plans) with RLS + plan types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Edge Function — `generate-daily-summary` (cron + user modes) + pg_cron schedule

**Files:**
- Create: `supabase/functions/generate-daily-summary/index.ts`
- Create: `supabase/migrations/20260929030000_phase3_daily_coach_cron.sql`

**Interfaces:**
- Consumes: `daily_summaries`, `meals`, `activity_logs`, `goals`, `inbody_reports`, `profiles` tables; `OPENAI_API_KEY` (set), new `CRON_SECRET` function secret; Vault secrets `cron_secret` + `service_role_key` (for the cron job).
- Produces: `POST /functions/v1/generate-daily-summary`.
  - Cron mode: header `x-cron-secret: <CRON_SECRET>` + service-role bearer → `{ ok: true, generated: <n> }`.
  - User mode: user JWT bearer → today's `daily_summaries` row (JSON) for that user.
  - No valid cron secret and no valid user → `401 { error: 'Unauthorized' }`.

- [ ] **Step 1: Write the Edge Function** (mirrors `ai-inbody-analysis` CORS/OPTIONS + auth shape; idempotent upsert on `(user_id, date)`)

`supabase/functions/generate-daily-summary/index.ts`:
```typescript
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

// Same coaching principles the ai-agent applies. Duplicated here because each
// edge function is an isolated Deno deployment (no shared import across functions).
const COACHING_PRINCIPLES = `
Coaching principles (apply when setting goals or writing the note):
- Protein first: prioritise the daily protein target; never cut protein to make calories fit.
- Moderate deficit over aggressive: prefer a sustainable ~10-20% calorie deficit for fat loss.
- Carbs are training fuel: keep carbohydrates around training days; do not fear them when active.
- Scale-weight is noisy: judge trends over 1-2 weeks, cross-checked against InBody body-fat and muscle-mass trends.
- Safety floors: never recommend calories below ~1200 kcal/day (women) or ~1500 kcal/day (men), nor below the protein target.
`.trim()

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function generateForUser(userId: string, supabase: SupabaseClient): Promise<Record<string, unknown> | null> {
  const today = isoDate(new Date())
  const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

  // 1. Roll up YESTERDAY's meals + activity into yesterday's summary row.
  const [yMealsRes, yActivityRes] = await Promise.all([
    supabase.from('meals').select('total_calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId).gte('logged_at', `${yesterday}T00:00:00`).lte('logged_at', `${yesterday}T23:59:59`),
    supabase.from('activity_logs').select('steps')
      .eq('user_id', userId).gte('logged_at', `${yesterday}T00:00:00`).lte('logged_at', `${yesterday}T23:59:59`),
  ])
  const yMeals = (yMealsRes.data ?? []) as { total_calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
  const yTotals = yMeals.reduce(
    (a, m) => ({ cal: a.cal + m.total_calories, p: a.p + m.protein_g, c: a.c + m.carbs_g, f: a.f + m.fat_g }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )
  const ySteps = ((yActivityRes.data ?? []) as { steps: number }[]).reduce((a, x) => a + x.steps, 0)
  // Upsert ONLY the totals columns so an existing ai_coach_note on yesterday is preserved.
  await supabase.from('daily_summaries').upsert(
    {
      user_id: userId,
      date: yesterday,
      total_calories_consumed: yTotals.cal,
      total_protein_g: yTotals.p,
      total_carbs_g: yTotals.c,
      total_fat_g: yTotals.f,
      total_steps: ySteps,
    },
    { onConflict: 'user_id,date' }
  )

  // 2. Read recent trend, latest goals, latest InBody.
  const [trendRes, goalsRes, inbodyRes] = await Promise.all([
    supabase.from('daily_summaries').select('date, total_calories_consumed, total_protein_g, total_steps')
      .eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('inbody_reports').select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg')
      .eq('user_id', userId).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // 3. gpt-4o produces today's ai_daily_goals + ai_coach_note.
  const prompt = `${COACHING_PRINCIPLES}

You are Poshan AI. Set today's targets and write a short morning coach note for this user.
Today's date: ${today}
Latest goals: ${JSON.stringify(goalsRes.data)}
Latest InBody scan: ${JSON.stringify(inbodyRes.data)}
Last 7 daily summaries (most recent first): ${JSON.stringify(trendRes.data)}

Respond with ONLY a JSON object, no markdown, with exactly:
{
  "ai_daily_goals": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "steps": number, "workout_suggestion": string },
  "ai_coach_note": "2-3 encouraging, specific sentences for this morning"
}
If there are no goals yet, base the targets on sensible maintenance defaults and say so briefly in the note.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  let parsed: { ai_daily_goals?: unknown; ai_coach_note?: unknown } = {}
  try { parsed = JSON.parse(data.choices[0].message.content ?? '{}') } catch { parsed = {} }
  const aiDailyGoals = (parsed.ai_daily_goals && typeof parsed.ai_daily_goals === 'object') ? parsed.ai_daily_goals : null
  const aiCoachNote = typeof parsed.ai_coach_note === 'string' ? parsed.ai_coach_note : ''

  // 4. Upsert ONLY the AI columns onto today's row (preserves today's meal totals).
  await supabase.from('daily_summaries').upsert(
    { user_id: userId, date: today, ai_daily_goals: aiDailyGoals, ai_coach_note: aiCoachNote },
    { onConflict: 'user_id,date' }
  )

  const { data: todayRow } = await supabase.from('daily_summaries')
    .select('*').eq('user_id', userId).eq('date', today).maybeSingle()
  return todayRow ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const cronSecret = req.headers.get('x-cron-secret')
    // Cron mode ONLY when CRON_SECRET is configured AND the header matches exactly.
    if (CRON_SECRET && cronSecret === CRON_SECRET) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const { data: profiles, error } = await supabase.from('profiles').select('id')
      if (error) throw new Error(error.message)
      let generated = 0
      for (const p of (profiles ?? []) as { id: string }[]) {
        try { await generateForUser(p.id, supabase); generated += 1 } catch (_e) { /* skip one bad user, keep the batch going */ }
      }
      return new Response(JSON.stringify({ ok: true, generated }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // User (lazy) mode: derive the single user from the JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const authClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const todayRow = await generateForUser(userData.user.id, supabase)
    return new Response(JSON.stringify(todayRow), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
```

- [ ] **Step 2: Author the cron schedule migration** (applied by the controller AFTER the function is deployed and the Vault secrets exist)

`supabase/migrations/20260929030000_phase3_daily_coach_cron.sql`:
```sql
-- Phase 3: schedule the morning coach note at 06:00 UTC (adjust later per user tz).
-- Requires: pg_cron + pg_net extensions enabled, and Vault secrets
--   'cron_secret'      = the same value as the CRON_SECRET function secret,
--   'service_role_key' = the project's service_role key (to clear the gateway).
-- The header x-cron-secret selects cron mode inside the function; the service-role
-- bearer passes verify_jwt at the gateway.

select cron.schedule(
  'daily-coach',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

- [ ] **Step 3: CONTROLLER — enable extensions, store secrets, deploy, schedule** (implementer cannot run MCP; controller records each in the ledger)

On project `ggjrtgowmauoimpvficl`:
1. Enable extensions (via `mcp__supabase__execute_sql`):
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```
2. Set the function secret `CRON_SECRET` to a fresh random value (dashboard → Edge Functions → Secrets, or CLI `supabase secrets set CRON_SECRET=<value>`).
3. Store the two Vault secrets (via `mcp__supabase__execute_sql`), using the SAME `<value>` for `cron_secret`:
   ```sql
   select vault.create_secret('<value>', 'cron_secret');
   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
   ```
4. `mcp__supabase__deploy_edge_function` with slug `generate-daily-summary`, `verify_jwt: true`, and the Step 1 source.
5. `mcp__supabase__apply_migration` name `phase3_daily_coach_cron` with the Step 2 SQL.

Expected: extensions listed by `mcp__supabase__list_extensions`; function listed by `mcp__supabase__list_edge_functions`; `select jobname from cron.job` includes `daily-coach`.

- [ ] **Step 4: CONTROLLER — smoke test cron-secret auth (Review Focus #1)**

```bash
# (a) no auth at all -> gateway 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary

# (b) wrong cron secret + service-role bearer -> falls to user mode, getUser() empty -> 401
curl -s -w "\n%{http_code}\n" -X POST \
  https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "x-cron-secret: definitely-wrong"

# (c) correct cron secret + service-role bearer -> cron mode
curl -s -X POST \
  https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "x-cron-secret: <CRON_SECRET>"
```
Expected: (a) `401`; (b) body `{"error":"Unauthorized"}` with `401` — proves a wrong secret cannot loop all profiles; (c) `{"ok":true,"generated":<n>}`.

- [ ] **Step 5: CONTROLLER — smoke test idempotency + no-duplicate + totals preserved (Review Focus #2)**

```sql
-- via mcp__supabase__execute_sql on ggjrtgowmauoimpvficl, for the test user's today row
select count(*) as n, max(total_calories_consumed) as cals
from daily_summaries where user_id = '<TEST_USER_ID>' and date = current_date;
```
Then invoke user mode twice with the test user's JWT:
```bash
curl -s -X POST https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary \
  -H "Authorization: Bearer <TEST_USER_JWT>" -H "apikey: <ANON_KEY>"
curl -s -X POST https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/generate-daily-summary \
  -H "Authorization: Bearer <TEST_USER_JWT>" -H "apikey: <ANON_KEY>"
```
Re-run the count query. Expected: `n` is still **1** (upsert, not a second row), `cals` unchanged (the AI-only upsert did not zero today's meal totals), and each response body carries a non-empty `ai_coach_note`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-daily-summary/ supabase/migrations/20260929030000_phase3_daily_coach_cron.sql
git commit -m "feat: add generate-daily-summary edge fn (cron + lazy modes, idempotent upsert) + pg_cron schedule

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Dashboard — coach-note lazy fallback (once/session) + low-fuel card

**Files:**
- Create: `lib/utils/coachNote.ts`
- Create: `lib/api/dailySummary.ts`
- Create: `__tests__/lib/coachNote.test.ts`
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useDailySummaryStore` (existing `summary`, `fetchOrCreateToday`); `DailySummary` from `types`; `supabase` for the auth token.
- Produces: `shouldGenerateCoachNote(summary: DailySummary | null, lastAttemptDate: string | null, today: string): boolean` and `shouldShowLowFuelPrompt(consumed: number, target: number, now: Date): boolean` from `lib/utils/coachNote.ts`.
- Produces: `generateDailySummary(): Promise<DailySummary | null>` from `lib/api/dailySummary.ts` (POSTs the user's JWT to `generate-daily-summary`, user mode).

- [ ] **Step 1: Write the failing coachNote util test** (Review Focus #3 + low-fuel logic)

`__tests__/lib/coachNote.test.ts`:
```typescript
import { shouldGenerateCoachNote, shouldShowLowFuelPrompt } from '../../lib/utils/coachNote'
import { DailySummary } from '../../types'

const summary = (note: string | null): DailySummary => ({
  id: 's', user_id: 'u', date: '2026-09-29', total_calories_consumed: 0, total_protein_g: 0,
  total_carbs_g: 0, total_fat_g: 0, total_steps: 0, weight_kg: null,
  ai_daily_goals: null, ai_coach_note: note, created_at: '2026-09-29T00:00:00Z',
})

describe('shouldGenerateCoachNote', () => {
  it('fires when the note is null and no attempt was made today', () => {
    expect(shouldGenerateCoachNote(summary(null), null, '2026-09-29')).toBe(true)
  })
  it('fires when there is no summary row at all', () => {
    expect(shouldGenerateCoachNote(null, null, '2026-09-29')).toBe(true)
  })
  it('does NOT fire again once attempted today, even while the note is still null', () => {
    expect(shouldGenerateCoachNote(summary(null), '2026-09-29', '2026-09-29')).toBe(false)
  })
  it('does NOT fire when a note already exists', () => {
    expect(shouldGenerateCoachNote(summary('good morning'), null, '2026-09-29')).toBe(false)
  })
})

describe('shouldShowLowFuelPrompt', () => {
  it('shows in the afternoon when calories are well under target', () => {
    expect(shouldShowLowFuelPrompt(800, 2000, new Date('2026-09-29T16:00:00'))).toBe(true)
  })
  it('stays hidden in the morning even when calories are low', () => {
    expect(shouldShowLowFuelPrompt(0, 2000, new Date('2026-09-29T08:00:00'))).toBe(false)
  })
  it('stays hidden once calories reach 80% of target', () => {
    expect(shouldShowLowFuelPrompt(1700, 2000, new Date('2026-09-29T18:00:00'))).toBe(false)
  })
  it('never divides by a zero target', () => {
    expect(shouldShowLowFuelPrompt(0, 0, new Date('2026-09-29T18:00:00'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest __tests__/lib/coachNote.test.ts`
Expected: FAIL — cannot find module `lib/utils/coachNote`.

- [ ] **Step 3: Implement the coachNote utils**

`lib/utils/coachNote.ts`:
```typescript
import { DailySummary } from '../../types'

// Lazy fallback guard: fire at most once per session/day. Fires only when today's
// row is missing or has no coach note AND we have not already attempted today.
export function shouldGenerateCoachNote(
  summary: DailySummary | null,
  lastAttemptDate: string | null,
  today: string
): boolean {
  if (lastAttemptDate === today) return false
  if (!summary) return true
  return summary.ai_coach_note === null || summary.ai_coach_note === ''
}

// Low-fuel prompt: only in the afternoon (>= 15:00 local) and when under 80% of
// the calorie target. Guards a zero target so we never divide by zero.
export function shouldShowLowFuelPrompt(consumed: number, target: number, now: Date): boolean {
  if (target <= 0) return false
  if (now.getHours() < 15) return false
  return consumed / target < 0.8
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest __tests__/lib/coachNote.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the daily-summary API client** (mirrors `lib/api/agent.ts` Bearer pattern)

`lib/api/dailySummary.ts`:
```typescript
import { supabase } from '../supabase'
import { DailySummary } from '../../types'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// User (lazy) mode: derive the user server-side from the JWT; never send a user_id.
export async function generateDailySummary(): Promise<DailySummary | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  })

  const body: unknown = await response.json()
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Daily summary request failed with status ${response.status}`
    throw new Error(message)
  }
  return body as DailySummary | null
}
```

- [ ] **Step 6: Wire the lazy fallback + low-fuel card into the dashboard** in `app/(tabs)/index.tsx`

Change the existing line 1 `import { useEffect } from 'react'` to:
```typescript
import { useEffect, useState } from 'react'
```
Add these imports near the other imports:
```typescript
import { generateDailySummary } from '../../lib/api/dailySummary'
import { shouldGenerateCoachNote, shouldShowLowFuelPrompt } from '../../lib/utils/coachNote'
```
Declare the module-scoped once-per-day guard at module top (above `export default function HomeScreen`):
```typescript
// Fires the lazy coach-note generation at most once per app session per calendar day.
let coachNoteAttemptDate: string | null = null
```
Inside `HomeScreen`, after `const { todayActivity, ... } = useActivityStore()` add:
```typescript
  const [lazyError, setLazyError] = useState<string | null>(null)
```
Add a second `useEffect` after the existing one to run the lazy fallback once `summary` has loaded:
```typescript
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    if (user && shouldGenerateCoachNote(summary, coachNoteAttemptDate, today)) {
      coachNoteAttemptDate = today
      generateDailySummary()
        .then(() => fetchOrCreateToday(user.id))
        .catch((e) => setLazyError(e instanceof Error ? e.message : String(e)))
    }
  }, [user, summary])
```
Include `lazyError` in the error line — change:
```typescript
  const errorMessage = mealsError ?? profileError ?? summaryError ?? activityError
```
to:
```typescript
  const errorMessage = mealsError ?? profileError ?? summaryError ?? activityError ?? lazyError
```
Add the low-fuel card immediately after the existing `ai_coach_note` block (after its closing `)}` at the current lines 85-89):
```typescript
      {shouldShowLowFuelPrompt(totals.calories, calorieTarget, new Date()) && (
        <Pressable className="mx-4 mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3" onPress={() => router.push('/(tabs)/chat')}>
          <Text className="text-orange-800 font-semibold text-sm">Not enough food today</Text>
          <Text className="text-orange-700 text-xs mt-1">You are well under your calorie target — tap to ask the coach for a meal suggestion.</Text>
        </Pressable>
      )}
```

- [ ] **Step 7: Typecheck + run new + full test suite**

Run: `npx tsc --noEmit && npx jest __tests__/lib/coachNote.test.ts`
Expected: tsc exit 0; suite PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/utils/coachNote.ts lib/api/dailySummary.ts __tests__/lib/coachNote.test.ts app/(tabs)/index.tsx
git commit -m "feat: dashboard coach-note lazy fallback (once/session) + low-fuel suggestion card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Agent tools — `generate_meal_plan`, `generate_workout_plan`, `get_progress_report`, `get_meal_suggestion`

**Files:**
- Modify: `supabase/functions/ai-agent/tools.ts` (4 tool defs + 4 executors)
- Modify: `supabase/functions/ai-agent/context.ts` (latest-plan context line)

**Interfaces:**
- Consumes: service-role `SupabaseClient`; `meal_plans`, `workout_plans`, `inbody_reports`, `daily_summaries`, `meals`, `goals` tables.
- Produces (tool contracts): `generate_meal_plan({ week_start_date?, plan })` and `generate_workout_plan({ week_start_date?, plan })` — the MODEL supplies the full `plan` object; the executor inserts a new row (append-only) and refuses a malformed `plan`. `get_progress_report({ start_date?, end_date? })` — returns trend JSON. `get_meal_suggestion({})` — returns remaining-macros JSON for today.
- Produces (context): appends `Latest meal plan week:` / `Latest workout plan week:` to the assembled context string.

- [ ] **Step 1: Add the four tool definitions** to `TOOL_DEFINITIONS` in `supabase/functions/ai-agent/tools.ts` (insert after the existing `adjust_diet_plan` entry, before the closing `]`)

```typescript
  {
    type: 'function',
    function: {
      name: 'generate_meal_plan',
      description: "Generate a full 7-day meal plan aligned to the user's calorie and macro goals and save it. YOU must supply the complete plan_json — do not ask another system to produce it. Each day has breakfast/lunch/dinner/snack meals with per-meal macros.",
      parameters: {
        type: 'object',
        properties: {
          week_start_date: { type: 'string', description: 'ISO date YYYY-MM-DD for the Monday of the plan week; defaults to today' },
          plan: {
            type: 'object',
            description: 'The full plan: { days: [ { day, meals: [ { meal_type, description, calories, protein_g, carbs_g, fat_g } ] } ] }',
            properties: {
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'string' },
                    meals: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                          description: { type: 'string' },
                          calories: { type: 'number' },
                          protein_g: { type: 'number' },
                          carbs_g: { type: 'number' },
                          fat_g: { type: 'number' },
                        },
                        required: ['meal_type', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
                      },
                    },
                  },
                  required: ['day', 'meals'],
                },
              },
            },
            required: ['days'],
          },
        },
        required: ['plan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_workout_plan',
      description: "Generate a full weekly workout plan based on the user's goals, activity level, and InBody data, and save it. YOU must supply the complete plan_json. Each day has a focus and a list of exercises.",
      parameters: {
        type: 'object',
        properties: {
          week_start_date: { type: 'string', description: 'ISO date YYYY-MM-DD for the Monday of the plan week; defaults to today' },
          plan: {
            type: 'object',
            description: 'The full plan: { days: [ { day, focus, exercises: [ { name, sets, reps, notes } ] } ] }',
            properties: {
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'string' },
                    focus: { type: 'string' },
                    exercises: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          sets: { type: 'number' },
                          reps: { type: 'string' },
                          notes: { type: 'string' },
                        },
                        required: ['name', 'sets', 'reps'],
                      },
                    },
                  },
                  required: ['day', 'focus', 'exercises'],
                },
              },
            },
            required: ['days'],
          },
        },
        required: ['plan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_progress_report',
      description: "Get the user's trend data (weight/body-fat/muscle from InBody, calorie adherence from daily summaries) over a date range, to narrate how they are doing.",
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO date YYYY-MM-DD; defaults to 30 days before end_date' },
          end_date: { type: 'string', description: 'ISO date YYYY-MM-DD; defaults to today' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_meal_suggestion',
      description: "Compute the macros the user has left for today (target minus consumed) so you can suggest a concrete meal that fits.",
      parameters: { type: 'object', properties: {} },
    },
  },
```

- [ ] **Step 2: Add the four executors** in `executeTool` in `supabase/functions/ai-agent/tools.ts` (insert before the final `return \`Unknown tool: ${name}\``)

```typescript
  if (name === 'generate_meal_plan' || name === 'generate_workout_plan') {
    const plan = input.plan
    // Malformed plan_json from the model must NOT be persisted (Review Focus #4).
    if (!plan || typeof plan !== 'object' || !Array.isArray((plan as { days?: unknown }).days) || (plan as { days: unknown[] }).days.length === 0) {
      return 'Error: plan must be an object with a non-empty "days" array. Re-call the tool with the full plan_json.'
    }
    const table = name === 'generate_meal_plan' ? 'meal_plans' : 'workout_plans'
    const weekStart = typeof input.week_start_date === 'string' ? input.week_start_date : new Date().toISOString().split('T')[0]
    // Plans are append-only / latest-wins: INSERT a new row every time.
    const { error } = await supabase.from(table).insert({
      user_id: userId,
      week_start_date: weekStart,
      plan_json: plan,
    })
    if (error) return `Error saving plan: ${error.message}`
    const dayCount = (plan as { days: unknown[] }).days.length
    return `${name === 'generate_meal_plan' ? 'Meal' : 'Workout'} plan saved for the week of ${weekStart} (${dayCount} days). Tell the user to open the Plans tab.`
  }

  if (name === 'get_progress_report') {
    const end = typeof input.end_date === 'string' ? input.end_date : new Date().toISOString().split('T')[0]
    const start = typeof input.start_date === 'string'
      ? input.start_date
      : new Date(new Date(`${end}T00:00:00Z`).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const [inbodyRes, dailyRes] = await Promise.all([
      supabase.from('inbody_reports')
        .select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg')
        .eq('user_id', userId)
        .gte('scanned_at', `${start}T00:00:00`).lte('scanned_at', `${end}T23:59:59`)
        .order('scanned_at', { ascending: true }),
      supabase.from('daily_summaries')
        .select('date, total_calories_consumed, ai_daily_goals')
        .eq('user_id', userId)
        .gte('date', start).lte('date', end)
        .order('date', { ascending: true }),
    ])
    return JSON.stringify({ start, end, inbody: inbodyRes.data ?? [], daily: dailyRes.data ?? [] })
  }

  if (name === 'get_meal_suggestion') {
    const today = new Date().toISOString().split('T')[0]
    const [mealsRes, goalsRes] = await Promise.all([
      supabase.from('meals').select('total_calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId).gte('logged_at', `${today}T00:00:00`).lte('logged_at', `${today}T23:59:59`),
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const meals = (mealsRes.data ?? []) as { total_calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
    const consumed = meals.reduce(
      (a, m) => ({ cal: a.cal + m.total_calories, p: a.p + m.protein_g, c: a.c + m.carbs_g, f: a.f + m.fat_g }),
      { cal: 0, p: 0, c: 0, f: 0 }
    )
    const g = goalsRes.data as { daily_calorie_target: number; daily_protein_g: number; daily_carbs_g: number; daily_fat_g: number } | null
    if (!g) return 'No goals set yet — ask the user to set goals in onboarding before suggesting meals.'
    return JSON.stringify({
      remaining_calories: g.daily_calorie_target - consumed.cal,
      remaining_protein_g: g.daily_protein_g - consumed.p,
      remaining_carbs_g: g.daily_carbs_g - consumed.c,
      remaining_fat_g: g.daily_fat_g - consumed.f,
      note: 'Suggest ONE concrete meal that roughly fits these remaining macros.',
    })
  }
```

- [ ] **Step 3: Add latest-plan context** in `supabase/functions/ai-agent/context.ts`

Add two queries to the `Promise.all` array (after the `activity_logs` entry, before the closing `])`):
```typescript
    supabase.from('meal_plans').select('week_start_date').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_plans').select('week_start_date').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
```
Change the destructuring on line 6 to include them:
```typescript
  const [profileRes, goalsRes, mealsRes, historyRes, inbodyRes, activityRes, mealPlanRes, workoutPlanRes] = await Promise.all([
```
Add two lines to the returned template literal (before the closing back-tick, after `Last 7 days summaries`):
```typescript
Latest meal plan week: ${JSON.stringify(mealPlanRes.data)}
Latest workout plan week: ${JSON.stringify(workoutPlanRes.data)}
```

- [ ] **Step 4: CONTROLLER — redeploy `ai-agent` via Supabase MCP**

Implementer cannot deploy. Controller runs `mcp__supabase__deploy_edge_function` on `ggjrtgowmauoimpvficl` with slug `ai-agent`, `verify_jwt: true`, and all three files (`index.ts`, `tools.ts`, `context.ts`); records it in the ledger.

- [ ] **Step 5: CONTROLLER — smoke test plan persistence + malformed guard (Review Focus #4)**

Note the current meal-plan count for the test user:
```sql
-- via mcp__supabase__execute_sql on ggjrtgowmauoimpvficl
select count(*) as n from meal_plans where user_id = '<TEST_USER_ID>';
```
Trigger a plan generation via chat:
```bash
curl -X POST https://ggjrtgowmauoimpvficl.supabase.co/functions/v1/ai-agent \
  -H "Authorization: Bearer <TEST_USER_JWT>" -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"message":"Generate a new 7-day meal plan aligned to my goals and save it."}'
```
Re-run the count query and inspect the newest row:
```sql
select jsonb_typeof(plan_json->'days') as days_type, jsonb_array_length(plan_json->'days') as days
from meal_plans where user_id = '<TEST_USER_ID>' order by created_at desc limit 1;
```
Expected: count increased by **exactly 1**; `days_type` is `array` and `days` is > 0 — confirming the model supplied a valid `plan_json` and the executor persisted it (no nested LLM call). The executor's guard returns an error string and inserts no row when `plan` is missing/malformed (verified by the `required: ['plan']` schema plus the `days` non-empty check).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ai-agent/
git commit -m "feat: agent gains generate_meal_plan, generate_workout_plan, get_progress_report, get_meal_suggestion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `plansStore` + Plans tab (`app/(tabs)/plans.tsx`) + register tab

**Files:**
- Create: `lib/utils/plan.ts`
- Create: `stores/plansStore.ts`
- Create: `app/(tabs)/plans.tsx`
- Create: `__tests__/lib/plan.test.ts`
- Create: `__tests__/stores/plansStore.test.ts`
- Modify: `app/(tabs)/_layout.tsx` (add Plans tab; order Home / Meals / Plans / Chat / Settings)

**Interfaces:**
- Consumes: `supabase`; `MealPlan`, `WorkoutPlan`, `MealPlanDay`, `WorkoutPlanDay` from `types`; `sendAgentMessage` from `lib/api/agent`.
- Produces: `planDays<T>(plan: { days?: unknown } | null): T[]` from `lib/utils/plan.ts` (defensive read of `plan_json`).
- Produces: `usePlansStore` — `{ mealPlan: MealPlan|null, workoutPlan: WorkoutPlan|null, loading: boolean, generating: boolean, error: string|null, fetchPlans(userId: string): Promise<void>, generateMealPlan(userId: string): Promise<void>, generateWorkoutPlan(userId: string): Promise<void> }`.

- [ ] **Step 1: Write the failing plan-reader test** (Review Focus #4 — malformed plan_json never crashes)

`__tests__/lib/plan.test.ts`:
```typescript
import { planDays } from '../../lib/utils/plan'
import { MealPlanDay } from '../../types'

describe('planDays', () => {
  it('returns [] for a null plan', () => {
    expect(planDays<MealPlanDay>(null)).toEqual([])
  })
  it('returns [] when days is missing', () => {
    expect(planDays<MealPlanDay>({})).toEqual([])
  })
  it('returns [] when days is not an array', () => {
    expect(planDays<MealPlanDay>({ days: 'nope' as unknown })).toEqual([])
  })
  it('returns the days array when well-formed', () => {
    const days = [{ day: 'Mon', meals: [] }]
    expect(planDays<MealPlanDay>({ days })).toEqual(days)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest __tests__/lib/plan.test.ts`
Expected: FAIL — cannot find module `lib/utils/plan`.

- [ ] **Step 3: Implement the plan reader**

`lib/utils/plan.ts`:
```typescript
// Defensive reader for plan_json.days. A malformed plan (null, missing days, or
// days-not-an-array from the model) yields [] so the Plans screen never crashes.
export function planDays<T>(plan: { days?: unknown } | null | undefined): T[] {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days)) return []
  return plan.days as T[]
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest __tests__/lib/plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing plansStore test**

`__tests__/stores/plansStore.test.ts`:
```typescript
/// <reference types="jest" />
import { usePlansStore } from '../../stores/plansStore'
import { supabase } from '../../lib/supabase'
import { sendAgentMessage } from '../../lib/api/agent'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../lib/api/agent', () => ({ sendAgentMessage: jest.fn() }))

function makeLatestChain(resolved: { data: unknown; error: unknown }) {
  const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue(resolved)
  return chain
}

describe('plansStore', () => {
  beforeEach(() => {
    usePlansStore.setState({ mealPlan: null, workoutPlan: null, loading: false, generating: false, error: null })
    jest.clearAllMocks()
  })

  it('fetchPlans loads the latest meal and workout plan', async () => {
    const meal = { id: 'm1', user_id: 'u1', week_start_date: '2026-09-28', plan_json: { days: [] }, created_at: 'x' }
    const workout = { id: 'w1', user_id: 'u1', week_start_date: '2026-09-28', plan_json: { days: [] }, created_at: 'x' }
    ;(supabase.from as jest.Mock).mockImplementation((table: string) =>
      table === 'meal_plans' ? makeLatestChain({ data: meal, error: null }) : makeLatestChain({ data: workout, error: null })
    )
    await usePlansStore.getState().fetchPlans('u1')
    expect(usePlansStore.getState().mealPlan?.id).toBe('m1')
    expect(usePlansStore.getState().workoutPlan?.id).toBe('w1')
    expect(usePlansStore.getState().error).toBeNull()
  })

  it('fetchPlans surfaces an error', async () => {
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: { message: 'boom' } }))
    await usePlansStore.getState().fetchPlans('u1')
    expect(usePlansStore.getState().error).toBe('boom')
  })

  it('generateMealPlan calls the agent with a directive then refetches', async () => {
    ;(sendAgentMessage as jest.Mock).mockResolvedValue({ reply: 'done', conversation_id: 'c1' })
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: null }))
    await usePlansStore.getState().generateMealPlan('u1')
    expect(sendAgentMessage).toHaveBeenCalledWith(expect.stringContaining('meal plan'))
    expect(supabase.from).toHaveBeenCalledWith('meal_plans')
    expect(usePlansStore.getState().generating).toBe(false)
  })

  it('generateMealPlan surfaces an agent error', async () => {
    ;(sendAgentMessage as jest.Mock).mockRejectedValue(new Error('agent down'))
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: null }))
    await usePlansStore.getState().generateMealPlan('u1')
    expect(usePlansStore.getState().error).toBe('agent down')
  })
})
```

- [ ] **Step 6: Run test to confirm it fails**

Run: `npx jest __tests__/stores/plansStore.test.ts`
Expected: FAIL — cannot find module `stores/plansStore`.

- [ ] **Step 7: Implement the plansStore**

`stores/plansStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { sendAgentMessage } from '../lib/api/agent'
import { MealPlan, WorkoutPlan } from '../types'

interface PlansState {
  mealPlan: MealPlan | null
  workoutPlan: WorkoutPlan | null
  loading: boolean
  generating: boolean
  error: string | null
  fetchPlans: (userId: string) => Promise<void>
  generateMealPlan: (userId: string) => Promise<void>
  generateWorkoutPlan: (userId: string) => Promise<void>
}

export const usePlansStore = create<PlansState>()(
  immer((set, get) => ({
    mealPlan: null,
    workoutPlan: null,
    loading: false,
    generating: false,
    error: null,

    fetchPlans: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      // Plans are append-only / latest-wins: take the most recent row per type.
      const [mealRes, workoutRes] = await Promise.all([
        supabase.from('meal_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      set((s) => {
        s.loading = false
        s.mealPlan = mealRes.error ? null : (mealRes.data as MealPlan | null)
        s.workoutPlan = workoutRes.error ? null : (workoutRes.data as WorkoutPlan | null)
        s.error = mealRes.error?.message ?? workoutRes.error?.message ?? null
      })
    },

    generateMealPlan: async (userId) => {
      set((s) => { s.generating = true; s.error = null })
      try {
        // Reuse ai-agent; its generate_meal_plan tool persists the row (no new edge fn).
        await sendAgentMessage('Generate a new 7-day meal plan aligned to my current calorie and macro goals, and save it with the generate_meal_plan tool.')
      } catch (e) {
        set((s) => { s.error = e instanceof Error ? e.message : String(e) })
      }
      set((s) => { s.generating = false })
      await get().fetchPlans(userId)
    },

    generateWorkoutPlan: async (userId) => {
      set((s) => { s.generating = true; s.error = null })
      try {
        await sendAgentMessage('Generate a new weekly workout plan based on my goals, activity level, and latest InBody data, and save it with the generate_workout_plan tool.')
      } catch (e) {
        set((s) => { s.error = e instanceof Error ? e.message : String(e) })
      }
      set((s) => { s.generating = false })
      await get().fetchPlans(userId)
    },
  }))
)
```

- [ ] **Step 8: Run store test to confirm it passes**

Run: `npx jest __tests__/stores/plansStore.test.ts`
Expected: PASS.

- [ ] **Step 9: Build the Plans tab screen** (composes tested store/util; no dedicated screen test)

`app/(tabs)/plans.tsx`:
```typescript
import { useEffect } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { usePlansStore } from '../../stores/plansStore'
import { planDays } from '../../lib/utils/plan'
import { MealPlanDay, WorkoutPlanDay } from '../../types'

export default function PlansScreen() {
  const { user } = useAuthStore()
  const { mealPlan, workoutPlan, loading, generating, error, fetchPlans, generateMealPlan, generateWorkoutPlan } = usePlansStore()

  useEffect(() => { if (user) fetchPlans(user.id) }, [user])

  const mealDays = planDays<MealPlanDay>(mealPlan?.plan_json ?? null)
  const workoutDays = planDays<WorkoutPlanDay>(workoutPlan?.plan_json ?? null)

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Plans</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}
      {(loading || generating) && <ActivityIndicator className="mt-6" color="#16a34a" />}

      {/* Meal plan */}
      <View className="px-6 pt-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-800">Meal plan</Text>
          <Pressable className="bg-green-600 rounded-lg px-4 py-2" disabled={generating} onPress={() => user && generateMealPlan(user.id)}>
            <Text className="text-white font-semibold text-sm">Regenerate</Text>
          </Pressable>
        </View>
        {mealDays.length === 0 ? (
          <Text className="text-gray-400 text-center py-6">No meal plan yet. Tap Regenerate to create one.</Text>
        ) : (
          mealDays.map((d, i) => (
            <View key={`${d.day}-${i}`} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <Text className="font-semibold text-gray-900 mb-2">{d.day}</Text>
              {d.meals.map((m, j) => (
                <View key={j} className="mb-2">
                  <Text className="text-sm text-gray-800 capitalize">{m.meal_type}: {m.description}</Text>
                  <Text className="text-xs text-gray-500">{m.calories} kcal · {m.protein_g}p / {m.carbs_g}c / {m.fat_g}f</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      {/* Workout plan */}
      <View className="px-6 pt-2 pb-8">
        <View className="flex-row items-center justify-between mb-3 mt-2">
          <Text className="text-lg font-semibold text-gray-800">Workout plan</Text>
          <Pressable className="bg-green-600 rounded-lg px-4 py-2" disabled={generating} onPress={() => user && generateWorkoutPlan(user.id)}>
            <Text className="text-white font-semibold text-sm">Regenerate</Text>
          </Pressable>
        </View>
        {workoutDays.length === 0 ? (
          <Text className="text-gray-400 text-center py-6">No workout plan yet. Tap Regenerate to create one.</Text>
        ) : (
          workoutDays.map((d, i) => (
            <View key={`${d.day}-${i}`} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <Text className="font-semibold text-gray-900">{d.day}</Text>
              <Text className="text-xs text-gray-500 mb-2">{d.focus}</Text>
              {d.exercises.map((ex, j) => (
                <View key={j} className="mb-1">
                  <Text className="text-sm text-gray-800">{ex.name} — {ex.sets} × {ex.reps}</Text>
                  {ex.notes ? <Text className="text-xs text-gray-400">{ex.notes}</Text> : null}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 10: Register the Plans tab** in `app/(tabs)/_layout.tsx` — replace the whole file so the tab order is Home / Meals / Plans / Chat / Settings

```typescript
import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#16a34a' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text> }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarIcon: ({ color }) => <Text style={{ color }}>🍽️</Text> }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: ({ color }) => <Text style={{ color }}>📋</Text> }} />
      <Tabs.Screen name="chat" options={{ title: 'Coach', tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color }}>⚙️</Text> }} />
    </Tabs>
  )
}
```

- [ ] **Step 11: Typecheck + run new tests**

Run: `npx tsc --noEmit && npx jest __tests__/lib/plan.test.ts __tests__/stores/plansStore.test.ts`
Expected: tsc exit 0; both suites PASS.

- [ ] **Step 12: Commit**

```bash
git add lib/utils/plan.ts stores/plansStore.ts app/(tabs)/plans.tsx app/(tabs)/_layout.tsx __tests__/lib/plan.test.ts __tests__/stores/plansStore.test.ts
git commit -m "feat: Plans tab with meal + workout plan display, Regenerate via ai-agent, defensive plan reader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Analytics — `BarChart` + `adherenceSeries` helper + extend `app/progress.tsx`

**Files:**
- Modify: `lib/utils/chart.ts` (append `AdherenceBar` + `adherenceSeries`)
- Modify: `__tests__/lib/chart.test.ts` (append `adherenceSeries` tests)
- Create: `components/ui/BarChart.tsx`
- Modify: `stores/dailySummaryStore.ts` (add `recent` + `fetchRecent`)
- Modify: `__tests__/stores/dailySummaryStore.test.ts` (append `fetchRecent` tests)
- Modify: `app/progress.tsx` (add calorie-adherence section)

**Interfaces:**
- Consumes: `react-native-svg`; `DailySummary` from `types`; `useDailySummaryStore`.
- Produces: `AdherenceBar { label: string; consumed: number; target: number; pct: number }` and `adherenceSeries(rows): AdherenceBar[]` from `lib/utils/chart.ts` (input rows: `{ date: string; total_calories_consumed: number; ai_daily_goals: { calories?: number } | null }[]`).
- Produces: `BarChart` — `{ data: AdherenceBar[]; width?: number; height?: number }`.
- Produces: `useDailySummaryStore.recent: DailySummary[]` and `fetchRecent(userId: string): Promise<void>` (last 30 rows, ascending by date).

- [ ] **Step 1: Append the failing `adherenceSeries` test** (Review Focus #5 — missing days / divide-by-zero) to `__tests__/lib/chart.test.ts`

```typescript
import { adherenceSeries } from '../../lib/utils/chart'

describe('adherenceSeries', () => {
  it('returns [] for no rows', () => {
    expect(adherenceSeries([])).toEqual([])
  })
  it('yields target 0 and pct 0 when ai_daily_goals is null (never NaN)', () => {
    const out = adherenceSeries([{ date: '2026-09-20', total_calories_consumed: 500, ai_daily_goals: null }])
    expect(out[0].target).toBe(0)
    expect(out[0].pct).toBe(0)
  })
  it('yields pct 0 when the target is 0 (no divide-by-zero)', () => {
    const out = adherenceSeries([{ date: '2026-09-20', total_calories_consumed: 500, ai_daily_goals: { calories: 0 } }])
    expect(out[0].pct).toBe(0)
    expect(Number.isFinite(out[0].pct)).toBe(true)
  })
  it('computes rounded percent adherence for a normal day', () => {
    const out = adherenceSeries([{ date: '2026-09-20', total_calories_consumed: 1000, ai_daily_goals: { calories: 2000 } }])
    expect(out[0]).toEqual({ label: '09-20', consumed: 1000, target: 2000, pct: 50 })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx jest __tests__/lib/chart.test.ts`
Expected: FAIL — `adherenceSeries` is not exported from `lib/utils/chart`.

- [ ] **Step 3: Append `adherenceSeries` to `lib/utils/chart.ts`** (keep the existing `ChartPoint` + `scalePoints`; add below them)

```typescript
export interface AdherenceBar {
  label: string
  consumed: number
  target: number
  pct: number
}

// Calorie adherence per day. A day with no target (missing/null ai_daily_goals or
// target 0) yields pct 0 rather than NaN/Infinity, so the bar chart never breaks.
export function adherenceSeries(
  rows: { date: string; total_calories_consumed: number; ai_daily_goals: { calories?: number } | null }[]
): AdherenceBar[] {
  return rows.map((r) => {
    const target = r.ai_daily_goals?.calories ?? 0
    const consumed = r.total_calories_consumed ?? 0
    const pct = target > 0 ? Math.round((consumed / target) * 100) : 0
    return { label: r.date.slice(5), consumed, target, pct }
  })
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx jest __tests__/lib/chart.test.ts`
Expected: PASS (existing `scalePoints` tests still pass).

- [ ] **Step 5: Build the `BarChart` component** (react-native-svg only; Review Focus #5 empty-state)

`components/ui/BarChart.tsx`:
```typescript
import { View, Text } from 'react-native'
import Svg, { Rect, Line } from 'react-native-svg'
import { AdherenceBar } from '../../lib/utils/chart'

interface Props {
  data: AdherenceBar[]
  width?: number
  height?: number
}

export function BarChart({ data, width = 320, height = 160 }: Props) {
  if (data.length === 0) {
    return <Text className="text-gray-400 text-center py-6">Not enough data to chart adherence yet.</Text>
  }
  const padding = 8
  const innerH = height - padding * 2
  const barW = (width - padding * 2) / data.length

  return (
    <View>
      <Svg width={width} height={height}>
        {data.map((d, i) => {
          const capped = Math.min(150, d.pct)          // clamp so a huge overshoot doesn't overflow
          const h = (capped / 150) * innerH
          const x = padding + i * barW
          const y = padding + innerH - h
          // green = on target (90-110%), amber = under, red = over
          const color = d.pct < 90 ? '#d97706' : d.pct <= 110 ? '#16a34a' : '#dc2626'
          return <Rect key={i} x={x + 1} y={y} width={Math.max(1, barW - 2)} height={h} fill={color} rx={2} />
        })}
        <Line x1={padding} y1={padding + innerH} x2={width - padding} y2={padding + innerH} stroke="#e5e7eb" strokeWidth={1} />
      </Svg>
      <View className="flex-row justify-between px-1">
        <Text className="text-[10px] text-gray-400">{data[0].label}</Text>
        <Text className="text-[10px] text-gray-400">{data[data.length - 1].label}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 6: Append `fetchRecent` tests** to `__tests__/stores/dailySummaryStore.test.ts` (inside the existing `describe('dailySummaryStore', …)` block)

```typescript
  it('fetchRecent loads the recent summaries ascending', async () => {
    const rows = [{ id: 's1', date: '2026-09-01' }, { id: 's2', date: '2026-09-02' }]
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn() }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    chain.limit.mockResolvedValue({ data: rows, error: null })
    ;(supabase.from as jest.Mock).mockImplementation(() => chain)

    await useDailySummaryStore.getState().fetchRecent('user-1')
    expect(useDailySummaryStore.getState().recent).toHaveLength(2)
    expect(useDailySummaryStore.getState().error).toBeNull()
  })

  it('fetchRecent surfaces an error and leaves recent empty', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn() }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    chain.limit.mockResolvedValue({ data: null, error: { message: 'recent failed' } })
    ;(supabase.from as jest.Mock).mockImplementation(() => chain)

    await useDailySummaryStore.getState().fetchRecent('user-1')
    expect(useDailySummaryStore.getState().recent).toEqual([])
    expect(useDailySummaryStore.getState().error).toBe('recent failed')
  })
```
Also update the `beforeEach` reset in that file to include `recent`:
```typescript
    useDailySummaryStore.setState({ summary: null, recent: [], loading: false, error: null })
```

- [ ] **Step 7: Run test to confirm it fails**

Run: `npx jest __tests__/stores/dailySummaryStore.test.ts`
Expected: FAIL — `fetchRecent` is not a function / `recent` missing.

- [ ] **Step 8: Add `recent` + `fetchRecent` to `stores/dailySummaryStore.ts`**

Extend the state interface:
```typescript
interface DailySummaryState {
  summary: DailySummary | null
  recent: DailySummary[]
  loading: boolean
  error: string | null
  fetchOrCreateToday: (userId: string) => Promise<void>
  fetchRecent: (userId: string) => Promise<void>
}
```
In the `immer((set) => ({ … }))` initializer add `recent: [],` next to `summary: null,`, and add the action:
```typescript
    fetchRecent: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(30)
      set((s) => {
        s.loading = false
        s.recent = error ? [] : (data as DailySummary[])
        s.error = error?.message ?? null
      })
    },
```

- [ ] **Step 9: Run test to confirm it passes**

Run: `npx jest __tests__/stores/dailySummaryStore.test.ts`
Expected: PASS (existing `fetchOrCreateToday` tests still pass).

- [ ] **Step 10: Extend `app/progress.tsx`** with the calorie-adherence bar chart (keep the existing InBody `LineChart`s untouched)

Add imports at the top:
```typescript
import { useDailySummaryStore } from '../stores/dailySummaryStore'
import { BarChart } from '../components/ui/BarChart'
import { adherenceSeries } from '../lib/utils/chart'
```
Inside `ProgressScreen`, add the store hook after the existing `useInbodyStore` line:
```typescript
  const { recent, fetchRecent } = useDailySummaryStore()
```
Extend the existing effect to also fetch recent summaries:
```typescript
  useEffect(() => { if (user) { fetchReports(user.id); fetchRecent(user.id) } }, [user])
```
Compute the series before the `return`:
```typescript
  const adherence = adherenceSeries(
    recent.map((r) => ({
      date: r.date,
      total_calories_consumed: r.total_calories_consumed,
      ai_daily_goals: r.ai_daily_goals ? { calories: r.ai_daily_goals.calories } : null,
    }))
  )
```
Add a calorie-adherence card inside the charts `View` (the `<View className="px-6 pt-4">` branch), after the `charts.map(...)` block and before its closing `</View>`:
```typescript
          <View className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
            <Text className="font-semibold text-gray-700 mb-2">Calorie adherence (last 30 days)</Text>
            <BarChart data={adherence} />
          </View>
```
Note: the `reports.length < 2` empty-state branch stays as-is; when the user has ≥2 scans the adherence chart renders alongside the line charts, and `BarChart` shows its own empty state if there are no daily summaries yet.

- [ ] **Step 11: Typecheck + full test run**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc exit 0; **all** suites pass (auth, profile, meals, chat, dailySummary incl. fetchRecent, macros, activity, inbody, chart incl. adherenceSeries, inbody-api, coachNote, plan, plansStore).

- [ ] **Step 12: expo-doctor**

Run: `npx expo-doctor`
Expected: 21/21 checks pass (no new dependency added).

- [ ] **Step 13: Commit**

```bash
git add lib/utils/chart.ts components/ui/BarChart.tsx stores/dailySummaryStore.ts app/progress.tsx __tests__/lib/chart.test.ts __tests__/stores/dailySummaryStore.test.ts
git commit -m "feat: calorie-adherence BarChart + adherenceSeries helper on the progress screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 Complete

Delivers:
- `meal_plans` + `workout_plans` tables (RLS, append-only / latest-wins) and plan TypeScript types.
- `generate-daily-summary` edge function with cron mode (service-role, all profiles, guarded by `x-cron-secret`) and user/lazy mode (JWT), idempotent upsert on `(user_id, date)`, plus a `pg_cron` schedule at 06:00 UTC via `pg_net` + Vault.
- Dashboard morning coach note with a once-per-session/day lazy fallback and an afternoon low-fuel meal-suggestion card.
- Four new agent tools: `generate_meal_plan`, `generate_workout_plan` (model-supplied `plan_json`, executor persists), `get_progress_report`, `get_meal_suggestion`, plus latest-plan context.
- A `plansStore` and a new **Plans** tab (5 tabs: Home / Meals / Plans / Chat / Settings) showing meal + workout plans with Regenerate (reusing `ai-agent`) and a defensive `plan_json` reader.
- A calorie-adherence `BarChart` (react-native-svg) and pure `adherenceSeries` helper added to the existing `app/progress.tsx`.

**Next:** Phase 2b — Health Connect (Amazfit/Zepp) auto-sync; Phase 4 — push notifications, offline, rate-limiting, Play Store.
