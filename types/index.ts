export type AiProvider = 'claude' | 'openai' | 'gemini'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ChatRole = 'user' | 'assistant'
export type Sex = 'male' | 'female' | 'other'

export interface Profile {
  id: string
  age: number
  sex: Sex
  height_cm: number
  current_weight_kg: number
  activity_level: ActivityLevel
  lifestyle_notes: string
  health_conditions: string
  treatment_duration_months: number
  ai_provider: AiProvider
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  target_weight_kg: number
  target_body_fat_pct: number | null
  target_muscle_mass_kg: number | null
  daily_calorie_target: number
  daily_protein_g: number
  daily_carbs_g: number
  daily_fat_g: number
  daily_steps_target: number
  notes: string
  created_at: string
}

export interface Meal {
  id: string
  user_id: string
  logged_at: string
  meal_type: MealType
  photo_url: string | null
  description: string
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  ai_suggestions: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  conversation_id: string
  role: ChatRole
  content: string
  tool_calls: unknown | null
  context_snapshot: unknown | null
  created_at: string
}

export interface DailySummary {
  id: string
  user_id: string
  date: string
  total_calories_consumed: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_steps: number
  weight_kg: number | null
  ai_daily_goals: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    steps: number
    workout_suggestion: string
  } | null
  ai_coach_note: string | null
  created_at: string
}

export type ActivityType = 'walk' | 'run' | 'gym' | 'cycle' | 'swim' | 'yoga' | 'other'

export interface InBodyReport {
  id: string
  user_id: string
  scanned_at: string
  photo_url: string | null
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  raw_extracted_json: unknown | null
  ai_notes: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  logged_at: string
  activity_type: ActivityType
  duration_min: number
  steps: number
  calories_burned: number
  notes: string
  created_at: string
}
