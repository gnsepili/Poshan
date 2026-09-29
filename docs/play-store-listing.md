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
