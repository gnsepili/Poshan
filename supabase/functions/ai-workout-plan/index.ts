import { chatCompletion, parseModelJson } from '../_shared/ai.ts'
import { CORS, HttpError, enforceAiQuota, errorResponse, json, readJsonBody, requireUserId, serviceClient } from '../_shared/http.ts'

// Personalised workout plans from the user's training preferences, goals and body
// composition. Modes: build the whole week, regenerate one day, or swap one exercise.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const EXERCISE = obj({
  name: { type: 'string' },
  sets: { type: 'number' },
  reps: { type: 'string', description: 'e.g. "8-10", "12 each side", "30 s"' },
  rest_seconds: { type: 'number' },
  notes: { type: 'string', description: 'one short form/progression cue' },
})
const DAY = obj({
  day: { type: 'string' },
  rest: { type: 'boolean' },
  focus: { type: 'string', description: 'e.g. "Upper body push", "Rest / light walk"' },
  duration_min: { type: 'number' },
  exercises: { type: 'array', items: EXERCISE },
})

interface Prefs {
  days_per_week: number
  session_minutes: number
  equipment: string
  focus: string
  experience: string
  limitations: string
}

const DEFAULT_PREFS: Prefs = {
  days_per_week: 3,
  session_minutes: 45,
  equipment: 'gym',
  focus: 'general',
  experience: 'beginner',
  limitations: '',
}

const EQUIPMENT_TEXT: Record<string, string> = {
  gym: 'a full gym (barbells, dumbbells, machines, cables)',
  home_dumbbells: 'home with a pair of adjustable dumbbells and a bench/chair',
  bodyweight: 'bodyweight only, no equipment',
}

function prefsFrom(raw: unknown): Prefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Prefs>
  return {
    days_per_week: Math.min(6, Math.max(2, Number(p.days_per_week) || DEFAULT_PREFS.days_per_week)),
    session_minutes: Math.min(120, Math.max(20, Number(p.session_minutes) || DEFAULT_PREFS.session_minutes)),
    equipment: typeof p.equipment === 'string' && EQUIPMENT_TEXT[p.equipment] ? p.equipment : DEFAULT_PREFS.equipment,
    focus: typeof p.focus === 'string' ? p.focus : DEFAULT_PREFS.focus,
    experience: typeof p.experience === 'string' ? p.experience : DEFAULT_PREFS.experience,
    limitations: typeof p.limitations === 'string' ? p.limitations.slice(0, 300) : '',
  }
}

// Monday of the current week (UTC), YYYY-MM-DD.
function weekStart(): string {
  const d = new Date()
  const diff = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().split('T')[0]
}

// deno-lint-ignore no-explicit-any
function cleanExercise(e: any) {
  return {
    name: String(e?.name ?? '').slice(0, 80),
    sets: Math.min(10, Math.max(1, Math.round(Number(e?.sets) || 3))),
    reps: String(e?.reps ?? '10').slice(0, 30),
    rest_seconds: Math.min(300, Math.max(0, Math.round(Number(e?.rest_seconds) || 60))),
    notes: String(e?.notes ?? '').slice(0, 160),
  }
}

