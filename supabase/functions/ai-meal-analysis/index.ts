import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const authClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const description: string | undefined = body.description
    // Accept either a storage path ("<userId>/<file>.jpg") or a full URL containing it.
    const raw: string = body.photo_path ?? body.photo_url ?? ''
    const path = raw.includes('/meal-photos/') ? raw.split('/meal-photos/')[1] : raw
    if (path.split('/')[0] !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const cap = Number(Deno.env.get('AI_DAILY_CALL_CAP') ?? '50')
    const { data: allowed } = await supabase.rpc('check_and_increment_ai_usage', { p_user_id: userData.user.id, p_cap: cap })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "You've reached today's AI limit. It resets at midnight." }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const { data: signed, error: signErr } = await supabase.storage.from('meal-photos').createSignedUrl(path, 120)
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: `Could not access photo: ${signErr?.message ?? 'unknown'}` }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const prompt = `Analyse this meal photo${description ? ` (the user says: "${description}")` : ''}. Estimate the nutrition. Respond with ONLY a JSON object, no markdown, with exactly these fields:
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 512,
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
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return new Response(JSON.stringify({ error: `OpenAI error ${res.status}: ${text}` }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const data = await res.json()
    const text: string = data.choices[0].message.content ?? '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch {
      const m = text.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, suggestions: '', items: [] }
    }

    return new Response(JSON.stringify(parsed), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
