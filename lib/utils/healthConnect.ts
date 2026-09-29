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
  73: 'swim', // EXERCISE_TYPE_SWIMMING_OPEN_WATER
  74: 'swim', // EXERCISE_TYPE_SWIMMING_POOL
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

export interface HcHeartRateSample {
  beatsPerMinute: number
}

export interface HcHeartRateRecord {
  samples: HcHeartRateSample[]
}

// Average BPM across every sample in every HeartRate record pulled for the day.
// Returns null when there's nothing to average (no records/samples), and is
// defensive against malformed samples so it can never surface NaN/Infinity.
export function averageHeartRate(records: HcHeartRateRecord[]): number | null {
  const values = records
    .flatMap((r) => r.samples ?? [])
    .map((s) => s?.beatsPerMinute)
    .filter((bpm): bpm is number => typeof bpm === 'number' && Number.isFinite(bpm))
  if (values.length === 0) return null
  const avg = values.reduce((a, v) => a + v, 0) / values.length
  return Math.round(avg)
}
