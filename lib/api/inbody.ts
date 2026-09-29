import { supabase } from '../supabase'
import { messageForStatus } from '../utils/rateLimit'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export interface InBodyAnalysisResult {
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  bmr: number | null
  raw: Record<string, unknown>
  notes: string
}

export async function analyzeInBodyPhoto(photoPath: string): Promise<InBodyAnalysisResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-inbody-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ photo_url: photoPath }),
  })

  const body: unknown = await response.json()

  if (!response.ok) {
    const fallback = (body as { error?: string } | null)?.error ?? `InBody analysis request failed with status ${response.status}`
    throw new Error(messageForStatus(response.status, fallback))
  }

  return body as InBodyAnalysisResult
}
