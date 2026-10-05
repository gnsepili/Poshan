// Server-side guards so the coach can never record planned food as eaten food.

const MEAL_LABELS = ['breakfast', 'lunch', 'dinner', 'snack']

// Why a log_meal call must be refused (returned to the model), or null if it's fine.
export function mealLogRejection(input: { description?: unknown; user_confirmed_eaten?: unknown }): string | null {
  if (input.user_confirmed_eaten !== true) {
    return 'Not logged: only log food the user says they have ALREADY eaten. If they described a plan or asked what to eat, save it with plan_meals_for_day (or just advise) instead. If unsure whether they ate it, ask them.'
  }
  const text = typeof input.description === 'string' ? input.description.toLowerCase() : ''
  const labels = MEAL_LABELS.filter((m) => new RegExp(`\\b${m}\\s*:`).test(text))
  if (labels.length >= 2) {
    return 'Not logged: this describes several meals at once, which looks like a day plan. Use plan_meals_for_day for plans; log each eaten meal separately with its own meal_type.'
  }
  return null
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function weekdayName(value: string | undefined, now: Date = new Date()): string {
  const match = WEEK.find((d) => d.toLowerCase() === (value ?? '').trim().toLowerCase())
  return match ?? WEEK[(now.getUTCDay() + 6) % 7]
}

// Replace (or add) one day in a plan's days, keeping Monday→Sunday order.
// deno-lint-ignore no-explicit-any
export function upsertPlanDay(days: any[], day: { day: string; meals: unknown[] }): any[] {
  const name = weekdayName(day.day)
  const rest = days.filter((d) => typeof d?.day === 'string' && d.day.toLowerCase() !== name.toLowerCase())
  return [...rest, { ...day, day: name }].sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day))
}

// Monday of the current week (UTC), YYYY-MM-DD — the key meal plans are filed under.
export function weekStartMonday(now: Date = new Date()): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().split('T')[0]
}
