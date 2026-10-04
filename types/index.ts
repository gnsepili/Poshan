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
  workout_prefs: WorkoutPrefs | null
  created_at: string
  updated_at: string
}

export type WorkoutEquipment = 'gym' | 'home_dumbbells' | 'bodyweight'
export type WorkoutFocus = 'fat_loss' | 'muscle' | 'strength' | 'general' | 'endurance'
export type WorkoutExperience = 'beginner' | 'intermediate' | 'advanced'

/** Training preferences that drive workout plan generation. */
export interface WorkoutPrefs {
  days_per_week: number
  session_minutes: number
  equipment: WorkoutEquipment
  focus: WorkoutFocus
  experience: WorkoutExperience
  /** Injuries or limitations to avoid, free text. */
  limitations: string
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
  /** Set by the coach-style goal setup; null for older goals. */
  goal_type: 'lose' | 'maintain' | 'gain' | null
  weekly_rate_kg: number | null
  created_at: string
}

export interface MealItem {
  name: string
  portion: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
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
  /** Per-item breakdown from photo analysis (null for manual/coach-logged meals). */
  items: MealItem[] | null
  /** 1-10 meal quality score with a short label, from photo analysis. */
  score: number | null
  score_label: string | null
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
export type ActivitySource = 'manual' | 'health_connect'
export type PushPlatform = 'android' | 'ios'

export type InBodySegment = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg'

export interface InBodySegmentValue {
  kg: number | null
  /** % of the ideal amount for this segment, as printed (e.g. 105.3). */
  pct: number | null
}

/** Everything read off a full InBody printout (extraction_version 2). null = not printed / unreadable. */
export interface InBodyDetails {
  scan_date: string | null
  device_model: string | null
  core: {
    weight_kg: number | null
    skeletal_muscle_mass_kg: number | null
    body_fat_mass_kg: number | null
    percent_body_fat: number | null
    bmi: number | null
    visceral_fat_level: number | null
    bmr_kcal: number | null
    inbody_score: number | null
  }
  body_composition: {
    total_body_water_l: number | null
    intracellular_water_l: number | null
    extracellular_water_l: number | null
    protein_kg: number | null
    minerals_kg: number | null
    bone_mineral_content_kg: number | null
    fat_free_mass_kg: number | null
    soft_lean_mass_kg: number | null
  }
  segmental_lean: Record<InBodySegment, InBodySegmentValue>
  segmental_fat: Record<InBodySegment, InBodySegmentValue>
  ecw_tbw_ratio: number | null
  research: {
    waist_hip_ratio: number | null
    waist_circumference_cm: number | null
    obesity_degree_pct: number | null
    smi_kg_m2: number | null
    phase_angle_deg: number | null
    body_cell_mass_kg: number | null
    recommended_calorie_intake_kcal: number | null
  }
  weight_control: {
    target_weight_kg: number | null
    weight_control_kg: number | null
    fat_control_kg: number | null
    muscle_control_kg: number | null
  }
  /** Normal ranges printed next to values, keyed by metric (e.g. "weight_kg"). */
  reference_ranges: { metric: string; low: number | null; high: number | null }[]
  /** Any other printed label/value pairs not captured above. */
  other_values: { label: string; value: string }[]
}

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
  bmi: number | null
  body_fat_mass_kg: number | null
  fat_free_mass_kg: number | null
  total_body_water_l: number | null
  ecw_tbw_ratio: number | null
  inbody_score: number | null
  smi: number | null
  phase_angle: number | null
  waist_hip_ratio: number | null
  target_weight_kg: number | null
  /** 1 = legacy 5-field extraction (raw label/value map), 2 = full InBodyDetails. */
  extraction_version: number
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
  source: ActivitySource
  created_at: string
}

export interface MealPlanMeal {
  meal_type: MealType
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealPlanDay {
  day: string
  meals: MealPlanMeal[]
}

export interface MealPlanJson {
  days: MealPlanDay[]
}

export interface MealPlan {
  id: string
  user_id: string
  week_start_date: string
  plan_json: MealPlanJson
  created_at: string
}

export interface WorkoutExercise {
  name: string
  sets: number
  reps: string
  notes: string
  rest_seconds?: number
}

export interface WorkoutPlanDay {
  day: string
  focus: string
  exercises: WorkoutExercise[]
  /** Set by plans generated with preferences (older plans omit them). */
  rest?: boolean
  duration_min?: number
}

export interface WorkoutPlanJson {
  days: WorkoutPlanDay[]
}

export interface WorkoutPlan {
  id: string
  user_id: string
  week_start_date: string
  plan_json: WorkoutPlanJson
  created_at: string
}
