# Phase 1: Core Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working MVP — onboarding, meal logging with AI macro analysis, AI chat agent with tool calling, and a daily dashboard.

**Architecture:** React Native + Expo Router app backed by Supabase (Postgres + Storage + Edge Functions). All AI calls go through Supabase Edge Functions using a server-side API key (never exposed to the client). An agentic loop in the Edge Function handles tool calling so the chat agent can log meals, retrieve summaries, and read/update goals.

**Tech Stack:** React Native, Expo SDK 52+, Expo Router v4, TypeScript (strict), NativeWind v4, Zustand v5, Supabase JS v2, Supabase Edge Functions (Deno), Jest + React Native Testing Library

**Spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`

## Global Constraints

- Android API 26+ (Android 8.0) minimum; iOS 16+ compatible from the start
- TypeScript strict mode — no `any`, no implicit returns
- All Supabase tables must have RLS enabled; no table is readable without an authenticated user
- AI API keys stored only as Supabase Edge Function secrets — never in `.env`, never in client code, never committed to git
- NativeWind v4 (Tailwind v3 syntax)
- Zustand v5 with `immer` middleware for all stores
- Every store action that touches Supabase must handle errors and set an `error` field in state

---

## File Structure

```
cal-app/
├── app/
│   ├── _layout.tsx                  # Root layout, auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── profile.tsx              # Step 1: health info
│   │   ├── goals.tsx                # Step 2: targets
│   │   └── ai-setup.tsx             # Step 3: AI model choice
│   └── (tabs)/
│       ├── _layout.tsx              # Bottom tab navigator
│       ├── index.tsx                # Home / Dashboard
│       ├── chat.tsx                 # AI Chat
│       ├── meals.tsx                # Meal Log
│       └── settings.tsx             # Settings
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ProgressRing.tsx         # SVG calorie/macro ring
│   │   ├── MacroBar.tsx             # Horizontal macro breakdown bar
│   │   └── TextInput.tsx
│   ├── chat/
│   │   ├── ChatMessage.tsx          # Single message bubble
│   │   └── ChatInput.tsx            # Text + attach photo input
│   └── meals/
│       ├── MealCard.tsx             # Single meal summary card
│       └── MealPhotoCapture.tsx     # Camera / gallery picker
├── lib/
│   ├── supabase.ts                  # Supabase client singleton
│   ├── api/
│   │   ├── agent.ts                 # Calls /functions/v1/ai-agent
│   │   └── mealAnalysis.ts          # Calls /functions/v1/ai-meal-analysis
│   └── utils/
│       └── macros.ts                # Macro math helpers
├── stores/
│   ├── authStore.ts
│   ├── profileStore.ts
│   ├── mealsStore.ts
│   ├── chatStore.ts
│   └── dailySummaryStore.ts
├── types/
│   └── index.ts                     # All shared TS types
├── supabase/
│   ├── migrations/
│   │   └── 20260929000000_phase1_schema.sql
│   └── functions/
│       ├── ai-agent/
│       │   ├── index.ts             # Agentic loop entry point
│       │   ├── tools.ts             # Tool definitions + executors
│       │   └── context.ts           # Context assembler
│       └── ai-meal-analysis/
│           └── index.ts
├── __tests__/
│   ├── stores/
│   │   ├── authStore.test.ts
│   │   ├── profileStore.test.ts
│   │   ├── mealsStore.test.ts
│   │   └── chatStore.test.ts
│   ├── lib/
│   │   └── macros.test.ts
│   └── components/
│       └── MealCard.test.tsx
├── app.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── tsconfig.json
├── jest.config.js
└── .env.local                       # gitignored — SUPABASE_URL + SUPABASE_ANON_KEY only
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `jest.config.js`
- Create: `lib/supabase.ts`
- Create: `types/index.ts`
- Create: `.env.local` (gitignored)
- Create: `.gitignore`

**Interfaces:**
- Produces: `supabase` client from `lib/supabase.ts` — used by all stores and API callers
- Produces: Core types from `types/index.ts` — `Profile`, `Goal`, `Meal`, `MealItem`, `ChatMessage`, `DailySummary`, `AiProvider`

- [ ] **Step 1: Bootstrap Expo project**

```bash
npx create-expo-app@latest . --template blank-typescript
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-router expo-camera expo-image-picker expo-file-system
npm install @supabase/supabase-js zustand immer
npm install nativewind
npm install --save-dev tailwindcss@3 jest @testing-library/react-native @types/jest jest-expo
```

- [ ] **Step 3: Configure NativeWind**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
}
```

`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}
```

- [ ] **Step 4: Configure Expo Router in `app.json`**

```json
{
  "expo": {
    "name": "cal-app",
    "slug": "cal-app",
    "scheme": "cal-app",
    "version": "1.0.0",
    "platforms": ["android", "ios"],
    "android": { "adaptiveIcon": { "backgroundColor": "#ffffff" } },
    "plugins": ["expo-router", "expo-camera"]
  }
}
```

- [ ] **Step 5: Write core TypeScript types** in `types/index.ts`

```typescript
export type AiProvider = 'claude' | 'openai' | 'gemini'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ChatRole = 'user' | 'assistant'

export interface Profile {
  id: string
  age: number
  sex: string
  height_cm: number
  current_weight_kg: number
  activity_level: ActivityLevel
  lifestyle_notes: string
  health_conditions: string
  treatment_duration_months: number
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  target_weight_kg: number
  target_body_fat_pct: number
  target_muscle_mass_kg: number
  daily_calorie_target: number
  daily_protein_g: number
  daily_carbs_g: number
  daily_fat_g: number
  daily_steps_target: number
  notes: string
  created_at: string
}

export interface Meal {
  id: string
  user_id: string
  logged_at: string
  meal_type: MealType
  photo_url: string | null
  description: string
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  ai_suggestions: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  conversation_id: string
  role: ChatRole
  content: string
  tool_calls: unknown | null
  created_at: string
}

export interface DailySummary {
  id: string
  user_id: string
  date: string
  total_calories_consumed: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_steps: number
  weight_kg: number | null
  ai_daily_goals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    steps: number
    workout_suggestion: string
  } | null
  ai_coach_note: string | null
  created_at: string
}
```

- [ ] **Step 6: Create Supabase client** in `lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types' // generated after migration

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

- [ ] **Step 7: Create `.env.local`** (never commit this file)

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 8: Add `.env.local` to `.gitignore`**

