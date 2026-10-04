import { chatCompletion, parseModelJson } from '../_shared/ai.ts'
import { CORS, HttpError, enforceAiQuota, errorResponse, json, readJsonBody, requireUserId, serviceClient } from '../_shared/http.ts'

// ---- Structured-output schema for a full InBody printout (strict: every key required,
// unreadable values come back as null — never guessed). ----
const num = { type: ['number', 'null'] }
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const segmentValue = obj({ kg: num, pct: num })
const segments = obj({ right_arm: segmentValue, left_arm: segmentValue, trunk: segmentValue, right_leg: segmentValue, left_leg: segmentValue })

const DETAILS_SCHEMA = obj({
  scan_date: { type: ['string', 'null'], description: 'Test date printed on the sheet, as YYYY-MM-DD' },
  device_model: { type: ['string', 'null'] },
  core: obj({
    weight_kg: num,
    skeletal_muscle_mass_kg: num,
    body_fat_mass_kg: num,
    percent_body_fat: num,
    bmi: num,
    visceral_fat_level: num,
    bmr_kcal: num,
    inbody_score: num,
  }),
  body_composition: obj({
    total_body_water_l: num,
    intracellular_water_l: num,
    extracellular_water_l: num,
    protein_kg: num,
    minerals_kg: num,
    bone_mineral_content_kg: num,
    fat_free_mass_kg: num,
    soft_lean_mass_kg: num,
  }),
  segmental_lean: segments,
  segmental_fat: segments,
  ecw_tbw_ratio: num,
  research: obj({
    waist_hip_ratio: num,
    waist_circumference_cm: num,
    obesity_degree_pct: num,
    smi_kg_m2: num,
    phase_angle_deg: num,
    body_cell_mass_kg: num,
    recommended_calorie_intake_kcal: num,
  }),
  weight_control: obj({
    target_weight_kg: num,
    weight_control_kg: num,
    fat_control_kg: num,
    muscle_control_kg: num,
  }),
  reference_ranges: {
    type: 'array',
    items: obj({ metric: { type: 'string' }, low: num, high: num }),
  },
  other_values: {
    type: 'array',
    items: obj({ label: { type: 'string' }, value: { type: 'string' } }),
  },
})

const RESPONSE_SCHEMA = obj({ details: DETAILS_SCHEMA, notes: { type: 'string' } })

const PROMPT = `This is a photo of an InBody (or similar bioimpedance) body-composition result sheet. Read EVERY section of the sheet carefully and fill the schema:
- Body Composition Analysis: total body water (and intracellular/extracellular water if printed), protein, minerals, bone mineral content, body fat mass, fat-free mass, soft lean mass, weight.
- Muscle-Fat Analysis: weight, skeletal muscle mass (SMM), body fat mass.
- Obesity Analysis: BMI, percent body fat (PBF).
- Segmental Lean Analysis and Segmental Fat Analysis: for right arm, left arm, trunk, right leg, left leg — the kg value and the % value printed for each.
- ECW/TBW ratio (whole body).
- Research parameters / additional data: visceral fat level, BMR, waist-hip ratio, waist circumference, obesity degree, SMI, phase angle, body cell mass, recommended calorie intake.
- Weight Control: target weight, weight control, fat control, muscle control (negative numbers mean "lose").
- InBody score, device model and test date.
Normal ranges are usually printed in parentheses or as bars next to values, e.g. "94.2 (60.6 - 82.0)": record each one in reference_ranges using the schema key as metric (e.g. "weight_kg", "percent_body_fat", "skeletal_muscle_mass_kg").
Put any other printed label/value pairs (e.g. body composition history) in other_values.
Units: kg, litres, %, kcal, degrees. If a value is not printed or you cannot read it clearly, use null — NEVER guess or estimate a number.
"notes": 2-3 short, encouraging, specific coach sentences about this scan (mention the most important strength and the most important thing to work on).`

function finiteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// Recursively replace any non-finite number with null (defence in depth on model output).
// deno-lint-ignore no-explicit-any
function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]))
  }
  if (typeof value === 'number') return finiteOrNull(value)
  return value
}

function validScanDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const t = Date.parse(`${v}T12:00:00Z`)
  return Number.isFinite(t) && t <= Date.now() + 24 * 60 * 60 * 1000 ? v : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let userId: string | null = null
  try {
    userId = await requireUserId(req)
    const body = await readJsonBody(req)
    // Accept a storage path ("<userId>/<file>.jpg") or a full URL containing it.
    const raw = typeof body.photo_path === 'string' ? body.photo_path : typeof body.photo_url === 'string' ? body.photo_url : ''
    const path = raw.includes('/inbody-photos/') ? raw.split('/inbody-photos/')[1] : raw
    if (!path) throw new HttpError(400, 'Missing InBody photo.')
    if (path.split('/')[0] !== userId) throw new HttpError(403, 'Forbidden')

    const supabase = serviceClient()
    await enforceAiQuota(supabase, userId)

    const { data: signed, error: signErr } = await supabase.storage.from('inbody-photos').createSignedUrl(path, 300)
    if (signErr || !signed) {
      console.error('inbody photo sign failed:', signErr?.message)
      throw new HttpError(400, "We couldn't read that photo. Please retake it and try again.")
    }

    const data = await chatCompletion(
      supabase,
      'inbody_analysis',
      {
        max_completion_tokens: 3000,
        response_format: { type: 'json_schema', json_schema: { name: 'inbody_sheet', strict: true, schema: RESPONSE_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              // High detail: InBody sheets are dense with small print.
              { type: 'image_url', image_url: { url: signed.signedUrl, detail: 'high' } },
            ],
          },
        ],
      },
      { timeoutMs: 80_000 }
    )

    const parsed = parseModelJson(data.choices?.[0]?.message?.content)
    if (!parsed || !parsed.details || typeof parsed.details !== 'object') {
      throw new Error('InBody analysis returned no parsable details')
    }
    const details = sanitize(parsed.details)
    details.scan_date = validScanDate(details.scan_date)
    const { core, body_composition: comp, research, weight_control: control } = details

    return json({
      // Headline fields (also what older app builds read).
      weight_kg: core.weight_kg,
      body_fat_pct: core.percent_body_fat,
      muscle_mass_kg: core.skeletal_muscle_mass_kg,
      visceral_fat: core.visceral_fat_level,
      bmr: core.bmr_kcal === null ? null : Math.round(core.bmr_kcal),
      // Extra trend metrics (typed columns).
      bmi: core.bmi,
      body_fat_mass_kg: core.body_fat_mass_kg,
      fat_free_mass_kg: comp.fat_free_mass_kg,
      total_body_water_l: comp.total_body_water_l,
      ecw_tbw_ratio: details.ecw_tbw_ratio,
      inbody_score: core.inbody_score === null ? null : Math.round(core.inbody_score),
      smi: research.smi_kg_m2,
      phase_angle: research.phase_angle_deg,
      waist_hip_ratio: research.waist_hip_ratio,
      target_weight_kg: control.target_weight_kg,
      scan_date: details.scan_date,
      details,
      raw: details,
      notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 600) : '',
    })
  } catch (e) {
    return await errorResponse('ai-inbody-analysis', e, userId)
  }
})
