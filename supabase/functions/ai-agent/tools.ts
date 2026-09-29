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
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log a physical activity the user did (walk, run, gym, cycle, swim, yoga, other) with optional duration, steps, and calories burned.',
      parameters: {
        type: 'object',
        properties: {
          activity_type: { type: 'string', enum: ['walk', 'run', 'gym', 'cycle', 'swim', 'yoga', 'other'] },
          duration_min: { type: 'number' },
          steps: { type: 'number' },
          calories_burned: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['activity_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inbody_history',
      description: "Get the user's InBody body-composition scans over time (weight, body fat %, muscle mass, visceral fat, BMR), most recent first.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Max scans to return, default 10' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_diet_plan',
      description: "Adjust the user's nutrition/step targets based on their progress and latest InBody results. Inserts a NEW goals row (goals are append-only; latest wins). Provide only the fields you want to change; unspecified fields carry over from the current goals. Always include a short rationale in notes.",
      parameters: {
        type: 'object',
        properties: {
          daily_calorie_target: { type: 'number' },
          daily_protein_g: { type: 'number' },
          daily_carbs_g: { type: 'number' },
          daily_fat_g: { type: 'number' },
          daily_steps_target: { type: 'number' },
          target_weight_kg: { type: 'number' },
          notes: { type: 'string', description: 'Short rationale for the adjustment' },
        },
        required: ['notes'],
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

  if (name === 'log_activity') {
    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId,
      activity_type: input.activity_type,
      duration_min: input.duration_min ?? 0,
      steps: input.steps ?? 0,
      calories_burned: input.calories_burned ?? 0,
      notes: input.notes ?? '',
      logged_at: new Date().toISOString(),
    })
    if (error) return `Error logging activity: ${error.message}`
    return `Activity logged: ${input.activity_type}${input.duration_min ? `, ${input.duration_min} min` : ''}${input.steps ? `, ${input.steps} steps` : ''}${input.calories_burned ? `, ${input.calories_burned} kcal` : ''}`
  }

  if (name === 'get_inbody_history') {
    const limit = typeof input.limit === 'number' ? input.limit : 10
    const { data, error } = await supabase
      .from('inbody_reports')
      .select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, bmr, ai_notes')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit)
    if (error) return `Error reading InBody history: ${error.message}`
    if (!data || data.length === 0) return 'No InBody scans on record yet.'
    return JSON.stringify(data)
  }

  if (name === 'adjust_diet_plan') {
    const { data: existing } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!existing) return 'No existing goals to adjust. The user should set goals in onboarding first.'
    const { notes, ...changes } = input
    // Goals are append-only / latest-wins: INSERT a new row, never mutate the old one.
    const { id: _id, created_at: _createdAt, ...carryOver } = existing
    const { error } = await supabase.from('goals').insert({
      ...carryOver,
      ...changes,
      notes: typeof notes === 'string' ? notes : (carryOver.notes ?? ''),
      user_id: userId,
    })
    if (error) return `Error adjusting diet plan: ${error.message}`
    return `Diet plan adjusted; new targets saved as a new goals row. Rationale: ${notes ?? ''}`
  }

  return `Unknown tool: ${name}`
}