```
.env.local
.env*.local
node_modules/
.expo/
```

- [ ] **Step 9: Configure Jest** in `jest.config.js`

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/react-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind)',
  ],
}
```

- [ ] **Step 10: Verify project boots**

```bash
npx expo start --android
```
Expected: Metro bundler starts, app loads on device/emulator.

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat: scaffold Expo + TypeScript + NativeWind + Supabase project"
```

---

### Task 2: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/20260929000000_phase1_schema.sql`

**Interfaces:**
- Produces: Tables `profiles`, `goals`, `meals`, `daily_summaries`, `chat_messages` with RLS
- Produces: Storage buckets `meal-photos` (private)

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260929000000_phase1_schema.sql`:
```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  age int not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  height_cm float not null,
  current_weight_kg float not null,
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  lifestyle_notes text not null default '',
  health_conditions text not null default '',
  treatment_duration_months int not null default 0,
  ai_provider text not null default 'claude' check (ai_provider in ('claude', 'openai', 'gemini')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- Goals
create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  target_weight_kg float not null,
  target_body_fat_pct float,
  target_muscle_mass_kg float,
  daily_calorie_target int not null,
  daily_protein_g int not null,
  daily_carbs_g int not null,
  daily_fat_g int not null,
  daily_steps_target int not null default 8000,
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "Users manage own goals" on goals
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meals
create table meals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  logged_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  photo_url text,
  description text not null default '',
  total_calories int not null default 0,
  protein_g float not null default 0,
  carbs_g float not null default 0,
  fat_g float not null default 0,
  fiber_g float not null default 0,
  ai_suggestions text,
  created_at timestamptz not null default now()
);
alter table meals enable row level security;
create policy "Users manage own meals" on meals
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily summaries
create table daily_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  total_calories_consumed int not null default 0,
  total_protein_g float not null default 0,
  total_carbs_g float not null default 0,
  total_fat_g float not null default 0,
  total_steps int not null default 0,
  weight_kg float,
  ai_daily_goals jsonb,
  ai_coach_note text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);
alter table daily_summaries enable row level security;
create policy "Users manage own summaries" on daily_summaries
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat messages
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb,
  context_snapshot jsonb,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
create policy "Users manage own messages" on chat_messages
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-update profiles.updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();
```

- [ ] **Step 2: Apply migration locally**

```bash
npx supabase db push
```
Expected: Migration applied with no errors.

- [ ] **Step 3: Create meal-photos storage bucket**

In Supabase dashboard → Storage → New bucket: `meal-photos`, set to private.

Or via SQL:
```sql
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false);
create policy "Auth users upload meal photos" on storage.objects
  for insert with check (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own meal photos" on storage.objects
  for select using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 4: Generate TypeScript types from schema**

```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/ lib/database.types.ts
git commit -m "feat: add Phase 1 Supabase schema with RLS"
```

---

### Task 3: Auth Flow

**Files:**
- Create: `stores/authStore.ts`
- Create: `app/_layout.tsx`
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/register.tsx`
- Create: `__tests__/stores/authStore.test.ts`

**Interfaces:**
- Produces: `useAuthStore` — `{ session, user, loading, error, signIn, signUp, signOut }`
- Consumes: `supabase` from `lib/supabase.ts`

- [ ] **Step 1: Write failing auth store test**

`__tests__/stores/authStore.test.ts`:
```typescript
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}))

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ session: null, user: null, loading: false, error: null }))

  it('sets error on failed sign in', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid credentials' },
    })
    await useAuthStore.getState().signIn('a@b.com', 'wrong')
    expect(useAuthStore.getState().error).toBe('Invalid credentials')
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('sets session on successful sign in', async () => {
    const mockSession = { user: { id: 'user-1', email: 'a@b.com' } }
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    await useAuthStore.getState().signIn('a@b.com', 'password')
    expect(useAuthStore.getState().session).toEqual(mockSession)
    expect(useAuthStore.getState().error).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/stores/authStore.test.ts
```
Expected: FAIL — `authStore` module not found.

- [ ] **Step 3: Implement auth store**

`stores/authStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<() => void>
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    session: null,
    user: null,
    loading: false,
    error: null,

    signIn: async (email, password) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      set((s) => {
        s.loading = false
        s.session = data.session
        s.user = data.session?.user ?? null
        s.error = error?.message ?? null
      })
    },

    signUp: async (email, password) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase.auth.signUp({ email, password })
      set((s) => {
        s.loading = false
        s.session = data.session
        s.user = data.session?.user ?? null
        s.error = error?.message ?? null
      })
    },

    signOut: async () => {
      await supabase.auth.signOut()
      set((s) => { s.session = null; s.user = null })
    },

    initialize: async () => {
      const { data } = await supabase.auth.getSession()
      set((s) => {
        s.session = data.session
        s.user = data.session?.user ?? null
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set((s) => { s.session = session; s.user = session?.user ?? null })
      })
      return () => subscription.unsubscribe()
    },
  }))
)
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/stores/authStore.test.ts
```
Expected: PASS

- [ ] **Step 5: Build root layout with auth gate**

`app/_layout.tsx`:
```typescript
import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../stores/authStore'

export default function RootLayout() {
  const { session, initialize } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const cleanup = initialize()
    return () => { cleanup.then(fn => fn()) }
  }, [])

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'
    if (!session && !inAuthGroup) router.replace('/(auth)/login')
    if (session && inAuthGroup) router.replace('/(tabs)')
  }, [session, segments])

  return <Slot />
}
```

- [ ] **Step 6: Build login screen**

`app/(auth)/login.tsx`:
```typescript
import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, loading, error } = useAuthStore()

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold mb-8 text-gray-900">Sign in</Text>
      {error && <Text className="text-red-500 mb-4">{error}</Text>}
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        className="bg-green-600 rounded-lg py-4 items-center"
        onPress={() => signIn(email, password)}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Sign in</Text>}
      </Pressable>
      <Link href="/(auth)/register" className="text-center mt-4 text-green-600">
        No account? Register
      </Link>
    </View>
  )
}
```

- [ ] **Step 7: Build register screen**

`app/(auth)/register.tsx` — same structure as login, calls `signUp` instead.

```typescript
import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp, loading, error } = useAuthStore()

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold mb-8 text-gray-900">Create account</Text>
      {error && <Text className="text-red-500 mb-4">{error}</Text>}
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        className="bg-green-600 rounded-lg py-4 items-center"
        onPress={() => signUp(email, password)}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Create account</Text>}
      </Pressable>
      <Link href="/(auth)/login" className="text-center mt-4 text-green-600">
        Already have an account? Sign in
      </Link>
    </View>
  )
}
```

- [ ] **Step 8: Verify auth flow on device**

Run on Android emulator. Sign up with a test email. Confirm redirect to `(tabs)` after sign in. Confirm redirect to `(auth)/login` after sign out.

- [ ] **Step 9: Commit**

```bash
git add app/ stores/authStore.ts __tests__/stores/authStore.test.ts
git commit -m "feat: add Supabase auth flow with login and register screens"
```

---

### Task 4: Onboarding Flow

**Files:**
- Create: `stores/profileStore.ts`
- Create: `app/(onboarding)/_layout.tsx`
- Create: `app/(onboarding)/profile.tsx`
- Create: `app/(onboarding)/goals.tsx`
- Create: `app/(onboarding)/ai-setup.tsx`
- Create: `__tests__/stores/profileStore.test.ts`

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts`, `Profile` and `Goal` from `types/index.ts`
- Produces: `useProfileStore` — `{ profile, goals, loading, error, fetchProfile, upsertProfile, upsertGoals }`

