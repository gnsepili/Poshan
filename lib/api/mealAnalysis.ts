import { invokeEdgeFunction } from './edgeFunction'
import { MealItem } from '../../types'

export interface MealAnalysisResult {
  /** Short name for the whole meal. */
  title: string
  /** Item names only (legacy). */
  items: string[]
  item_breakdown: MealItem[]
  score: number | null
  score_label: string
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  suggestions: string
}

export function analyzeMealPhoto(photoUrl: string, description?: string): Promise<MealAnalysisResult> {
  return invokeEdgeFunction<MealAnalysisResult>('ai-meal-analysis', { photo_url: photoUrl, description }, { timeoutMs: 60_000 })
}
