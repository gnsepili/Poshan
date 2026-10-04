import { MealType } from '../../types'

// Default meal type for a meal logged now (the user can change it before saving).
export function mealTypeForTime(date: Date = new Date()): MealType {
  const h = date.getHours()
  if (h >= 4 && h < 11) return 'breakfast'
  if (h >= 11 && h < 16) return 'lunch'
  if (h >= 19 || h < 1) return 'dinner'
  return 'snack'
}

export type ScoreTone = 'good' | 'ok' | 'poor'

// Colour band for the 1-10 meal score.
export function scoreTone(score: number | null | undefined): ScoreTone | null {
  if (score === null || score === undefined) return null
  if (score >= 7) return 'good'
  if (score >= 4) return 'ok'
  return 'poor'
}

// Percentage of a daily target a meal accounts for.
export function shareOfTarget(value: number, target: number): number {
  return target > 0 ? Math.round((value / target) * 100) : 0
}
