import { chatCompletion, parseModelJson } from '../_shared/ai.ts'
import { CORS, HttpError, enforceAiQuota, errorResponse, json, readJsonBody, requireUserId, serviceClient } from '../_shared/http.ts'

const MAX_DESCRIPTION = 300

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

    const prompt = `Analyse this meal photo${description ? ` (the user describes it as: ${JSON.stringify(description)})` : ''}. Estimate the nutrition. Respond with ONLY a JSON object, no markdown, with exactly these fields:
{
  "items": ["item1", "item2"],
  "total_calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "suggestions": "one short sentence with a healthier suggestion"
}
Be realistic but slightly conservative with estimates.`

    const data = await chatCompletion(supabase, 'meal_analysis', {
      max_completion_tokens: 512,
      response_format: { type: 'json_object' },
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

    return json({
      items: Array.isArray(parsed.items) ? parsed.items.filter((i): i is string => typeof i === 'string').slice(0, 20) : [],
      total_calories: Math.round(macro(parsed.total_calories)),
      protein_g: macro(parsed.protein_g),
      carbs_g: macro(parsed.carbs_g),
      fat_g: macro(parsed.fat_g),
      fiber_g: macro(parsed.fiber_g),
      suggestions: typeof parsed.suggestions === 'string' ? parsed.suggestions.slice(0, 300) : '',
    })
  } catch (e) {
    return await errorResponse('ai-meal-analysis', e, userId)
  }
})
