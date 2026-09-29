import { supabase } from '../supabase'
import { DailySummary } from '../../types'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// User (lazy) mode: derive the user server-side from the JWT; never send a user_id.
export async function generateDailySummary(): Promise<DailySummary | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  })

  const body: unknown = await response.json()
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Daily summary request failed with status ${response.status}`
    throw new Error(message)
  }
  return body as DailySummary | null
}
