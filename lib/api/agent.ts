import { supabase } from '../supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export interface AgentResponse {
  reply: string
  conversation_id: string
}

export async function sendAgentMessage(
  message: string,
  conversationId?: string,
  photoUrl?: string
): Promise<AgentResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ message, conversation_id: conversationId, photo_url: photoUrl }),
  })

  const body: unknown = await response.json()

  if (!response.ok) {
    const message2 = (body as { error?: string } | null)?.error ?? `Agent request failed with status ${response.status}`
    throw new Error(message2)
  }

  return body as AgentResponse
}
