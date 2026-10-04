import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// The latest scan with its full sheet (segmental lean/fat, ECW/TBW, weight-control targets,
// printed normal ranges) when it was read in full; otherwise just the headline metrics.
// deno-lint-ignore no-explicit-any
function describeInbody(scan: any): string {
  if (!scan) return 'none yet'
  const { raw_extracted_json, extraction_version, ...metrics } = scan
  return extraction_version >= 2 ? JSON.stringify({ ...metrics, full_sheet: raw_extracted_json }) : JSON.stringify(metrics)
}

export async function assembleContext(userId: string, supabase: SupabaseClient): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const [profileRes, goalsRes, mealsRes, historyRes, inbodyRes, activityRes, mealPlanRes, workoutPlanRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meals').select('*').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`),
    supabase.from('daily_summaries').select('date, total_calories_consumed, ai_coach_note').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('inbody_reports').select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, bmr, bmi, body_fat_mass_kg, fat_free_mass_kg, total_body_water_l, ecw_tbw_ratio, inbody_score, smi, phase_angle, waist_hip_ratio, target_weight_kg, extraction_version, raw_extracted_json, ai_notes').eq('user_id', userId).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('activity_logs').select('activity_type, duration_min, steps, calories_burned').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`),
    supabase.from('meal_plans').select('week_start_date').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_plans').select('week_start_date').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const todayCalories = (mealsRes.data ?? []).reduce((sum: number, m: { total_calories: number }) => sum + m.total_calories, 0)

  return `
## User Health Context
Today's date: ${today}
Profile: ${JSON.stringify(profileRes.data)}
Current Goals: ${JSON.stringify(goalsRes.data)}
Today's meals: ${JSON.stringify(mealsRes.data)}
Today's calories so far: ${todayCalories} kcal
Latest InBody scan: ${describeInbody(inbodyRes.data)}
Recent activity (today): ${JSON.stringify(activityRes.data)}
Last 7 days summaries: ${JSON.stringify(historyRes.data)}
Latest meal plan week: ${JSON.stringify(mealPlanRes.data)}
Latest workout plan week: ${JSON.stringify(workoutPlanRes.data)}
`.trim()
}
