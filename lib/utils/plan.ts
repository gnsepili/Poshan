import { MealPlanMeal, WorkoutExercise } from '../../types'

// Defensive reader for plan_json.days. A malformed plan (null, missing days, or
// days-not-an-array from the model) yields [] so the Plans screen never crashes.
export function planDays<T>(plan: { days?: unknown } | null | undefined): T[] {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days)) return []
  return plan.days as T[]
}

// Defensive reader for a meal-plan day's `meals`. The agent tool only validates
// that the top-level `days` array is non-empty, so an individual day missing
// `meals` (or with a non-array `meals`) can reach the client — yield [] instead
// of letting `.map` throw.
export function dayMeals(day: { day?: unknown; meals?: unknown } | null | undefined): MealPlanMeal[] {
  if (!day || typeof day !== 'object' || !Array.isArray(day.meals)) return []
  return day.meals as MealPlanMeal[]
}

// Same guard for a workout-plan day's `exercises`.
export function dayExercises(day: { day?: unknown; exercises?: unknown } | null | undefined): WorkoutExercise[] {
  if (!day || typeof day !== 'object' || !Array.isArray(day.exercises)) return []
  return day.exercises as WorkoutExercise[]
}
