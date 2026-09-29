import { supabase } from './supabase'
import { Database } from './database.types'

type EventInsert = Database['public']['Tables']['events']['Insert']

// Self-hosted, best-effort error monitoring + analytics (NOT Sentry). Telemetry must
// never throw into the app or mask the original error — every public function here
// swallows its own failures. Never log secrets, tokens, or full payloads: context +
// message + stack (or an event name + small props) only.

export function shapeError(context: string, error: unknown): { context: string; message: string; stack: string | null } {
  if (error instanceof Error) return { context, message: error.message, stack: error.stack ?? null }
  return { context, message: String(error), stack: null }
}

// RLS requires auth.uid() = user_id on insert, so an explicit userId isn't optional
// in practice — most callers (ErrorBoundary, store events) don't have one handy.
// Fall back to the current session's user id. Isolated in its own try/catch: a
// getSession failure must not abort the insert (it just leaves user_id null, which
// RLS will then reject — swallowed like any other best-effort failure).
async function resolveUserId(userId?: string): Promise<string | null> {
  if (userId) return userId
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  } catch {
    return null
  }
}

export async function logError(context: string, error: unknown, userId?: string): Promise<void> {
  try {
    const shaped = shapeError(context, error)
    const uid = await resolveUserId(userId)
    await supabase.from('error_logs').insert({ ...shaped, user_id: uid })
  } catch {
    /* swallow — telemetry failures must never crash the app or mask the original error */
  }
}

export async function logEvent(name: string, props: Record<string, unknown> = {}, userId?: string): Promise<void> {
  try {
    const uid = await resolveUserId(userId)
    await supabase.from('events').insert({ name, props, user_id: uid } as EventInsert)
  } catch {
    /* swallow — telemetry failures must never crash the app */
  }
}
