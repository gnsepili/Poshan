import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logEdgeError } from './logError.ts'
import { UpstreamError } from './ai.ts'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// An error whose message is safe and useful to show the user as-is.
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

// Resolve the calling user from their JWT, or reject with 401.
export async function requireUserId(req: Request): Promise<string> {
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data, error } = await authClient.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'Unauthorized')
  return data.user.id
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    throw new HttpError(400, 'Invalid request.')
  }
}

// Per-user daily AI call cap (env-configurable, default 50). Fails open if the counter
// itself errors, so a DB hiccup never blocks coaching.
export async function enforceAiQuota(svc: SupabaseClient, userId: string): Promise<void> {
  const cap = Number(Deno.env.get('AI_DAILY_CALL_CAP') ?? '50')
  const { data: allowed, error } = await svc.rpc('check_and_increment_ai_usage', { p_user_id: userId, p_cap: cap })
  if (error) console.error('ai_usage rpc failed (failing open):', error.message ?? error)
  if (allowed === false) throw new HttpError(429, "You've reached today's AI limit. It resets at midnight.")
}

// Turn any thrown error into a response. Only HttpError messages reach the client;
// everything else is logged (with the user id when known) and replaced by a generic sentence,
// so provider/storage error bodies never leak into the app.
export async function errorResponse(fn: string, e: unknown, userId?: string | null): Promise<Response> {
  if (e instanceof HttpError) return json({ error: e.message }, e.status)
  await logEdgeError(serviceClient(), fn, e, userId)
  const name = (e as { name?: string } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') {
    return json({ error: 'The AI took too long to respond. Please try again.' }, 504)
  }
  if (e instanceof UpstreamError) {
    return json({ error: 'The AI service is having trouble right now. Please try again in a minute.' }, 502)
  }
  return json({ error: 'Something went wrong on our side. Please try again.' }, 500)
}
