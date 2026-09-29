import { Meal } from '../../types'

export function calcProgress(consumed: number, target: number): number {
  if (target === 0) return 0
  return Math.max(0, Math.min(100, Math.round((consumed / target) * 100)))
}

export function sumMeals(meals: Meal[]) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.total_calories,
      protein: acc.protein + m.protein_g,
      carbs: acc.carbs + m.carbs_g,
      fat: acc.fat + m.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}