- [ ] **Step 1: Write failing profile store test**

`__tests__/stores/profileStore.test.ts`:
```typescript
import { useProfileStore } from '../../stores/profileStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = (data: unknown, error: unknown = null) => {
  const chain = { select: jest.fn(), upsert: jest.fn(), eq: jest.fn(), single: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('profileStore', () => {
  beforeEach(() => useProfileStore.setState({ profile: null, goals: null, loading: false, error: null }))

  it('sets error when fetch fails', async () => {
    mockFrom(null, { message: 'not found' })
    await useProfileStore.getState().fetchProfile('user-1')
    expect(useProfileStore.getState().error).toBe('not found')
  })

  it('sets profile when fetch succeeds', async () => {
    const mockProfile = { id: 'user-1', age: 30, sex: 'male' }
    mockFrom(mockProfile)
    await useProfileStore.getState().fetchProfile('user-1')
    expect(useProfileStore.getState().profile).toEqual(mockProfile)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/stores/profileStore.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement profile store**

`stores/profileStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Profile, Goal } from '../types'

interface ProfileState {
  profile: Profile | null
  goals: Goal | null
  loading: boolean
  error: string | null
  fetchProfile: (userId: string) => Promise<void>
  upsertProfile: (profile: Partial<Profile> & { id: string }) => Promise<void>
  upsertGoals: (goals: Partial<Goal> & { user_id: string }) => Promise<void>
}

export const useProfileStore = create<ProfileState>()(
  immer((set) => ({
    profile: null,
    goals: null,
    loading: false,
    error: null,

    fetchProfile: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      set((s) => {
        s.loading = false
        s.profile = error ? null : (data as Profile)
        s.error = error?.message ?? null
      })
    },

    upsertProfile: async (profile) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profile)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error) s.profile = data as Profile
        s.error = error?.message ?? null
      })
    },

    upsertGoals: async (goals) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('goals')
        .upsert(goals)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error) s.goals = data as Goal
        s.error = error?.message ?? null
      })
    },
  }))
)
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/stores/profileStore.test.ts
```
Expected: PASS

- [ ] **Step 5: Build onboarding profile screen**

`app/(onboarding)/profile.tsx`:
```typescript
import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { ActivityLevel } from '../../types'

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

