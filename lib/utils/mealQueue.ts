import { MealType } from '../../types'

export interface QueuedMeal {
  id: string // client-generated uuid — the meals.id too, so a re-insert collides (idempotent)
  user_id: string
  meal_type: MealType
  description: string
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  photo_local_uri?: string
  queued_at: string
}

// Append to the tail, preserving order. De-dupe by client id so a double-enqueue
// (e.g. a retry that also queued) never stores the same meal twice.
export function enqueueMeal(queue: QueuedMeal[], meal: QueuedMeal): QueuedMeal[] {
  if (queue.some((m) => m.id === meal.id)) return queue
  return [...queue, meal]
}

// Remove a meal by id after a successful insert.
export function removeMeal(queue: QueuedMeal[], id: string): QueuedMeal[] {
  return queue.filter((m) => m.id !== id)
}
