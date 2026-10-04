import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logEdgeError } from '../_shared/logError.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

interface Notification {
  user_id: string
  title: string
  body: string
  data?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // Server-only send path: require the cron secret exactly (no user-invocable send).
    const cronSecret = req.headers.get('x-cron-secret')
    if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const notifications: Notification[] = Array.isArray(body.notifications) ? body.notifications : []
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Resolve each user's device tokens.
    const messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[] = []
    const tokenToUser = new Map<string, string>()
    for (const n of notifications) {
      const { data: tokens, error: tokenErr } = await supabase.from('push_tokens').select('token').eq('user_id', n.user_id)
      if (tokenErr) await logEdgeError(supabase, 'send-push:tokens', new Error(tokenErr.message), n.user_id)
      for (const t of ((tokens ?? []) as { token: string }[])) {
        tokenToUser.set(t.token, n.user_id)
        messages.push({ to: t.token, title: n.title, body: n.body, data: n.data })
      }
    }
    if (messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Expo Push API (chunks of 100).
    let sent = 0
    const stale: string[] = []
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100)
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      })
      if (!res.ok) {
        await logEdgeError(supabase, 'send-push:expo', new Error(`Expo push ${res.status}: ${(await res.text()).slice(0, 300)}`))
        continue
      }
      const json = await res.json()
      const tickets = (json.data ?? []) as { status: string; details?: { error?: string } }[]
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') { sent += 1; return }
        if (ticket.details?.error === 'DeviceNotRegistered') stale.push(chunk[idx].to)
      })
    }

    // Prune tokens Expo reports as unregistered so we stop sending into the void.
    if (stale.length > 0) await supabase.from('push_tokens').delete().in('token', stale)

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    try {
      const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      await logEdgeError(svc, 'send-push', e)
    } catch (_ignore) {
      /* logging is best-effort */
    }
    return new Response(JSON.stringify({ error: 'Push send failed.' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
