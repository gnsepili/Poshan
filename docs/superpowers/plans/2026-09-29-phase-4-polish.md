# Phase 4: Polish + Multi-User Readiness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push notifications, offline meal logging, RLS audit for multi-user, Play Store preparation.

**Architecture:** Extends Phase 3. Expo Notifications for push. Offline queue in AsyncStorage, syncs on reconnect. RLS audit ensures no data leakage between users.

**Tech Stack:** All Phase 1–3 stack + `expo-notifications`, `@react-native-async-storage/async-storage`, EAS Build + Submit

**Spec:** `docs/superpowers/specs/2026-09-29-health-coach-app-design.md`

**Prerequisite:** Phase 3 complete and all tests passing.

---

### Task 1: Push Notifications

- [ ] Install: `npx expo install expo-notifications`
- [ ] Request notification permissions on onboarding
- [ ] Store push token in `profiles` table (add `push_token text` column)
- [ ] Edge Function `generate-daily-summary` sends push notification at 6am with today's coach note
- [ ] Optional: reminder at 8pm if fewer than 2 meals logged that day
- [ ] Test: receive notification on physical Android device
- [ ] Commit

---

### Task 2: Offline Meal Logging

- [ ] Install: `npx expo install @react-native-async-storage/async-storage`
- [ ] When `addMeal` fails due to network error: save meal to AsyncStorage queue
- [ ] On app foreground + network restored: drain queue, insert pending meals, clear queue
- [ ] Show pending count badge on meals tab icon
- [ ] Test: log meal in airplane mode, restore connection, confirm meal syncs
- [ ] Commit

---

### Task 3: RLS Audit

- [ ] Review every table policy: `profiles`, `goals`, `meals`, `daily_summaries`, `chat_messages`, `inbody_reports`, `activity_logs`, `meal_plans`, `workout_plans`
- [ ] Test each policy: attempt to read another user's data with their JWT — confirm 0 rows returned
- [ ] Verify Storage bucket policies: attempt to read another user's meal photo with own JWT — confirm 403
- [ ] Fix any gaps found
- [ ] Commit audit results in a migration if policies were changed

---

### Task 4: Rate Limiting + Cost Controls (AI)

- [ ] Add per-user daily AI call counter in Supabase (Edge Function increments a Redis/Postgres counter)
- [ ] Soft limit: 50 AI agent calls/day per user (configurable env var)
- [ ] Return a friendly message when limit hit: "You've reached today's coaching limit. Resets at midnight."
- [ ] Test: exceed limit, confirm error message returned
- [ ] Commit

---

### Task 5: Play Store Preparation

- [ ] Configure EAS Build: `npx eas build:configure`
- [ ] Set `app.json` android: `package`, `versionCode`, `versionName`
- [ ] Create keystore via EAS: `npx eas credentials`
- [ ] Production build: `npx eas build --platform android --profile production`
- [ ] Test APK on physical device
- [ ] Create Play Store listing: screenshots, description, privacy policy URL
- [ ] Submit: `npx eas submit --platform android`

---

### Task 6: Error Monitoring + Analytics

- [ ] Install Sentry for React Native: `npx expo install @sentry/react-native`
- [ ] Configure DSN in `app.json` / environment
- [ ] Wrap root layout with Sentry error boundary
- [ ] Log unhandled Edge Function errors to Sentry via `Sentry.captureException`
- [ ] Test: trigger a deliberate error, confirm it appears in Sentry dashboard
- [ ] Commit