export default function OnboardingProfileScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { upsertProfile, loading } = useProfileStore()
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')

  const handleNext = async () => {
    if (!user) return
    await upsertProfile({
      id: user.id,
      age: parseInt(age, 10),
      sex,
      height_cm: parseFloat(heightCm),
      current_weight_kg: parseFloat(weightKg),
      activity_level: activityLevel,
    })
    router.push('/(onboarding)/goals')
  }

  return (
    <ScrollView className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold mb-6 text-gray-900">Your health profile</Text>
      <Text className="text-gray-600 mb-1">Age</Text>
      <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" keyboardType="number-pad" value={age} onChangeText={setAge} placeholder="e.g. 28" />
      <Text className="text-gray-600 mb-1">Sex</Text>
      <View className="flex-row gap-2 mb-4">
        {(['male', 'female', 'other'] as const).map(s => (
          <Pressable key={s} onPress={() => setSex(s)} className={`flex-1 py-3 rounded-lg border items-center ${sex === s ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
            <Text className={sex === s ? 'text-white' : 'text-gray-700'}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-gray-600 mb-1">Height (cm)</Text>
      <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} placeholder="e.g. 175" />
      <Text className="text-gray-600 mb-1">Current weight (kg)</Text>
      <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 75" />
      <Text className="text-gray-600 mb-1">Activity level</Text>
      <View className="gap-2 mb-8">
        {ACTIVITY_LEVELS.map(level => (
          <Pressable key={level} onPress={() => setActivityLevel(level)} className={`py-3 px-4 rounded-lg border ${activityLevel === level ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
            <Text className={activityLevel === level ? 'text-white' : 'text-gray-700'}>{level}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-8" onPress={handleNext} disabled={loading}>
        <Text className="text-white font-semibold text-base">Next: Set goals</Text>
      </Pressable>
    </ScrollView>
  )
}
```

- [ ] **Step 6: Build goals screen**

`app/(onboarding)/goals.tsx` — collects `target_weight_kg`, `daily_calorie_target`, `daily_protein_g`, `daily_carbs_g`, `daily_fat_g`, `daily_steps_target`. On submit, calls `upsertGoals` then navigates to `/(onboarding)/ai-setup`.

```typescript
import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'

export default function OnboardingGoalsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { upsertGoals, loading } = useProfileStore()
  const [targetWeight, setTargetWeight] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [steps, setSteps] = useState('8000')

  const handleNext = async () => {
    if (!user) return
    await upsertGoals({
      user_id: user.id,
      target_weight_kg: parseFloat(targetWeight),
      daily_calorie_target: parseInt(calories, 10),
      daily_protein_g: parseInt(protein, 10),
      daily_carbs_g: parseInt(carbs, 10),
      daily_fat_g: parseInt(fat, 10),
      daily_steps_target: parseInt(steps, 10),
    })
    router.push('/(onboarding)/ai-setup')
  }

  return (
    <ScrollView className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold mb-6 text-gray-900">Your goals</Text>
      {[
        { label: 'Target weight (kg)', value: targetWeight, setter: setTargetWeight },
        { label: 'Daily calories (kcal)', value: calories, setter: setCalories },
        { label: 'Protein (g)', value: protein, setter: setProtein },
        { label: 'Carbs (g)', value: carbs, setter: setCarbs },
        { label: 'Fat (g)', value: fat, setter: setFat },
        { label: 'Daily steps', value: steps, setter: setSteps },
      ].map(({ label, value, setter }) => (
        <View key={label} className="mb-4">
          <Text className="text-gray-600 mb-1">{label}</Text>
          <TextInput className="border border-gray-300 rounded-lg px-4 py-3" keyboardType="decimal-pad" value={value} onChangeText={setter} />
        </View>
      ))}
      <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-8 mt-4" onPress={handleNext} disabled={loading}>
        <Text className="text-white font-semibold text-base">Next: AI setup</Text>
      </Pressable>
    </ScrollView>
  )
}
```

- [ ] **Step 7: Build AI setup screen**

`app/(onboarding)/ai-setup.tsx` — shows 3 options (Claude / OpenAI / Gemini), saves chosen `ai_provider` to profile via `upsertProfile`, then navigates to `/(tabs)`.

```typescript
import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { AiProvider } from '../../types'

const PROVIDERS: { id: AiProvider; label: string; description: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', description: 'Best reasoning and nuanced health advice' },
  { id: 'openai', label: 'GPT-4o (OpenAI)', description: 'Great all-round performance' },
  { id: 'gemini', label: 'Gemini (Google)', description: 'Fast and capable' },
]

export default function AiSetupScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { upsertProfile, loading } = useProfileStore()
  const [selected, setSelected] = useState<AiProvider>('claude')

  const handleFinish = async () => {
    if (!user) return
    await upsertProfile({ id: user.id, ai_provider: selected })
    router.replace('/(tabs)')
  }

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold mb-2 text-gray-900">Choose your AI</Text>
      <Text className="text-gray-500 mb-6">This powers your health coach. You can change it later in settings.</Text>
      {PROVIDERS.map(p => (
        <Pressable key={p.id} onPress={() => setSelected(p.id)} className={`p-4 rounded-xl border mb-3 ${selected === p.id ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
          <Text className="font-semibold text-gray-900">{p.label}</Text>
          <Text className="text-gray-500 text-sm mt-1">{p.description}</Text>
        </Pressable>
      ))}
      <Pressable className="bg-green-600 rounded-lg py-4 items-center mt-6" onPress={handleFinish} disabled={loading}>
        <Text className="text-white font-semibold text-base">Start coaching</Text>
      </Pressable>
    </View>
  )
}
```

- [ ] **Step 8: Wire onboarding into root layout**

Update `app/_layout.tsx` — after `session` is set, check if `profile` exists. If not, redirect to `/(onboarding)/profile` instead of `/(tabs)`.

- [ ] **Step 9: Commit**

```bash
git add app/(onboarding)/ stores/profileStore.ts __tests__/stores/profileStore.test.ts
git commit -m "feat: add onboarding flow (profile, goals, AI model selection)"
```

---

### Task 5: Edge Function — AI Agent

**Files:**
- Create: `supabase/functions/ai-agent/index.ts`
- Create: `supabase/functions/ai-agent/tools.ts`
- Create: `supabase/functions/ai-agent/context.ts`

**Interfaces:**
- Consumes: Supabase service role client (server-side, full DB access)
- Produces: `POST /functions/v1/ai-agent` → `{ reply: string, conversation_id: string }`
- Request body: `{ user_id: string, message: string, conversation_id?: string, photo_url?: string }`

- [ ] **Step 1: Set Edge Function secrets in Supabase**

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set GEMINI_API_KEY=...
```

- [ ] **Step 2: Write tool definitions and executors** in `supabase/functions/ai-agent/tools.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const TOOL_DEFINITIONS = [
  {
    name: 'log_meal',
    description: 'Log a meal the user just ate. Calculates macros from description and optional photo.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Text description of the meal' },
        meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        photo_url: { type: 'string', description: 'Supabase Storage URL of meal photo (optional)' },
        total_calories: { type: 'number' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
        fiber_g: { type: 'number' },
      },
      required: ['description', 'meal_type', 'total_calories', 'protein_g', 'carbs_g', 'fat_g'],
    },
  },
  {
    name: 'get_daily_summary',
    description: 'Get the calorie, macro, and step summary for a specific date (defaults to today).',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date string YYYY-MM-DD, defaults to today' },
      },
    },
  },
  {
    name: 'get_goals',
    description: "Get the user's current calorie, macro, and step targets.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'update_goals',
    description: "Update the user's daily targets.",
    input_schema: {
      type: 'object',
      properties: {
        daily_calorie_target: { type: 'number' },
        daily_protein_g: { type: 'number' },
        daily_carbs_g: { type: 'number' },
        daily_fat_g: { type: 'number' },
        daily_steps_target: { type: 'number' },
      },
    },
  },
]

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  if (name === 'log_meal') {
    const { error } = await supabase.from('meals').insert({
      user_id: userId,
      meal_type: input.meal_type,
      description: input.description,
      photo_url: input.photo_url ?? null,
      total_calories: input.total_calories,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      fiber_g: input.fiber_g ?? 0,
      logged_at: new Date().toISOString(),
    })
    if (error) return `Error logging meal: ${error.message}`
    return `Meal logged: ${input.description} — ${input.total_calories} kcal, ${input.protein_g}g protein, ${input.carbs_g}g carbs, ${input.fat_g}g fat`
  }

  if (name === 'get_daily_summary') {
    const date = (input.date as string) ?? new Date().toISOString().split('T')[0]
    const { data: meals } = await supabase
      .from('meals')
      .select('total_calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('logged_at', `${date}T00:00:00`)
      .lte('logged_at', `${date}T23:59:59`)
    const totals = (meals ?? []).reduce(
      (acc, m) => ({
        calories: acc.calories + m.total_calories,
        protein: acc.protein + m.protein_g,
        carbs: acc.carbs + m.carbs_g,
        fat: acc.fat + m.fat_g,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
    return JSON.stringify({ date, ...totals })
  }

  if (name === 'get_goals') {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error) return `No goals found: ${error.message}`
    return JSON.stringify(data)
  }

  if (name === 'update_goals') {
    const { data: existing } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    const { error } = await supabase.from('goals').upsert({ ...existing, ...input, user_id: userId })
    if (error) return `Error updating goals: ${error.message}`
    return 'Goals updated successfully.'
  }

  return `Unknown tool: ${name}`
}
```

- [ ] **Step 3: Write context assembler** in `supabase/functions/ai-agent/context.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function assembleContext(userId: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const [profileRes, goalsRes, mealsRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('meals').select('*').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`),
    supabase.from('daily_summaries').select('date, total_calories_consumed, ai_coach_note').eq('user_id', userId).order('date', { ascending: false }).limit(7),
  ])

  const todayCalories = (mealsRes.data ?? []).reduce((sum, m) => sum + m.total_calories, 0)

  return `
## User Health Context
Profile: ${JSON.stringify(profileRes.data)}
Current Goals: ${JSON.stringify(goalsRes.data)}
Today's meals (${today}): ${JSON.stringify(mealsRes.data)}
Today's calories so far: ${todayCalories} kcal
Last 7 days summaries: ${JSON.stringify(historyRes.data)}
`.trim()
}
```

- [ ] **Step 4: Write the agentic loop** in `supabase/functions/ai-agent/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'
import { TOOL_DEFINITIONS, executeTool } from './tools.ts'
import { assembleContext } from './context.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })

  const { user_id, message, conversation_id } = await req.json()
  const convId = conversation_id ?? crypto.randomUUID()

  // Save user message
  await supabase.from('chat_messages').insert({ user_id, conversation_id: convId, role: 'user', content: message })

  // Fetch conversation history (last 20 messages)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(20)

  const systemContext = await assembleContext(user_id, supabase)
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  const messages = (history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Agentic loop — max 5 tool-call rounds
  let reply = ''
  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: `You are a personal AI health coach. You have access to the user's full health data.\n\n${systemContext}`,
      tools: TOOL_DEFINITIONS as Anthropic.Tool[],
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      reply = response.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('')
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      messages.push({ role: 'assistant', content: response.content as string })

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input as Record<string, unknown>, user_id, supabase),
        }))
      )
      messages.push({ role: 'user', content: toolResults })
    }
  }

  // Save assistant reply
  await supabase.from('chat_messages').insert({ user_id, conversation_id: convId, role: 'assistant', content: reply })

  return new Response(JSON.stringify({ reply, conversation_id: convId }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
```

- [ ] **Step 5: Deploy Edge Function**

```bash
npx supabase functions deploy ai-agent
```

- [ ] **Step 6: Smoke test via curl**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ai-agent \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"your-test-user-id","message":"What have I eaten today?"}'
```
Expected: JSON response with a `reply` string.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ai-agent/
git commit -m "feat: add AI agent Edge Function with tool calling (log_meal, get_daily_summary, get_goals, update_goals)"
```

---

### Task 6: Edge Function — Meal Photo Analysis

**Files:**
- Create: `supabase/functions/ai-meal-analysis/index.ts`

**Interfaces:**
- Request body: `{ photo_url: string, description?: string }`
- Response: `{ calories: number, protein_g: number, carbs_g: number, fat_g: number, fiber_g: number, suggestions: string, items: string[] }`

- [ ] **Step 1: Write the Edge Function**

`supabase/functions/ai-meal-analysis/index.ts`:
```typescript
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })

  const { photo_url, description } = await req.json()

  // Get signed URL for private storage object
  const path = photo_url.split('/meal-photos/')[1]
  const { data: signed } = await supabase.storage.from('meal-photos').createSignedUrl(path, 60)

  const prompt = `Analyse this meal photo${description ? ` (user says: "${description}")` : ''}. Return ONLY a JSON object with these exact fields:
{
  "items": ["item1", "item2"],
  "total_calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "suggestions": "one sentence suggestion for a healthier version"
}
Be conservative with estimates. If unsure, estimate slightly lower.`

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: signed!.signedUrl } },
        { type: 'text', text: prompt },
      ],
    }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, suggestions: '', items: [] }

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy ai-meal-analysis
```

- [ ] **Step 3: Smoke test with a real meal photo URL**

Upload a photo to Supabase Storage, then:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ai-meal-analysis \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"photo_url":"your-storage-url"}'
```
Expected: JSON with calorie and macro numbers.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-meal-analysis/
git commit -m "feat: add meal photo analysis Edge Function with AI vision"
```

---

### Task 7: Meal Logging Feature

**Files:**
- Create: `stores/mealsStore.ts`
- Create: `lib/api/mealAnalysis.ts`
- Create: `components/meals/MealPhotoCapture.tsx`
- Create: `components/meals/MealCard.tsx`
- Create: `app/(tabs)/meals.tsx`
- Create: `__tests__/stores/mealsStore.test.ts`

**Interfaces:**
- Consumes: `supabase` from `lib/supabase.ts`, `Meal` from `types/index.ts`
- Consumes: `POST /functions/v1/ai-meal-analysis` via `lib/api/mealAnalysis.ts`
- Produces: `useMealsStore` — `{ meals, todayMeals, loading, error, fetchTodayMeals, addMeal }`

- [ ] **Step 1: Write failing meals store test**

`__tests__/stores/mealsStore.test.ts`:
```typescript
import { useMealsStore } from '../../stores/mealsStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockInsert = (error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: { id: 'meal-1' }, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('mealsStore', () => {
  beforeEach(() => useMealsStore.setState({ meals: [], loading: false, error: null }))

  it('sets error on failed insert', async () => {
    mockInsert({ message: 'insert failed' })
    await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
    expect(useMealsStore.getState().error).toBe('insert failed')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/stores/mealsStore.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement meals store**

`stores/mealsStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Meal } from '../types'

interface MealsState {
  meals: Meal[]
  loading: boolean
  error: string | null
  fetchTodayMeals: (userId: string) => Promise<void>
  addMeal: (meal: Omit<Meal, 'id' | 'created_at' | 'logged_at' | 'ai_suggestions'> & { photo_url?: string }) => Promise<Meal | null>
}

export const useMealsStore = create<MealsState>()(
  immer((set) => ({
    meals: [],
    loading: false,
    error: null,

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

    addMeal: async (meal) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('meals')
        .insert({ ...meal, logged_at: new Date().toISOString() })
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) s.meals.unshift(data as Meal)
        s.error = error?.message ?? null
      })
      return error ? null : (data as Meal)
    },
  }))
)
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/stores/mealsStore.test.ts
```
Expected: PASS

- [ ] **Step 5: Write meal analysis API caller**

`lib/api/mealAnalysis.ts`:
```typescript
import { supabase } from '../supabase'

export interface MealAnalysisResult {
  items: string[]
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  suggestions: string
}

export async function analyzeMealPhoto(photoUrl: string, description?: string): Promise<MealAnalysisResult> {
  const { data, error } = await supabase.functions.invoke('ai-meal-analysis', {
    body: { photo_url: photoUrl, description },
  })
  if (error) throw new Error(error.message)
  return data as MealAnalysisResult
}
```

- [ ] **Step 6: Build MealPhotoCapture component**

`components/meals/MealPhotoCapture.tsx`:
```typescript
import { useState } from 'react'
import { View, Pressable, Image, ActivityIndicator, Text } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  onUploaded: (url: string) => void
}

export function MealPhotoCapture({ onUploaded }: Props) {
  const { user } = useAuthStore()
  const [uri, setUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const pick = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images })
    if (result.canceled) return
    const asset = result.assets[0]
    setUri(asset.uri)
    setUploading(true)
    const fileName = `${user!.id}/${Date.now()}.jpg`
    const response = await fetch(asset.uri)
    const blob = await response.blob()
    const { error } = await supabase.storage.from('meal-photos').upload(fileName, blob, { contentType: 'image/jpeg' })
    setUploading(false)
    if (!error) {
      const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName)
      onUploaded(data.publicUrl)
    }
  }

  if (uploading) return <ActivityIndicator className="my-4" />

  return (
    <Pressable onPress={pick} className="border-2 border-dashed border-gray-300 rounded-xl h-40 items-center justify-center mb-4">
      {uri ? <Image source={{ uri }} className="w-full h-full rounded-xl" /> : <Text className="text-gray-400">Tap to capture meal photo</Text>}
    </Pressable>
  )
}
```

- [ ] **Step 7: Build MealCard component**

`components/meals/MealCard.tsx`:
```typescript
import { View, Text } from 'react-native'
import { Meal } from '../../types'

export function MealCard({ meal }: { meal: Meal }) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="font-semibold text-gray-900 flex-1 mr-2">{meal.description}</Text>
        <Text className="font-bold text-green-700">{meal.total_calories} kcal</Text>
      </View>
      <View className="flex-row gap-4">
        <Text className="text-xs text-gray-500">P: {meal.protein_g}g</Text>
        <Text className="text-xs text-gray-500">C: {meal.carbs_g}g</Text>
        <Text className="text-xs text-gray-500">F: {meal.fat_g}g</Text>
      </View>
      {meal.ai_suggestions && (
        <Text className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">{meal.ai_suggestions}</Text>
      )}
    </View>
  )
}
```

- [ ] **Step 8: Build meals screen**

`app/(tabs)/meals.tsx`:
```typescript
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, Pressable, Modal, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { MealPhotoCapture } from '../../components/meals/MealPhotoCapture'
import { MealCard } from '../../components/meals/MealCard'
import { analyzeMealPhoto } from '../../lib/api/mealAnalysis'
import { MealType } from '../../types'

export default function MealsScreen() {
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals, addMeal, loading } = useMealsStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [analysing, setAnalysing] = useState(false)

  useEffect(() => { if (user) fetchTodayMeals(user.id) }, [user])

  const handleLog = async () => {
    if (!user || !photoUrl) return
    setAnalysing(true)
    const analysis = await analyzeMealPhoto(photoUrl, description)
    setAnalysing(false)
    await addMeal({
      user_id: user.id,
      meal_type: mealType,
      description,
      photo_url: photoUrl,
      total_calories: analysis.total_calories,
      protein_g: analysis.protein_g,
      carbs_g: analysis.carbs_g,
      fat_g: analysis.fat_g,
      fiber_g: analysis.fiber_g,
    })
    setModalOpen(false)
    setPhotoUrl(null)
    setDescription('')
  }

  const todayTotal = meals.reduce((sum, m) => sum + m.total_calories, 0)

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Today's meals</Text>
        <Text className="text-gray-500">{todayTotal} kcal logged</Text>
      </View>
      <ScrollView className="flex-1 px-4 pt-4">
        {loading ? <ActivityIndicator className="mt-8" /> : meals.map(m => <MealCard key={m.id} meal={m} />)}
      </ScrollView>
      <Pressable className="absolute bottom-6 right-6 bg-green-600 rounded-full w-14 h-14 items-center justify-center shadow-lg" onPress={() => setModalOpen(true)}>
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white px-6 pt-12">
          <Text className="text-xl font-bold mb-4">Log a meal</Text>
          <MealPhotoCapture onUploaded={setPhotoUrl} />
          <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" placeholder="Describe your meal (optional)" value={description} onChangeText={setDescription} multiline />
          <View className="flex-row gap-2 mb-6">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(t => (
              <Pressable key={t} onPress={() => setMealType(t)} className={`flex-1 py-2 rounded-lg border items-center ${mealType === t ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                <Text className={`text-xs ${mealType === t ? 'text-white' : 'text-gray-600'}`}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {analysing && <ActivityIndicator className="mb-4" />}
          <Pressable className="bg-green-600 rounded-lg py-4 items-center" onPress={handleLog} disabled={!photoUrl || analysing}>
            <Text className="text-white font-semibold">Analyse & log meal</Text>
          </Pressable>
          <Pressable className="py-4 items-center mt-2" onPress={() => setModalOpen(false)}>
            <Text className="text-gray-500">Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}
```

- [ ] **Step 9: Test meal logging end-to-end on device**

Take a photo of food, confirm analysis returns macros, confirm meal appears in today's list.

- [ ] **Step 10: Commit**

```bash
git add stores/mealsStore.ts lib/api/ components/meals/ app/(tabs)/meals.tsx __tests__/stores/mealsStore.test.ts
git commit -m "feat: meal logging with photo capture and AI macro analysis"
```

---

### Task 8: Chat Screen

**Files:**
- Create: `stores/chatStore.ts`
- Create: `lib/api/agent.ts`
- Create: `components/chat/ChatMessage.tsx`
- Create: `components/chat/ChatInput.tsx`
- Create: `app/(tabs)/chat.tsx`
- Create: `__tests__/stores/chatStore.test.ts`

**Interfaces:**
- Consumes: `POST /functions/v1/ai-agent` via `lib/api/agent.ts`
- Produces: `useChatStore` — `{ messages, conversationId, loading, error, sendMessage, loadHistory }`

- [ ] **Step 1: Write failing chat store test**

`__tests__/stores/chatStore.test.ts`:
```typescript
import { useChatStore } from '../../stores/chatStore'

jest.mock('../../lib/api/agent', () => ({
  sendAgentMessage: jest.fn().mockResolvedValue({ reply: 'Hello!', conversation_id: 'conv-1' }),
}))

describe('chatStore', () => {
  beforeEach(() => useChatStore.setState({ messages: [], conversationId: null, loading: false, error: null }))

  it('adds user message immediately then assistant reply', async () => {
    await useChatStore.getState().sendMessage('user-1', 'Hi')
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].content).toBe('Hello!')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/stores/chatStore.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement chat store**

`stores/chatStore.ts`:
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { sendAgentMessage } from '../lib/api/agent'
import { ChatMessage } from '../types'

interface ChatState {
  messages: Omit<ChatMessage, 'user_id' | 'tool_calls' | 'context_snapshot'>[]
  conversationId: string | null
  loading: boolean
  error: string | null
  sendMessage: (userId: string, content: string) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    messages: [],
    conversationId: null,
    loading: false,
    error: null,

    sendMessage: async (userId, content) => {
      const userMsg = { id: crypto.randomUUID(), conversation_id: get().conversationId ?? '', role: 'user' as const, content, created_at: new Date().toISOString() }
      set((s) => { s.messages.push(userMsg); s.loading = true; s.error = null })
      try {
        const { reply, conversation_id } = await sendAgentMessage(userId, content, get().conversationId ?? undefined)
        const assistantMsg = { id: crypto.randomUUID(), conversation_id, role: 'assistant' as const, content: reply, created_at: new Date().toISOString() }
        set((s) => { s.messages.push(assistantMsg); s.conversationId = conversation_id; s.loading = false })
      } catch (e) {
        set((s) => { s.loading = false; s.error = (e as Error).message })
      }
    },
  }))
)
```

- [ ] **Step 4: Write agent API caller**

`lib/api/agent.ts`:
```typescript
import { supabase } from '../supabase'

export async function sendAgentMessage(userId: string, message: string, conversationId?: string): Promise<{ reply: string; conversation_id: string }> {
  const { data, error } = await supabase.functions.invoke('ai-agent', {
    body: { user_id: userId, message, conversation_id: conversationId },
  })
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx jest __tests__/stores/chatStore.test.ts
```
Expected: PASS

- [ ] **Step 6: Build ChatMessage component**

`components/chat/ChatMessage.tsx`:
```typescript
import { View, Text } from 'react-native'

interface Props { role: 'user' | 'assistant'; content: string }

export function ChatMessage({ role, content }: Props) {
  const isUser = role === 'user'
  return (
    <View className={`mb-3 max-w-[80%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View className={`px-4 py-3 rounded-2xl ${isUser ? 'bg-green-600 rounded-br-sm' : 'bg-white rounded-bl-sm shadow-sm border border-gray-100'}`}>
        <Text className={isUser ? 'text-white' : 'text-gray-900'}>{content}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 7: Build chat screen**

`app/(tabs)/chat.tsx`:
```typescript
import { useRef, useState } from 'react'
import { View, FlatList, TextInput, Pressable, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { useChatStore } from '../../stores/chatStore'
import { ChatMessage } from '../../components/chat/ChatMessage'

export default function ChatScreen() {
  const { user } = useAuthStore()
  const { messages, loading, sendMessage } = useChatStore()
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList>(null)

  const handleSend = async () => {
    if (!input.trim() || !user) return
    const text = input.trim()
    setInput('')
    await sendMessage(user.id, text)
    listRef.current?.scrollToEnd()
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Coach</Text>
        <Text className="text-gray-500 text-sm">Your AI health coach</Text>
      </View>
      {messages.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-center">Say hello to your coach! You can log meals, check your goals, get suggestions, or just ask questions.</Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <ChatMessage role={item.role} content={item.content} />}
        className="flex-1 px-4 pt-4"
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
      />
      {loading && <ActivityIndicator className="py-2" color="#16a34a" />}
      <View className="flex-row items-end px-4 py-3 bg-white border-t border-gray-100">
        <TextInput
          className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 mr-2 max-h-28 bg-gray-50"
          placeholder="Message your coach..."
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <Pressable onPress={handleSend} disabled={!input.trim() || loading} className={`w-10 h-10 rounded-full items-center justify-center ${input.trim() ? 'bg-green-600' : 'bg-gray-200'}`}>
          <Text className="text-white font-bold">↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
```

- [ ] **Step 8: Test chat end-to-end on device**

Type "What have I eaten today?", confirm agent responds with meal data. Type "Log a snack: 2 boiled eggs", confirm agent calls `log_meal` tool and responds with calorie info.

- [ ] **Step 9: Commit**

```bash
git add stores/chatStore.ts lib/api/agent.ts components/chat/ app/(tabs)/chat.tsx __tests__/stores/chatStore.test.ts
git commit -m "feat: AI chat screen with agentic tool calling"
```

---

### Task 9: Home Dashboard

**Files:**
- Create: `stores/dailySummaryStore.ts`
- Create: `components/ui/ProgressRing.tsx`
- Create: `components/ui/MacroBar.tsx`
- Create: `lib/utils/macros.ts`
- Create: `app/(tabs)/index.tsx`
- Create: `__tests__/lib/macros.test.ts`

**Interfaces:**
- Consumes: `useMealsStore`, `useProfileStore`
- Produces: `useDailySummaryStore` — `{ summary, loading, fetchOrCreateToday }`
- Produces: `calcMacroProgress(consumed, target) → percentage: number` from `lib/utils/macros.ts`

- [ ] **Step 1: Write failing macro utils test**

`__tests__/lib/macros.test.ts`:
```typescript
import { calcProgress, sumMeals } from '../../lib/utils/macros'
import { Meal } from '../../types'

describe('macros utils', () => {
  it('calcProgress returns 0 when target is 0', () => {
    expect(calcProgress(500, 0)).toBe(0)
  })

  it('calcProgress caps at 100', () => {
    expect(calcProgress(2500, 2000)).toBe(100)
  })

  it('calcProgress returns correct percentage', () => {
    expect(calcProgress(1000, 2000)).toBe(50)
  })

  it('sumMeals totals calories from meals array', () => {
    const meals = [{ total_calories: 400 }, { total_calories: 600 }] as Meal[]
    expect(sumMeals(meals).calories).toBe(1000)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest __tests__/lib/macros.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement macros utils**

`lib/utils/macros.ts`:
```typescript
import { Meal } from '../../types'

export function calcProgress(consumed: number, target: number): number {
  if (target === 0) return 0
  return Math.min(100, Math.round((consumed / target) * 100))
}

export function sumMeals(meals: Meal[]) {
  return meals.reduce(
    (acc, m) => ({ calories: acc.calories + m.total_calories, protein: acc.protein + m.protein_g, carbs: acc.carbs + m.carbs_g, fat: acc.fat + m.fat_g }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
npx jest __tests__/lib/macros.test.ts
```
Expected: PASS

- [ ] **Step 5: Build ProgressRing component**

`components/ui/ProgressRing.tsx`:
```typescript
import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

interface Props { percentage: number; label: string; value: string; color: string; size?: number }

export function ProgressRing({ percentage, label, value, color, size = 80 }: Props) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const strokeDash = circ - (percentage / 100) * circ

  return (
    <View className="items-center">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={8} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={circ} strokeDashoffset={strokeDash} strokeLinecap="round"
          rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <Text className="font-bold text-gray-900 -mt-1">{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  )
}
```

Note: install `react-native-svg` first: `npx expo install react-native-svg`

- [ ] **Step 6: Build home dashboard screen**

`app/(tabs)/index.tsx`:
```typescript
import { useEffect } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { useProfileStore } from '../../stores/profileStore'
import { MealCard } from '../../components/meals/MealCard'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { calcProgress, sumMeals } from '../../lib/utils/macros'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals } = useMealsStore()
  const { profile, goals, fetchProfile } = useProfileStore()

  useEffect(() => {
    if (user) { fetchTodayMeals(user.id); fetchProfile(user.id) }
  }, [user])

  const totals = sumMeals(meals)
  const calorieTarget = goals?.daily_calorie_target ?? 2000
  const proteinTarget = goals?.daily_protein_g ?? 150

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-6">
        <Text className="text-gray-500 text-sm">Good morning</Text>
        <Text className="text-2xl font-bold text-gray-900 mb-6">Today's progress</Text>
        <View className="flex-row justify-around">
          <ProgressRing percentage={calcProgress(totals.calories, calorieTarget)} label="Calories" value={`${totals.calories}`} color="#16a34a" />
          <ProgressRing percentage={calcProgress(totals.protein, proteinTarget)} label="Protein" value={`${Math.round(totals.protein)}g`} color="#2563eb" />
          <ProgressRing percentage={0} label="Steps" value="—" color="#d97706" />
        </View>
      </View>

      <View className="flex-row px-4 pt-4 gap-3 mb-4">
        <Pressable className="flex-1 bg-green-600 rounded-xl py-4 items-center" onPress={() => router.push('/(tabs)/meals')}>
          <Text className="text-white font-semibold">Log Meal</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/(tabs)/chat')}>
          <Text className="text-gray-700 font-semibold">Ask Coach</Text>
        </Pressable>
      </View>

      <View className="px-4">
        <Text className="font-semibold text-gray-700 mb-3">Today's meals</Text>
        {meals.length === 0
          ? <Text className="text-gray-400 text-center py-8">No meals logged yet today</Text>
          : meals.map(m => <MealCard key={m.id} meal={m} />)
        }
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 7: Set up bottom tab navigator**

`app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#16a34a' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text> }} />
      <Tabs.Screen name="chat" options={{ title: 'Coach', tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text> }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarIcon: ({ color }) => <Text style={{ color }}>🍽️</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color }}>⚙️</Text> }} />
    </Tabs>
  )
}
```

- [ ] **Step 8: Verify dashboard on device**

Confirm progress rings update as meals are logged. Confirm quick action buttons navigate correctly.

- [ ] **Step 9: Commit**

```bash
git add stores/dailySummaryStore.ts components/ui/ lib/utils/ app/(tabs)/index.tsx app/(tabs)/_layout.tsx __tests__/lib/macros.test.ts
git commit -m "feat: home dashboard with progress rings and meal summary"
```

---

### Task 10: Settings Screen

**Files:**
- Create: `app/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, `useProfileStore`

- [ ] **Step 1: Build settings screen**

`app/(tabs)/settings.tsx`:
```typescript
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { AiProvider } from '../../types'

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'GPT-4o (OpenAI)' },
  { id: 'gemini', label: 'Gemini (Google)' },
]

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut } = useAuthStore()
  const { profile, upsertProfile } = useProfileStore()

  const changeProvider = async (provider: AiProvider) => {
    if (!user) return
    await upsertProfile({ id: user.id, ai_provider: provider })
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
      </View>
      <View className="px-4 pt-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">AI Provider</Text>
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          {PROVIDERS.map((p, i) => (
            <Pressable key={p.id} onPress={() => changeProvider(p.id)}
              className={`px-4 py-4 flex-row justify-between items-center ${i < PROVIDERS.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <Text className="text-gray-900">{p.label}</Text>
              {profile?.ai_provider === p.id && <Text className="text-green-600 font-semibold">✓</Text>}
            </Pressable>
          ))}
        </View>

        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">Account</Text>
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <Pressable className="px-4 py-4 border-b border-gray-100" onPress={() => router.push('/(onboarding)/profile')}>
            <Text className="text-gray-900">Edit health profile</Text>
          </Pressable>
          <Pressable className="px-4 py-4" onPress={() => router.push('/(onboarding)/goals')}>
            <Text className="text-gray-900">Edit goals</Text>
          </Pressable>
        </View>

        <Pressable className="bg-red-50 rounded-xl border border-red-100 px-4 py-4 items-center" onPress={signOut}>
          <Text className="text-red-600 font-semibold">Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npx jest
```
Expected: All tests pass.

- [ ] **Step 3: Full smoke test on device**

Walk through: register → onboarding → home → log a meal via camera → check macros appear → ask coach "what did I eat?" → confirm agent responds with logged meal.

- [ ] **Step 4: Final commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: settings screen with AI provider selection and profile edit links"
```

---

## Phase 1 Complete

Delivers:
- Working Android app with auth, onboarding, bottom tab navigation
- Meal logging with photo capture and AI macro analysis
- AI chat agent that can log meals, check summaries, and read/update goals
- Home dashboard with calorie and macro progress rings
- Settings with AI provider switching

**Next:** Phase 2 — Health Tracking (InBody upload, Health Connect sync, activity logging)
