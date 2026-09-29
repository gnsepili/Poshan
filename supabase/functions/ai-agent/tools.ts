import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// OpenAI function-calling tool definitions
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'log_meal',
      description: 'Log a meal the user just ate, with its estimated macros. Use this when the user describes food they ate.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Text description of the meal' },
          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          total_calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          fiber_g: { type: 'number' },
        },
        required: ['description', 'meal_type', 'total_calories', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_summary',
      description: 'Get the calorie and macro totals for a specific date (defaults to today).',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'ISO date string YYYY-MM-DD, defaults to today' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_goals',
      description: "Get the user's current calorie, macro, and step targets.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_goals',
      description: "Update the user's daily nutrition and step targets.",
      parameters: {
        type: 'object',
        properties: {
          daily_calorie_target: { type: 'number' },
          daily_protein_g: { type: 'number' },
          daily_carbs_g: { type: 'number' },
          daily_fat_g: { type: 'number' },
          daily_steps_target: { type: 'number' },
        },
      },
    },
  },
]

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  if (name === 'log_meal') {
    const { error } = await supabase.from('meals').insert({
      user_id: userId,
      meal_type: input.meal_type,
      description: input.description,
      total_calories: input.total_calories,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      fiber_g: input.fiber_g ?? 0,
      logged_at: new Date().toISOString(),
    })
    if (error) return `Error logging meal: ${error.message}`
    return `Meal logged: ${input.description} — ${input.total_calories} kcal, ${input.protein_g}g protein, ${input.carbs_g}g carbs, ${input.fat_g}g fat`
  }

  if (name === 'get_daily_summary') {
    const date = (input.date as string) ?? new Date().toISOString().split('T')[0]
    const { data: meals } = await supabase
      .from('meals')
      .select('total_calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('logged_at', `${date}T00:00:00`)
      .lte('logged_at', `${date}T23:59:59`)
    const totals = (meals ?? []).reduce(
      (acc: { calories: number; protein: number; carbs: number; fat: number }, m: { total_calories: number; protein_g: number; carbs_g: number; fat_g: number }) => ({
        calories: acc.calories + m.total_calories,
        protein: acc.protein + m.protein_g,
        carbs: acc.carbs + m.carbs_g,
        fat: acc.fat + m.fat_g,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
    return JSON.stringify({ date, ...totals })
  }

  if (name === 'get_goals') {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return `No goals found: ${error.message}`
    return JSON.stringify(data)
  }

  if (name === 'update_goals') {
    const { data: existing } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!existing) return 'No existing goals to update. The user should set goals in onboarding first.'
    // Goals are append-only / latest-wins: insert a new row rather than mutating
    // the existing one, mirroring profileStore.upsertGoals on the client.
    const { id: _id, created_at: _createdAt, ...existingWithoutIdAndTimestamp } = existing
    const { error } = await supabase.from('goals').insert({
      ...existingWithoutIdAndTimestamp,
      ...input,
      user_id: userId,
    })
    if (error) return `Error updating goals: ${error.message}`
    return 'Goals updated successfully.'
  }

  return `Unknown tool: ${name}`
}
