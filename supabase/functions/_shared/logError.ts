import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-role insert into error_logs. Never throws (a logging failure must not
// mask the original error). Logs context + message + stack only — never secrets,
// tokens, or full request/response payloads.
export async function logEdgeError(
  supabase: SupabaseClient,
  context: string,
  error: unknown,
  userId?: string | null
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? (error.stack ?? null) : null
    await supabase.from('error_logs').insert({ context, message, stack, user_id: userId ?? null })
  } catch (_e) {
    /* swallow */
  }
}
