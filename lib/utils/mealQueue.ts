import { MealItem, MealType } from '../../types'

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
  // Set once a queued local photo has been uploaded (before the insert is attempted), and
  // photo_local_uri cleared — so a crash between upload and insert-removal never re-uploads
  // on the next flush; it reuses this already-uploaded remote URL instead.
  photo_url?: string
  ai_suggestions?: string | null
  items?: MealItem[] | null
  score?: number | null
  score_label?: string | null
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

// Patch a queued item in place (e.g. persist an uploaded photo_url + clear photo_local_uri
// before attempting the insert), preserving order. A no-op if the id isn't present.
export function updateMeal(queue: QueuedMeal[], id: string, patch: Partial<QueuedMeal>): QueuedMeal[] {
  return queue.map((m) => (m.id === id ? { ...m, ...patch } : m))
}
