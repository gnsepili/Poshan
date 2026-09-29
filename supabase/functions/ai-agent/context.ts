import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function assembleContext(userId: string, supabase: SupabaseClient): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const [profileRes, goalsRes, mealsRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('meals').select('*').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`),
    supabase.from('daily_summaries').select('date, total_calories_consumed, ai_coach_note').eq('user_id', userId).order('date', { ascending: false }).limit(7),
  ])

  const todayCalories = (mealsRes.data ?? []).reduce((sum: number, m: { total_calories: number }) => sum + m.total_calories, 0)

  return `
## User Health Context
Today's date: ${today}
Profile: ${JSON.stringify(profileRes.data)}
Current Goals: ${JSON.stringify(goalsRes.data)}
Today's meals: ${JSON.stringify(mealsRes.data)}
Today's calories so far: ${todayCalories} kcal
Last 7 days summaries: ${JSON.stringify(historyRes.data)}
`.trim()
}
