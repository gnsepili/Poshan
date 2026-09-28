# Health Coach App — Design Spec
_Date: 2026-09-29_

---

## 1. Overview

An AI-powered personal health coach mobile app. The AI has full context of the user's health record — InBody scans, meal logs, activity, goals — and acts as a proactive coach: setting daily targets, analysing meals, suggesting workouts, and adjusting the plan over time based on real results.

The app is fully agentic: everything accessible via the UI is also accessible by chatting with the AI. The chat is the primary interface; the UI is a visual shortcut layer.

**Initial target:** Personal use (single user). Designed to scale to multi-user with minimal rework.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile | React Native + Expo (TypeScript) | Cross-platform, Android-first, iOS-ready, large AI tooling ecosystem |
| Backend / DB | Supabase (Postgres + Storage + Auth + Edge Functions) | Managed, low-ops, covers auth + data + file storage + AI proxy |
| AI | Claude / OpenAI / Gemini (switchable via env flag) | Provider-agnostic; keys stored as Supabase secrets, never on device |
| Activity sync | Android Health Connect | Aggregates Amazfit/Zepp data (steps, heart rate, sleep, workouts) |
| State management | Zustand | Lightweight, works well with RN |
| Navigation | Expo Router | File-based routing, familiar pattern |
| Styling | NativeWind (Tailwind for RN) | Fast UI iteration |

---

## 3. Architecture

```
┌─────────────────────────────────────────┐
│          React Native + Expo            │
│                                         │
│   Screens & UI   │   Health Connect     │
│   (visual layer) │   (on-device sync)   │
└─────────┬─────────────────┬─────────────┘
          │                 │
          ▼                 ▼
┌──────────────────────────────────────────┐
│                Supabase                  │
│                                          │
│  Postgres DB   │   Storage               │
│  (all records) │   (meal photos,         │
│                │    InBody files)        │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │         Edge Functions           │    │
│  │                                  │    │
│  │  /ai/agent   — agentic loop,     │    │
│  │               tool execution     │    │
│  │  /ai/meal    — photo → macros    │    │
│  │  /ai/inbody  — file → metrics    │    │
│  │  /health/sync— write HC data     │    │
│  │                                  │    │
│  │  AI_PROVIDER = claude|openai|    │    │
│  │               gemini (env flag)  │    │
│  │  API keys → Supabase secrets     │    │
│  └──────────────────────────────────┘    │
└──────────────────┬───────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │    AI Provider      │
        │  (your API key,     │
        │   env secret)       │
        └─────────────────────┘
```

### Agent Loop (Edge Function: `/ai/agent`)

1. Request arrives with `user_id` + `message` + `conversation_id`
2. Edge Function assembles context: profile, today's goals, recent meals, latest InBody, activity summary
3. Calls AI with context + tool definitions + conversation history
4. AI returns tool call or text response
5. If tool call: Edge Function executes against Supabase, feeds result back to AI
6. Loop until AI returns a final text response
7. Response + any tool results saved to `chat_messages`, returned to app

---

## 4. Data Model

### `profiles`
```sql
id uuid references auth.users
age int
sex text -- 'male' | 'female' | 'other'
height_cm float
current_weight_kg float
activity_level text -- 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
lifestyle_notes text
health_conditions text
treatment_duration_months int
created_at timestamptz
updated_at timestamptz
```

### `goals`
```sql
id uuid
user_id uuid
target_weight_kg float
target_body_fat_pct float
target_muscle_mass_kg float
daily_calorie_target int
daily_protein_g int
daily_carbs_g int
daily_fat_g int
daily_steps_target int
notes text
created_at timestamptz
```

### `inbody_reports`
```sql
id uuid
user_id uuid
scan_date date
file_url text -- Supabase Storage path
weight_kg float
body_fat_pct float
muscle_mass_kg float
body_water_pct float
bmi float
bmr_kcal int
visceral_fat_level int
raw_extracted_json jsonb -- full OCR output
ai_commentary text -- AI analysis of this scan vs previous
created_at timestamptz
```

### `meals`
```sql
id uuid
user_id uuid
logged_at timestamptz
meal_type text -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
photo_url text
description text
total_calories int
protein_g float
carbs_g float
fat_g float
fiber_g float
ai_suggestions text -- post-meal suggestions from AI
created_at timestamptz
```

### `activity_logs`
```sql
id uuid
user_id uuid
logged_at timestamptz
source text -- 'manual' | 'health_connect'
activity_type text -- 'walk' | 'run' | 'gym' | 'cycle' | ...
duration_mins int
calories_burned int
steps int
heart_rate_avg int
created_at timestamptz
```

### `daily_summaries`
```sql
id uuid
user_id uuid
date date
total_calories_consumed int
total_protein_g float
total_carbs_g float
total_fat_g float
total_steps int
weight_kg float -- if user logged weight that day
ai_daily_goals jsonb -- {calories, protein, steps, workout_suggestion}
ai_coach_note text -- morning message from the coach
created_at timestamptz
```

### `chat_messages`
```sql
id uuid
user_id uuid
conversation_id uuid
role text -- 'user' | 'assistant'
content text
tool_calls jsonb -- tool calls made in this turn (for traceability)
context_snapshot jsonb -- health context at time of message
created_at timestamptz
```

