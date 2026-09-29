// Defensive reader for plan_json.days. A malformed plan (null, missing days, or
// days-not-an-array from the model) yields [] so the Plans screen never crashes.
export function planDays<T>(plan: { days?: unknown } | null | undefined): T[] {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days)) return []
  return plan.days as T[]
}
