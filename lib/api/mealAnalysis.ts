import { invokeEdgeFunction } from './edgeFunction'

export interface MealAnalysisResult {
  items: string[]
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