// deno-lint-ignore no-explicit-any
function cleanDay(d: any, fallbackName: string) {
  const rest = Boolean(d?.rest)
  return {
    day: typeof d?.day === 'string' && d.day ? d.day : fallbackName,
    rest,
    focus: String(d?.focus ?? (rest ? 'Rest' : 'Workout')).slice(0, 60),
    duration_min: rest ? 0 : Math.min(150, Math.max(10, Math.round(Number(d?.duration_min) || 45))),
    exercises: rest ? [] : (Array.isArray(d?.exercises) ? d.exercises : []).slice(0, 12).map(cleanExercise),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let userId: string | null = null
  try {
    userId = await requireUserId(req)
    const body = await readJsonBody(req)
    const mode = body.mode
    if (mode !== 'week' && mode !== 'day' && mode !== 'swap') throw new HttpError(400, 'Unknown plan action.')

    const supabase = serviceClient()
    await enforceAiQuota(supabase, userId)

    const [profileRes, goalsRes, inbodyRes, planRes] = await Promise.all([
      supabase.from('profiles').select('age, sex, height_cm, current_weight_kg, activity_level, health_conditions, workout_prefs').eq('id', userId).maybeSingle(),
      supabase.from('goals').select('goal_type, target_weight_kg, weekly_rate_kg, daily_steps_target').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('inbody_reports').select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, raw_extracted_json, extraction_version').eq('user_id', userId).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workout_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (!profileRes.data) throw new HttpError(400, 'Finish your health profile first.')
    const prefs = prefsFrom(profileRes.data.workout_prefs)
    const scan = inbodyRes.data
    // deno-lint-ignore no-explicit-any
    const segmental = scan && scan.extraction_version >= 2 ? (scan.raw_extracted_json as any)?.segmental_lean ?? null : null

    const context = `Athlete profile: ${JSON.stringify({ ...profileRes.data, workout_prefs: undefined })}
Goal: ${JSON.stringify(goalsRes.data)}
Latest body scan: ${JSON.stringify(scan ? { scanned_at: scan.scanned_at, weight_kg: scan.weight_kg, body_fat_pct: scan.body_fat_pct, skeletal_muscle_kg: scan.muscle_mass_kg, segmental_lean: segmental } : null)}
Preferences: ${prefs.days_per_week} training days a week, about ${prefs.session_minutes} minutes per session, ${EQUIPMENT_TEXT[prefs.equipment]}, focus: ${prefs.focus}, experience: ${prefs.experience}.
Injuries / limitations: ${prefs.limitations || 'none stated'} — never program exercises that load these.
Rules: realistic volume for the experience level; compound lifts first; include a warm-up cue in the first exercise notes; fit the session length; if the scan shows one side noticeably weaker, add unilateral work for it.`

    if (mode === 'week') {
      const schema = obj({ days: { type: 'array', items: DAY } })
      const data = await chatCompletion(
        supabase,
        'workout_plan',
        {
          max_completion_tokens: 3500,
          response_format: { type: 'json_schema', json_schema: { name: 'workout_week', strict: true, schema } },
          messages: [
            { role: 'system', content: 'You are an expert strength and conditioning coach. Return only the JSON plan.' },
            {
              role: 'user',
              content: `${context}\n\nBuild a 7-day plan, Monday to Sunday, with exactly ${prefs.days_per_week} training days spread out (avoid more than 2 training days in a row) and the remaining days marked rest: true with focus "Rest / light walk" and no exercises. Give every training day a clear focus.`,
            },
          ],
        },
        { timeoutMs: 80_000 }
      )
      const parsed = parseModelJson(data.choices?.[0]?.message?.content)
      const rawDays = Array.isArray(parsed?.days) ? (parsed!.days as unknown[]) : []
      if (rawDays.length === 0) throw new Error('Workout plan generation returned no days')
      const days = DAYS.map((name, i) => cleanDay(rawDays[i], name))
      const { data: row, error } = await supabase
        .from('workout_plans')
        .insert({ user_id: userId, week_start_date: weekStart(), plan_json: { days } })
        .select()
        .single()
      if (error) throw new Error(`saving workout plan failed: ${error.message}`)
      return json(row)
    }

    // day / swap edit the latest plan in place.
    const plan = planRes.data
    // deno-lint-ignore no-explicit-any
    const days: any[] = Array.isArray((plan?.plan_json as any)?.days) ? [...(plan!.plan_json as any).days] : []
    const dayIndex = Number(body.day_index)
    if (!plan || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= days.length) throw new HttpError(400, 'Build a plan first.')
    const day = days[dayIndex]

    if (mode === 'day') {
      const data = await chatCompletion(
        supabase,
        'workout_plan',
        {
          max_completion_tokens: 1500,
          response_format: { type: 'json_schema', json_schema: { name: 'workout_day', strict: true, schema: DAY } },
          messages: [
            { role: 'system', content: 'You are an expert strength and conditioning coach. Return only the JSON day.' },
            {
              role: 'user',
              content: `${context}\n\nThe rest of the week: ${JSON.stringify(days.map((d, i) => (i === dayIndex ? '(this day)' : `${d.day}: ${d.focus}`)))}\nWrite a fresh ${day.day} session${day.rest ? ' (it is currently a rest day — make it a short active-recovery/mobility session)' : ` with the same focus ("${day.focus}") but different exercises from these: ${JSON.stringify((day.exercises ?? []).map((e: { name: string }) => e.name))}`}.`,
            },
          ],
        },
        { timeoutMs: 60_000 }
      )
      const parsed = parseModelJson(data.choices?.[0]?.message?.content)
      if (!parsed) throw new Error('Day regeneration returned no JSON')
      days[dayIndex] = { ...cleanDay(parsed, day.day), day: day.day, rest: false }
    } else {
      const exerciseIndex = Number(body.exercise_index)
      const exercises = Array.isArray(day.exercises) ? [...day.exercises] : []
      if (!Number.isInteger(exerciseIndex) || exerciseIndex < 0 || exerciseIndex >= exercises.length) throw new HttpError(400, 'That exercise no longer exists.')
      const current = exercises[exerciseIndex]
      const data = await chatCompletion(
        supabase,
        'workout_plan',
        {
          max_completion_tokens: 400,
          response_format: { type: 'json_schema', json_schema: { name: 'exercise', strict: true, schema: EXERCISE } },
          messages: [
            { role: 'system', content: 'You are an expert strength and conditioning coach. Return only the JSON exercise.' },
            {
              role: 'user',
              content: `${context}\n\nSwap "${current.name}" (${current.sets} x ${current.reps}) in the ${day.day} "${day.focus}" session for a different exercise that trains the same muscles with similar sets and reps. It must not be any of: ${JSON.stringify(exercises.map((e: { name: string }) => e.name))}.`,
            },
          ],
        },
        { timeoutMs: 40_000 }
      )
      const parsed = parseModelJson(data.choices?.[0]?.message?.content)
      if (!parsed?.name) throw new Error('Exercise swap returned no exercise')
      exercises[exerciseIndex] = cleanExercise(parsed)
      days[dayIndex] = { ...day, exercises }
    }

    const { data: row, error } = await supabase
      .from('workout_plans')
      .update({ plan_json: { days } })
      .eq('id', plan.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw new Error(`updating workout plan failed: ${error.message}`)
    return json(row)
  } catch (e) {
    return await errorResponse('ai-workout-plan', e, userId)
  }
})
