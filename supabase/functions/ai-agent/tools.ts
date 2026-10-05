import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mealLogRejection, upsertPlanDay, weekStartMonday, weekdayName } from './mealGuards.ts'

// OpenAI function-calling tool definitions
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'log_meal',
      description:
        "Record ONE meal the user has ALREADY EATEN (past tense: 'I had', 'I just ate'), with estimated macros. NEVER use it for plans, intentions or questions ('I'm planning to have', 'what should I eat', 'suggest a meal') — use plan_meals_for_day or just answer. If it's unclear whether they ate it, ask first. One call per meal.",
      parameters: {
        type: 'object',
        properties: {
          user_confirmed_eaten: { type: 'boolean', description: 'true only if the user said they already ate this' },
          description: { type: 'string', description: 'Text description of the single meal' },
          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          total_calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          fiber_g: { type: 'number' },
        },
        required: ['user_confirmed_eaten', 'description', 'meal_type', 'total_calories', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_meals_for_day',
      description:
        "Save a meal plan for ONE day (what the user intends to eat, or what you recommend) into their weekly meal plan in the Plans tab. This does NOT log anything as eaten. Use it when the user describes what they plan to eat or asks you to plan a day; fit it to their protein and macro targets.",
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Weekday name, e.g. "Monday"; defaults to today' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                description: { type: 'string', description: 'Foods and portions, e.g. "2 whole eggs + 4 egg whites, scrambled"' },
                calories: { type: 'number' },
                protein_g: { type: 'number' },
                carbs_g: { type: 'number' },
                fat_g: { type: 'number' },
              },
              required: ['meal_type', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
            },
          },
        },
        required: ['meals'],
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
      description: "Get the user's InBody body-composition scans over time (weight, body fat %, skeletal muscle mass, visceral fat, BMR, BMI, fat mass, fat-free mass, body water, ECW/TBW ratio, InBody score, SMI, phase angle, waist-hip ratio, target weight), most recent first. The latest scan's full sheet (segmental analysis etc.) is already in your context.",
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
  {
    type: 'function',
    function: {
      name: 'generate_meal_plan',
      description: "Generate a full 7-day meal plan aligned to the user's calorie and macro goals and save it. YOU must supply the complete plan_json — do not ask another system to produce it. Each day has breakfast/lunch/dinner/snack meals with per-meal macros.",
      parameters: {
        type: 'object',
        properties: {
          week_start_date: { type: 'string', description: 'ISO date YYYY-MM-DD for the Monday of the plan week; defaults to today' },
          plan: {
            type: 'object',
            description: 'The full plan: { days: [ { day, meals: [ { meal_type, description, calories, protein_g, carbs_g, fat_g } ] } ] }',
            properties: {
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'string' },
                    meals: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                          description: { type: 'string' },
                          calories: { type: 'number' },
                          protein_g: { type: 'number' },
                          carbs_g: { type: 'number' },
                          fat_g: { type: 'number' },
                        },
                        required: ['meal_type', 'description', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
                      },
                    },
                  },
                  required: ['day', 'meals'],
                },
              },
            },
            required: ['days'],
          },
        },
        required: ['plan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_workout_plan',
      description: "Generate a full weekly workout plan based on the user's goals, activity level, and InBody data, and save it. YOU must supply the complete plan_json. Each day has a focus and a list of exercises.",
      parameters: {
        type: 'object',
        properties: {
          week_start_date: { type: 'string', description: 'ISO date YYYY-MM-DD for the Monday of the plan week; defaults to today' },
          plan: {
            type: 'object',
            description: 'The full plan: { days: [ { day, focus, exercises: [ { name, sets, reps, notes } ] } ] }',
            properties: {
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'string' },
                    focus: { type: 'string' },
                    exercises: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          sets: { type: 'number' },
                          reps: { type: 'string' },
                          notes: { type: 'string' },
                        },
                        required: ['name', 'sets', 'reps'],
                      },
                    },
                  },
                  required: ['day', 'focus', 'exercises'],
                },
              },
            },
            required: ['days'],
          },
        },
        required: ['plan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_progress_report',
      description: "Get the user's trend data (weight/body-fat/muscle from InBody, calorie adherence from daily summaries) over a date range, to narrate how they are doing.",
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO date YYYY-MM-DD; defaults to 30 days before end_date' },
          end_date: { type: 'string', description: 'ISO date YYYY-MM-DD; defaults to today' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_meal_suggestion',
      description: "Compute the macros the user has left for today (target minus consumed) so you can suggest a concrete meal that fits.",
      parameters: { type: 'object', properties: {} },
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
    const refusal = mealLogRejection(input)
    if (refusal) return refusal
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

  if (name === 'plan_meals_for_day') {
    const meals = (Array.isArray(input.meals) ? input.meals : [])
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object' && typeof (m as { description?: unknown }).description === 'string')
      .slice(0, 8)
      .map((m) => ({
        meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(m.meal_type as string) ? m.meal_type : 'snack',
        description: String(m.description).slice(0, 200),
        calories: Math.max(0, Math.round(Number(m.calories) || 0)),
        protein_g: Math.max(0, Math.round(Number(m.protein_g) || 0)),
        carbs_g: Math.max(0, Math.round(Number(m.carbs_g) || 0)),
        fat_g: Math.max(0, Math.round(Number(m.fat_g) || 0)),
      }))
    if (meals.length === 0) return 'Error: provide at least one meal with a description and macros.'
    const day = weekdayName(typeof input.day === 'string' ? input.day : undefined)
    const weekStart = weekStartMonday()
    // Merge into this week's plan (latest wins); create it if there isn't one yet.
    const { data: existing } = await supabase
      .from('meal_plans')
      .select('id, plan_json')
      .eq('user_id', userId)
      .eq('week_start_date', weekStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const days = upsertPlanDay(Array.isArray(existing?.plan_json?.days) ? existing!.plan_json.days : [], { day, meals })
    const { error } = existing
      ? await supabase.from('meal_plans').update({ plan_json: { ...existing.plan_json, days } }).eq('id', existing.id)
      : await supabase.from('meal_plans').insert({ user_id: userId, week_start_date: weekStart, plan_json: { days } })
    if (error) return `Error saving the plan: ${error.message}`
    const kcal = meals.reduce((n, m) => n + m.calories, 0)
    const protein = meals.reduce((n, m) => n + m.protein_g, 0)
    return `Saved ${day}'s meal plan (${meals.length} meals, ~${kcal} kcal, ${protein}g protein) in Plans → Meals. Nothing was logged as eaten — the user logs meals as they have them.`
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
    const limit = Math.min(Math.max(1, typeof input.limit === 'number' ? input.limit : 10), 50)
    const { data, error } = await supabase
      .from('inbody_reports')
      .select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, bmr, bmi, body_fat_mass_kg, fat_free_mass_kg, total_body_water_l, ecw_tbw_ratio, inbody_score, smi, phase_angle, waist_hip_ratio, target_weight_kg, ai_notes')
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

  if (name === 'generate_meal_plan' || name === 'generate_workout_plan') {
    const plan = input.plan
    // Malformed plan_json from the model must NOT be persisted (Review Focus #4).
    if (!plan || typeof plan !== 'object' || !Array.isArray((plan as { days?: unknown }).days) || (plan as { days: unknown[] }).days.length === 0) {
      return 'Error: plan must be an object with a non-empty "days" array. Re-call the tool with the full plan_json.'
    }
    const table = name === 'generate_meal_plan' ? 'meal_plans' : 'workout_plans'
    const weekStart = typeof input.week_start_date === 'string' ? input.week_start_date : new Date().toISOString().split('T')[0]
    // Plans are append-only / latest-wins: INSERT a new row every time.
    const { error } = await supabase.from(table).insert({
      user_id: userId,
      week_start_date: weekStart,
      plan_json: plan,
    })
    if (error) return `Error saving plan: ${error.message}`
    const dayCount = (plan as { days: unknown[] }).days.length
    return `${name === 'generate_meal_plan' ? 'Meal' : 'Workout'} plan saved for the week of ${weekStart} (${dayCount} days). Tell the user to open the Plans tab.`
  }

  if (name === 'get_progress_report') {
    const end = typeof input.end_date === 'string' ? input.end_date : new Date().toISOString().split('T')[0]
    const start = typeof input.start_date === 'string'
      ? input.start_date
      : new Date(new Date(`${end}T00:00:00Z`).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const [inbodyRes, dailyRes] = await Promise.all([
      supabase.from('inbody_reports')
        .select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, body_fat_mass_kg, ecw_tbw_ratio, inbody_score')
        .eq('user_id', userId)
        .gte('scanned_at', `${start}T00:00:00`).lte('scanned_at', `${end}T23:59:59`)
        .order('scanned_at', { ascending: true }),
      supabase.from('daily_summaries')
        .select('date, total_calories_consumed, ai_daily_goals')
        .eq('user_id', userId)
        .gte('date', start).lte('date', end)
        .order('date', { ascending: true }),
    ])
    return JSON.stringify({ start, end, inbody: inbodyRes.data ?? [], daily: dailyRes.data ?? [] })
  }

  if (name === 'get_meal_suggestion') {
    const today = new Date().toISOString().split('T')[0]
    const [mealsRes, goalsRes] = await Promise.all([
      supabase.from('meals').select('total_calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId).gte('logged_at', `${today}T00:00:00`).lte('logged_at', `${today}T23:59:59`),
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const meals = (mealsRes.data ?? []) as { total_calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
    const consumed = meals.reduce(
      (a, m) => ({ cal: a.cal + m.total_calories, p: a.p + m.protein_g, c: a.c + m.carbs_g, f: a.f + m.fat_g }),
      { cal: 0, p: 0, c: 0, f: 0 }
    )
    const g = goalsRes.data as { daily_calorie_target: number; daily_protein_g: number; daily_carbs_g: number; daily_fat_g: number } | null
    if (!g) return 'No goals set yet — ask the user to set goals in onboarding before suggesting meals.'
    return JSON.stringify({
      remaining_calories: g.daily_calorie_target - consumed.cal,
      remaining_protein_g: g.daily_protein_g - consumed.p,
      remaining_carbs_g: g.daily_carbs_g - consumed.c,
      remaining_fat_g: g.daily_fat_g - consumed.f,
      note: 'Suggest ONE concrete meal that roughly fits these remaining macros.',
    })
  }

  return `Unknown tool: ${name}`
}
