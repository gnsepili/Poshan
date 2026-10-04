import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Which model each feature uses is a backend flag (app_config row 'ai'), not a user setting.
export type AiFeature = 'chat' | 'meal_analysis' | 'inbody_analysis' | 'daily_summary' | 'workout_plan'

interface AiConfig {
  provider: string
  models: Partial<Record<AiFeature, string>>
}

const FALLBACK: AiConfig = { provider: 'openai', models: {} }
const DEFAULT_MODEL = 'gpt-4o'
const CONFIG_TTL_MS = 60_000
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!

// The AI provider answered with an error status. Logged server-side; never shown raw.
export class UpstreamError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'UpstreamError'
  }
}

let cached: { at: number; config: AiConfig } | null = null

// Cached per function instance so a config change applies within a minute.
export async function getAiConfig(svc: SupabaseClient): Promise<AiConfig> {
  if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.config
  const { data, error } = await svc.from('app_config').select('value').eq('key', 'ai').maybeSingle()
  if (error) console.error('app_config read failed, using defaults:', error.message)
  const value = (data?.value ?? {}) as Partial<AiConfig>
  const config: AiConfig = {
    provider: typeof value.provider === 'string' ? value.provider : FALLBACK.provider,
    models: value.models && typeof value.models === 'object' ? value.models : {},
  }
  cached = { at: Date.now(), config }
  return config
}

// One chat-completions call for a feature, using that feature's configured model.
// `request` is the OpenAI body minus `model`.
export async function chatCompletion(
  svc: SupabaseClient,
  feature: AiFeature,
  request: Record<string, unknown>,
  { timeoutMs = 45_000 }: { timeoutMs?: number } = {}
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const config = await getAiConfig(svc)
  if (config.provider !== 'openai') throw new Error(`AI provider "${config.provider}" is not supported yet`)
  const model = config.models[feature] ?? DEFAULT_MODEL

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, ...request }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new UpstreamError(res.status, `OpenAI ${res.status} (${feature}, ${model}): ${text.slice(0, 500)}`)
  }
  return await res.json()
}

// Parse a model's JSON answer, tolerating stray prose around the object.
export function parseModelJson(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}
