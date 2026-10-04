import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, parseModelJson } from '../_shared/ai.ts'
import { logEdgeError } from '../_shared/logError.ts'
import { CORS, enforceAiQuota, errorResponse, json, requireUserId, serviceClient } from '../_shared/http.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const SEND_PUSH_URL = `${SUPABASE_URL}/functions/v1/send-push`

// Same coaching principles the ai-agent applies. Duplicated here because each
// edge function is an isolated Deno deployment (no shared import across functions).
const COACHING_PRINCIPLES = `
Coaching principles (apply when setting goals or writing the note):
- Protein first: prioritise the daily protein target; never cut protein to make calories fit.
- Moderate deficit over aggressive: prefer a sustainable ~10-20% calorie deficit for fat loss.
- Carbs are training fuel: keep carbohydrates around training days; do not fear them when active.
- Scale-weight is noisy: judge trends over 1-2 weeks, cross-checked against InBody body-fat and muscle-mass trends.
- Safety floors: never recommend calories below ~1200 kcal/day (women) or ~1500 kcal/day (men), nor below the protein target.
`.trim()

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function generateForUser(userId: string, supabase: SupabaseClient): Promise<Record<string, unknown> | null> {
  const today = isoDate(new Date())
  const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

  // 1. Roll up YESTERDAY's meals + activity into yesterday's summary row.
  const [yMealsRes, yActivityRes] = await Promise.all([
    supabase.from('meals').select('total_calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId).gte('logged_at', `${yesterday}T00:00:00`).lte('logged_at', `${yesterday}T23:59:59`),
    supabase.from('activity_logs').select('steps')
      .eq('user_id', userId).gte('logged_at', `${yesterday}T00:00:00`).lte('logged_at', `${yesterday}T23:59:59`),
  ])
  const yMeals = (yMealsRes.data ?? []) as { total_calories: number; protein_g: number; carbs_g: number; fat_g: number }[]
  const yTotals = yMeals.reduce(
    (a, m) => ({ cal: a.cal + m.total_calories, p: a.p + m.protein_g, c: a.c + m.carbs_g, f: a.f + m.fat_g }),
    { cal: 0, p: 0, c: 0, f: 0 }
  )
  const ySteps = ((yActivityRes.data ?? []) as { steps: number }[]).reduce((a, x) => a + x.steps, 0)
  // Upsert ONLY the totals columns so an existing ai_coach_note on yesterday is preserved.
  const { error: rollupErr } = await supabase.from('daily_summaries').upsert(
    {
      user_id: userId,
      date: yesterday,
      total_calories_consumed: yTotals.cal,
      total_protein_g: yTotals.p,
      total_carbs_g: yTotals.c,
      total_fat_g: yTotals.f,
      total_steps: ySteps,
    },
    { onConflict: 'user_id,date' }
  )
  if (rollupErr) throw new Error(`yesterday rollup failed: ${rollupErr.message}`)

  // 2. Read recent trend, latest goals, latest InBody.
  const [trendRes, goalsRes, inbodyRes] = await Promise.all([
    supabase.from('daily_summaries').select('date, total_calories_consumed, total_protein_g, total_steps')
      .eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('inbody_reports').select('scanned_at, weight_kg, body_fat_pct, muscle_mass_kg, body_fat_mass_kg, visceral_fat, ecw_tbw_ratio, inbody_score, target_weight_kg')
      .eq('user_id', userId).order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // 3. gpt-4o produces today's ai_daily_goals + ai_coach_note.
  const prompt = `${COACHING_PRINCIPLES}

You are Poshan AI. Set today's targets and write a short morning coach note for this user.
Today's date: ${today}
Latest goals: ${JSON.stringify(goalsRes.data)}
Latest InBody scan: ${JSON.stringify(inbodyRes.data)}
Last 7 daily summaries (most recent first): ${JSON.stringify(trendRes.data)}

Respond with ONLY a JSON object, no markdown, with exactly:
{
  "ai_daily_goals": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "steps": number, "workout_suggestion": string },
  "ai_coach_note": "2-3 encouraging, specific sentences for this morning"
}
If there are no goals yet, base the targets on sensible maintenance defaults and say so briefly in the note.`

  const data = await chatCompletion(supabase, 'daily_summary', {
    max_completion_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })
  const parsed = (parseModelJson(data.choices?.[0]?.message?.content) ?? {}) as { ai_daily_goals?: unknown; ai_coach_note?: unknown }
  const aiDailyGoals = (parsed.ai_daily_goals && typeof parsed.ai_daily_goals === 'object') ? parsed.ai_daily_goals : null
  const aiCoachNote = typeof parsed.ai_coach_note === 'string' ? parsed.ai_coach_note : ''

  // 4. Upsert ONLY the AI columns onto today's row (preserves today's meal totals).
  const { error: aiWriteErr } = await supabase.from('daily_summaries').upsert(
    { user_id: userId, date: today, ai_daily_goals: aiDailyGoals, ai_coach_note: aiCoachNote },
    { onConflict: 'user_id,date' }
  )
  if (aiWriteErr) throw new Error(`today's coach note write failed: ${aiWriteErr.message}`)

  const { data: todayRow } = await supabase.from('daily_summaries')
    .select('*').eq('user_id', userId).eq('date', today).maybeSingle()
  return todayRow ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let userId: string | null = null
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    // Cron mode ONLY when CRON_SECRET is configured AND the header matches exactly.
    if (CRON_SECRET && cronSecret === CRON_SECRET) {
      const supabase = serviceClient()
      const { data: profiles, error } = await supabase.from('profiles').select('id')
      if (error) throw new Error(error.message)
      let generated = 0
      const notifications: { user_id: string; title: string; body: string }[] = []
      for (const p of (profiles ?? []) as { id: string }[]) {
        try {
          const row = await generateForUser(p.id, supabase)
          generated += 1
          const note = (row?.ai_coach_note as string | undefined) ?? ''
          if (note) notifications.push({ user_id: p.id, title: 'Your morning coach note', body: note })
        } catch (e) {
          // Skip one bad user, keep the batch going — but record why.
          await logEdgeError(supabase, 'generate-daily-summary:cron-user', e, p.id)
        }
      }
      // Best-effort: one send-push call for the whole batch (the single send path).
      if (notifications.length > 0) {
        try {
          await fetch(SEND_PUSH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': CRON_SECRET,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ notifications }),
          })
        } catch (e) {
          // Push is best-effort; never fail the cron over it.
          await logEdgeError(supabase, 'generate-daily-summary:push', e)
        }
      }
      return json({ ok: true, generated })
    }

    // User (lazy) mode: derive the single user from the JWT.
    userId = await requireUserId(req)
    const supabase = serviceClient()
    await enforceAiQuota(supabase, userId)
    const todayRow = await generateForUser(userId, supabase)
    return json(todayRow)
  } catch (e) {
    return await errorResponse('generate-daily-summary', e, userId)
  }
})