---

## 5. AI Agent Tools

All app actions are exposed as agent tools. The UI and the chat agent call the same underlying functions via Edge Functions.

| Tool | Description |
|---|---|
| `log_meal` | Log a meal; accepts description and optional photo URL; AI calculates macros |
| `get_daily_summary` | Get today's (or any date's) calorie, macro, steps summary |
| `get_goals` | Retrieve current targets |
| `update_goals` | Modify calorie/macro/step targets |
| `log_activity` | Record a workout or activity manually |
| `get_inbody_history` | List InBody scans with key metrics |
| `upload_inbody_report` | Trigger OCR + extraction on an uploaded file |
| `generate_meal_plan` | Create a weekly meal plan aligned to goals |
| `generate_workout_plan` | Create a workout plan aligned to goals and activity level |
| `get_progress_report` | Trend data: weight, body fat, calories over a date range |
| `adjust_diet_plan` | AI re-evaluates and updates calorie/macro targets based on recent InBody or stalled progress |
| `get_meal_suggestion` | Suggest a meal for the next eating event given remaining macros |

---

## 6. Screens

### Onboarding (one-time)
- Step 1: Basic health info (age, sex, height, weight, activity level)
- Step 2: Goals (target weight, body fat %, timeline)
- Step 3: Health conditions / treatment context
- Step 4: Health Connect permission grant
- Step 5: AI model selection + first daily goal generation

### Home / Dashboard
- Daily progress rings: calories consumed vs target, protein, steps
- AI coach note (generated each morning)
- Quick actions: Log Meal, Log Activity, Open Chat
- Today's meal log summary
- Today's activity summary

### Chat
- Full-screen chat interface
- Supports text + photo attachments (for meal logging via chat)
- Agent has access to all tools
- Conversation history grouped by day
- Long-term context: daily summaries are compressed and included in context

### Meal Log
- Photo capture or manual description
- AI returns: macro breakdown, meal score, suggestions
- Daily meal history with macro totals
- Tap any meal to see AI suggestions

### Activity
- Manual log form
- Health Connect sync status + last synced timestamp
- Step count, active minutes, heart rate graph (from Zepp via Health Connect)
- Workout history list

### InBody
- Upload button (photo or PDF)
- Processing state → extracted metrics displayed
- Timeline chart: weight, body fat %, muscle mass across all scans
- AI commentary per scan vs previous scan

### Plans
- Weekly meal plan (regenerable via chat or button)
- Weekly workout plan
- Each plan item shows macros / duration / instructions

### Progress
- Line charts: weight, body fat %, muscle mass over time
- Calorie adherence bar chart (daily consumed vs target)
- InBody scan comparison: pick two dates, see delta

### Settings
- Edit profile
- Edit goals
- AI model selector (claude / openai / gemini)
- Health Connect sync management
- Notification preferences

---

## 7. Health Connect / Amazfit Integration

- The app requests Health Connect permissions on onboarding: steps, heart rate, sleep, active calories, workouts
- Amazfit/Zepp app syncs its data to Health Connect automatically (no direct Amazfit API needed)
- The app reads Health Connect on foreground resume + once daily background sync
- Synced data is written to `activity_logs` with `source = 'health_connect'`
- De-duplication by `(user_id, logged_at, source)` to prevent double-counting

---

## 8. InBody Report Processing

1. User uploads photo or PDF via app or chat
2. File stored in Supabase Storage
3. Edge Function `/ai/inbody` is called with the file URL
4. AI (vision-capable model) reads the image/PDF and extracts structured metrics
5. Extracted JSON saved to `inbody_reports.raw_extracted_json`
6. Normalised fields (weight, body fat %, etc.) saved to typed columns
7. AI compares with previous scan → generates `ai_commentary`
8. If significant change (body fat ↑, muscle ↓), agent proactively suggests goal adjustment

---

## 9. Security

- Supabase Row Level Security (RLS) on all tables: users can only read/write their own rows
- AI API keys stored as Supabase Edge Function secrets — never exposed to client
- Meal photos and InBody files stored in private Supabase Storage buckets — accessed via signed URLs with short expiry
- Health Connect data stays on-device until explicitly synced; no raw sensor data persisted beyond what's needed

---

## 10. Phasing

### Phase 1 — Core Loop (MVP)
- Onboarding + profile
- Meal logging (photo + text) with AI macro analysis
- Daily summary + calorie tracking
- AI chat agent with core tools (log_meal, get_daily_summary, get_goals)
- Basic home dashboard

### Phase 2 — Health Tracking
- InBody upload + OCR + timeline
- Health Connect sync (Amazfit/steps/heart rate)
- Activity logging (manual + synced)
- AI goal adjustment based on InBody results

### Phase 3 — Coaching Intelligence
- AI-generated daily goals (morning coach note)
- Meal plan generation
- Workout plan generation
- Progress charts + trend analysis
- Diet plan auto-adjustment

### Phase 4 — Polish + Multi-user Readiness
- Push notifications (daily goal reminder, meal log prompts)
- Offline support for meal logging
- Multi-user auth hardening + RLS audit
- App Store / Play Store preparation
