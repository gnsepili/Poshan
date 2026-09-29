import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!

// A metric the model cannot clearly read must come back as null — never a guess.
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function intOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null
}

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
    // Accept a storage path ("<userId>/<file>.jpg") or a full URL containing it.
    const raw: string = body.photo_path ?? body.photo_url ?? ''
    const path = raw.includes('/inbody-photos/') ? raw.split('/inbody-photos/')[1] : raw
    if (!path) {
      return new Response(JSON.stringify({ error: 'Missing photo_url' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: signed, error: signErr } = await supabase.storage.from('inbody-photos').createSignedUrl(path, 120)
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: `Could not access photo: ${signErr?.message ?? 'unknown'}` }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const prompt = `This is a photo of an InBody (or similar) body-composition scan printout. Read the printed values. Respond with ONLY a JSON object, no markdown, with exactly these fields:
{
  "weight_kg": number or null,
  "body_fat_pct": number or null,
  "muscle_mass_kg": number or null,
  "visceral_fat": number or null,
  "bmr": number or null,
  "raw": { "<label>": "<value as printed>", ... },
  "notes": "one short, encouraging coach note about this scan"
}
Rules: Use kilograms for weight and muscle mass, a percentage for body fat, kcal for BMR. If a value is not clearly printed or you are unsure, return null for that field — DO NOT guess or fabricate a number. Put every label/value pair you can read into "raw".`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 700,
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
      parsed = m ? JSON.parse(m[0]) : {}
    }

    const result = {
      weight_kg: numOrNull(parsed.weight_kg),
      body_fat_pct: numOrNull(parsed.body_fat_pct),
      muscle_mass_kg: numOrNull(parsed.muscle_mass_kg),
      visceral_fat: numOrNull(parsed.visceral_fat),
      bmr: intOrNull(parsed.bmr),
      raw: (parsed.raw && typeof parsed.raw === 'object') ? parsed.raw : parsed,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    }

    return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
