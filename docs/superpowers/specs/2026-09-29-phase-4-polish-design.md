# Phase 4 — Polish & Production (incl. Health Connect): Design Spec

**Status:** Approved design pending user spec review (2026-09-29). Refines the
app-level spec `2026-09-29-health-coach-app-design.md` and folds in the
deferred "Phase 2b" (Health Connect) per user direction.

**Parent spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`
**Builds on:** Phases 1–3 (complete on `master`).

## Goal

Make poshan-ai production-ready and connect real activity data: Health
Connect (Google Fit) sync, push notifications, offline meal logging, an RLS
multi-user audit, AI rate-limiting / cost controls, error monitoring +
analytics, and Play Store preparation.

## Scope decisions (approved)

- **Activity sync = Health Connect** (not the deprecated Google Fit API).
  Read data that Google Fit (and other apps) write into Health Connect.
- **Full Phase 4** scope (all items below), with **Health Connect first**.
- **Health Connect data pulled:** steps, active calories, heart rate,
  workouts/exercise sessions.
- **Error monitoring/analytics = self-hosted in Supabase** (an `error_logs`
  + `events` table), NOT Sentry/an external paid service. (User may swap to
  Sentry later — out of scope now.)
- **Play Store:** this project prepares the production build + metadata +
  `eas submit` config; the Google Play Developer account and the actual
  submission are the user's manual steps.
- Carry all standing rulings: goals/plans append-only; edge fns OpenAI
  gpt-4o + JWT-derived user; private buckets store PATH; charts
  react-native-svg only; typed client, write-site casts only; Zustand+immer
  store discipline (error/loading, screens render errors).

## The build changes to a custom (config-plugin) client

Health Connect and push notifications are **native modules**. The app must
move from the default managed build to a build that includes:
- `react-native-health-connect` + its Expo config plugin (+ the Health
  Connect Android permissions and the `<queries>`/privacy-policy intent the
  Play Store requires for Health Connect).
- `expo-notifications` + Android notification permission + FCM credentials.
The `preview`/`production` EAS profiles already build a real APK/AAB, so the
config plugins take effect on the next EAS build. On-device verification
(Health Connect read, push receipt) is a user step (no emulator path).

## 1. Health Connect activity sync

- **Dependency:** `react-native-health-connect` (+ config plugin in
  `app.json`). New dependency — the one place Phase 4 adds native deps.
- **Permissions/flow:** a new onboarding/settings step requests Health
  Connect read permissions for Steps, ActiveCaloriesBurned, HeartRate, and
  ExerciseSession. Handle "Health Connect not installed / not available"
  gracefully (Android-only; show a fallback message; iOS unaffected — it
  keeps manual logging).
- **Sync:** `stores/healthConnectStore.ts` reads today's (and a small recent
  window's) aggregates on app foreground + a manual "Sync now" button.
  Steps/active-calories feed the dashboard rings (replacing/augmenting
  manual entry for the day); exercise sessions are upserted into
  `activity_logs` (dedup by a stable `source`+time key so re-sync doesn't
  duplicate). Manual activity logging stays as a fallback.
- **Schema:** add `activity_logs.source text not null default 'manual'`
  (`'manual' | 'health_connect'`) + a dedup unique index on
  `(user_id, source, logged_at, activity_type)` for HC-sourced rows so
  re-sync is idempotent. Steps/HR that are aggregates (not discrete
  sessions) update the day's dashboard live rather than inserting rows.

## 2. Push notifications

- **Dependency:** `expo-notifications`. Client registers for a push token on
  login (after permission), stores it in a new `push_tokens` table
  (`user_id, token, platform, created_at`, RLS per-user, unique token).
- **Sending:** server-side via the **Expo Push API** (`https://exp.host/--/
  api/v2/push/send`) from an edge function. The morning cron
  (`generate-daily-summary`) sends the coach note as a push after generating
  it (best-effort, per user token). A new `send-push` helper edge function
  (service-role, cron-secret-guarded like generate-daily-summary) is the
  single send path.
- **FCM credentials:** EAS needs the project's FCM v1 service-account key for
  Android delivery — a one-time user upload (`eas credentials`). Documented,
  flagged as a user step; the code is complete without it.

## 3. Offline meal logging

- `mealsStore` gains an offline queue: when `addMeal` fails due to no
  connectivity, enqueue the meal in AsyncStorage; a `flushQueue` runs on
  reconnect (NetInfo) / app foreground and inserts queued meals in order,
  surfacing per-item errors. Photos captured offline queue the local URI and
  upload on flush. Pure queue logic (enqueue/dequeue/merge) is unit-tested.

## 4. RLS multi-user audit

- Run Supabase advisors (security + performance) via MCP; fix any findings.
- Verify every table's RLS is `auth.uid() = user_id` (using + with check),
  storage policies are per-user-folder, and no table/policy leaks across
  users. Fix the deferred **store-reset-on-signout** gap (auth store clears
  all Zustand stores on sign-out so a second user on the same device can't
  see stale data). Commit any policy changes as a migration.

## 5. AI rate-limiting + cost controls

- A shared per-user daily call budget enforced in the AI edge functions
  (`ai-agent`, `ai-meal-analysis`, `ai-inbody-analysis`, plan generation):
  an `ai_usage(user_id, date, count)` table, incremented per call; when over
  a configurable daily cap, the function returns a friendly 429 and the
  client surfaces "daily AI limit reached." Caps are generous defaults, env-
  configurable. Prevents runaway OpenAI spend.

## 6. Error monitoring + analytics (self-hosted)

- Tables `error_logs(user_id?, context, message, stack?, created_at)` and
  `events(user_id?, name, props jsonb, created_at)` (RLS: insert by
  authenticated user; read restricted). A tiny `lib/telemetry.ts` logs
  client errors (an error boundary + store-action failures) and key events
  (meal logged, plan generated, HC synced). Edge functions log failures to
  `error_logs` via service role. No external service.

## 7. Play Store preparation

- `production` EAS profile builds an **AAB**; app version/versionCode
  strategy (`autoIncrement`) confirmed. Add required store metadata: privacy
  policy URL (Health Connect requires one), app icon/splash (present), a
  `store.config`/`eas submit` profile, and a `docs/play-store-listing.md`
  (title, short/full description, screenshots checklist, data-safety form
  answers incl. Health Connect data types). Actual account + submission =
  user.

## Out of scope (Phase 4)
- Sentry/external monitoring; iOS App Store submission; Apple HealthKit
  (iOS activity sync — a future phase); web build.

## Quality gates
`tsc --noEmit` clean; `jest` all green (new pure/store logic: offline queue,
rate-limit counter, HC dedup/aggregation helpers, telemetry); `expo-doctor`
green. Native modules can't be unit-tested here — Health Connect + push are
verified on a user device via a new EAS build. Security: RLS on all new
tables, per-user push tokens, cron/service-role-guarded send-push, no client
secrets.
