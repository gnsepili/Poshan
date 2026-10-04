import { supabase } from '../supabase'
import { AI_LIMIT_MESSAGE } from '../utils/rateLimit'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const DEFAULT_TIMEOUT_MS = 30_000

export const OFFLINE_MESSAGE = "Can't reach Poshan right now. Check your connection and try again."
export const TIMEOUT_MESSAGE = 'This is taking longer than usual. Please try again in a moment.'
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.'
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.'

export class EdgeFunctionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'EdgeFunctionError'
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function messageFor(status: number, body: unknown): string {
  if (status === 429) return AI_LIMIT_MESSAGE
  if (status === 401) return SESSION_EXPIRED_MESSAGE
  const serverMessage = (body as { error?: unknown } | null | undefined)?.error
  return typeof serverMessage === 'string' && serverMessage ? serverMessage : SERVER_ERROR_MESSAGE
}

// The single way the app calls a Supabase edge function: session auth, a hard timeout,
// and errors that are always a readable sentence (never a JSON parse error or a raw body).
export async function invokeEdgeFunction<T>(
  name: string,
  body?: unknown,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token ?? SUPABASE_ANON_KEY

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    const aborted = (e as { name?: string } | null)?.name === 'AbortError'
    throw new EdgeFunctionError(aborted ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE, 0)
  } finally {
    clearTimeout(timer)
  }

  const parsed = parseJson(await response.text())
  if (!response.ok) throw new EdgeFunctionError(messageFor(response.status, parsed), response.status)
  if (parsed === undefined) throw new EdgeFunctionError(SERVER_ERROR_MESSAGE, response.status)
  return parsed as T
}
