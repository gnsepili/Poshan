import { supabase } from '../supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export interface MealAnalysisResult {
  items: string[]
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  suggestions: string
}

export async function analyzeMealPhoto(photoUrl: string, description?: string): Promise<MealAnalysisResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-meal-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ photo_url: photoUrl, description }),
  })

  const body: unknown = await response.json()

  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Meal analysis request failed with status ${response.status}`
    throw new Error(message)
  }

  return body as MealAnalysisResult
}
