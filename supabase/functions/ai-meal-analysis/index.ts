import { chatCompletion, parseModelJson } from '../_shared/ai.ts'
import { CORS, HttpError, enforceAiQuota, errorResponse, json, readJsonBody, requireUserId, serviceClient } from '../_shared/http.ts'

const MAX_DESCRIPTION = 300

const num = { type: 'number' }
const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'items', 'total_calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'score', 'score_label', 'suggestions'],
  properties: {
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
        properties: { name: { type: 'string' }, portion: { type: 'string' }, calories: num, protein_g: num, carbs_g: num, fat_g: num },
      },
    },
    total_calories: num,
    protein_g: num,
    carbs_g: num,
    fat_g: num,
    fiber_g: num,
    score: num,
    score_label: { type: 'string' },
    suggestions: { type: 'string' },
  },
}

// Model output is untrusted: coerce every macro to a finite, non-negative number.
function macro(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let userId: string | null = null
  try {
    userId = await requireUserId(req)
    const body = await readJsonBody(req)
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, MAX_DESCRIPTION) : ''
    // Accept either a storage path ("<userId>/<file>.jpg") or a full URL containing it.
    const raw = typeof body.photo_path === 'string' ? body.photo_path : typeof body.photo_url === 'string' ? body.photo_url : ''
    const path = raw.includes('/meal-photos/') ? raw.split('/meal-photos/')[1] : raw
    if (!path) throw new HttpError(400, 'Missing meal photo.')
    if (path.split('/')[0] !== userId) throw new HttpError(403, 'Forbidden')

    const supabase = serviceClient()
    await enforceAiQuota(supabase, userId)

    const { data: signed, error: signErr } = await supabase.storage.from('meal-photos').createSignedUrl(path, 120)
    if (signErr || !signed) {
      console.error('meal photo sign failed:', signErr?.message)
      throw new HttpError(400, "We couldn't read that photo. Please retake it and try again.")
    }

    const prompt = `Analyse this meal photo${description ? ` (the user describes it as: ${JSON.stringify(description)})` : ''}. Identify each food item and estimate its portion and nutrition, then total them.
Rules: be realistic but slightly conservative; totals must equal the sum of the items; Indian home-style dishes are common.
"title": a short name for the whole meal (2-5 words).
"score": 1-10 for how well this meal supports a healthy, protein-forward diet (10 = excellent), and "score_label": 2-3 words explaining it (e.g. "High protein", "Carb heavy", "Balanced").
"suggestions": one short, specific, encouraging sentence on how to improve this meal.`

    const data = await chatCompletion(supabase, 'meal_analysis', {
      max_completion_tokens: 900,
      response_format: { type: 'json_schema', json_schema: { name: 'meal_analysis', strict: true, schema: MEAL_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: signed.signedUrl } },
          ],
        },
      ],
    })

    const parsed = parseModelJson(data.choices?.[0]?.message?.content)
    if (!parsed) throw new Error('Meal analysis returned no parsable JSON')

    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && typeof i.name === 'string')
      .slice(0, 20)
      .map((i) => ({
        name: String(i.name).slice(0, 80),
        portion: typeof i.portion === 'string' ? i.portion.slice(0, 40) : '',
        calories: Math.round(macro(i.calories)),
        protein_g: macro(i.protein_g),
        carbs_g: macro(i.carbs_g),
        fat_g: macro(i.fat_g),
      }))
    const score = Math.round(macro(parsed.score))

    return json({
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 60) : '',
      // Legacy shape (older app builds read `items` as names only).
      items: items.map((i) => i.name),
      item_breakdown: items,
      total_calories: Math.round(macro(parsed.total_calories)),
      protein_g: macro(parsed.protein_g),
      carbs_g: macro(parsed.carbs_g),
      fat_g: macro(parsed.fat_g),
      fiber_g: macro(parsed.fiber_g),
      score: score >= 1 && score <= 10 ? score : null,
      score_label: typeof parsed.score_label === 'string' ? parsed.score_label.slice(0, 30) : '',
      suggestions: typeof parsed.suggestions === 'string' ? parsed.suggestions.slice(0, 300) : '',
    })
  } catch (e) {
    return await errorResponse('ai-meal-analysis', e, userId)
  }
})
