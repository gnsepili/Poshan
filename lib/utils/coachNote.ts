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

// Gates the lazy-generate decision on today's row having actually finished loading.
// A cold mount reads `summary === null` from the store's initial state before the
// fetch resolves, which would otherwise be indistinguishable from "no row exists
// today" and misfire the lazy generate on every app open. Only evaluate the real
// generate condition once `loaded` is true (the fetch has settled, success or error).
export function shouldGenerateAfterLoad(
  loaded: boolean,
  summary: DailySummary | null,
  lastAttemptDate: string | null,
  today: string
): boolean {
  if (!loaded) return false
  return shouldGenerateCoachNote(summary, lastAttemptDate, today)
}

// Low-fuel prompt: only in the afternoon (>= 15:00 local) and when under 80% of
// the calorie target. Guards a zero target so we never divide by zero.
export function shouldShowLowFuelPrompt(consumed: number, target: number, now: Date): boolean {
  if (target <= 0) return false
  if (now.getHours() < 15) return false
  return consumed / target < 0.8
}
