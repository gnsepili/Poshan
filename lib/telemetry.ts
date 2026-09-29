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

export async function logError(context: string, error: unknown, userId?: string): Promise<void> {
  try {
    const shaped = shapeError(context, error)
    await supabase.from('error_logs').insert({ ...shaped, user_id: userId ?? null })
  } catch {
    /* swallow — telemetry failures must never crash the app or mask the original error */
  }
}

export async function logEvent(name: string, props: Record<string, unknown> = {}, userId?: string): Promise<void> {
  try {
    await supabase.from('events').insert({ name, props, user_id: userId ?? null } as EventInsert)
  } catch {
    /* swallow — telemetry failures must never crash the app */
  }
}
