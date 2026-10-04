import { TOOL_DEFINITIONS, executeTool } from './tools.ts'
import { assembleContext } from './context.ts'
import { chatCompletion } from '../_shared/ai.ts'
import { logEdgeError } from '../_shared/logError.ts'
import { CORS, HttpError, enforceAiQuota, errorResponse, json, readJsonBody, requireUserId, serviceClient } from '../_shared/http.ts'

const MAX_MESSAGE = 4000
const HISTORY_LIMIT = 20
const MAX_TOOL_ROUNDS = 5
// Whole-request budget, kept under the app's 90s timeout so the app never gives up
// (and lets the user resend) while tools here are still logging meals/activities.
const REQUEST_BUDGET_MS = 75_000
const PER_CALL_TIMEOUT_MS = 40_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Thread title from its first message: whitespace collapsed, cut at a word near 50 chars.
function threadTitle(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim()
  if (flat.length <= 50) return flat
  const cut = flat.slice(0, 50)
  const space = cut.lastIndexOf(' ')
  return `${space > 30 ? cut.slice(0, space) : cut}…`
}

// Coaching principles adapted (content only, not its file-storage mechanics) from the
// MIT-licensed NataMoroz/nutrition-coach skill: https://github.com/NataMoroz/nutrition-coach
const COACHING_PRINCIPLES = `
Coaching principles (apply when advising or adjusting the plan):
- Protein first: prioritise hitting the daily protein target — it preserves lean mass in a deficit and drives recovery. Never cut protein to make calories fit.
- Moderate deficit over aggressive: prefer a sustainable ~10-20% calorie deficit for fat loss; aggressive deficits cost muscle and adherence.
- Carbs are training fuel: keep carbohydrates around training days; do not fear them when the user is active.
- Peri-workout fueling: suggest carbs + protein before and after workouts for performance and recovery.
- Scale-weight is noisy: daily weight swings are water, glycogen, and gut content. Judge trends over 1-2 weeks and cross-check against InBody body-fat and muscle-mass trends, not single readings.
- Sex-based and female-physiology nuance: for women, expect cycle-phase water shifts; do NOT push an aggressive deficit while breastfeeding (protect milk supply — keep adequate calories and fluids); prioritise postpartum recovery over fat loss; keep iron/ferritin and bone-density (calcium, vitamin D) awareness.
- Safety floors: never recommend calories below a safe floor (~1200 kcal/day for women, ~1500 kcal/day for men) and never below the user's protein target. If the math would breach a floor, extend the timeline instead.
`.trim()

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let userId: string | null = null
  try {
    userId = await requireUserId(req)
    const body = await readJsonBody(req)
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) throw new HttpError(400, 'Please type a message first.')
    if (message.length > MAX_MESSAGE) throw new HttpError(400, `Messages can be up to ${MAX_MESSAGE} characters.`)
    // persist:false = a one-off request (e.g. "generate my meal plan") that must not create
    // a chat thread or carry history.
    const persist = body.persist !== false

    const supabase = serviceClient()
    await enforceAiQuota(supabase, userId)

    // Continue the caller's own thread, or start a new one (a thread id that doesn't exist or
    // belongs to someone else always starts fresh — never exposes another user's messages).
    const requestedConv = typeof body.conversation_id === 'string' && UUID_RE.test(body.conversation_id) ? body.conversation_id : ''
    let convId: string = crypto.randomUUID()
    let isNewThread = true
    if (persist && requestedConv) {
      const { data: existing, error: convErr } = await supabase.from('conversations').select('user_id').eq('id', requestedConv).maybeSingle()
      if (convErr) throw new Error(`conversation lookup failed: ${convErr.message}`)
      if (existing && existing.user_id === userId) {
        convId = requestedConv
        isNewThread = false
      }
    }

    let history: { role: string; content: string }[] = []
    if (!isNewThread) {
      const { data: recent, error: historyErr } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', convId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (historyErr) throw new Error(`chat history read failed: ${historyErr.message}`)
      history = ((recent ?? []) as { role: string; content: string }[]).reverse()
    }

    const systemContext = await assembleContext(userId, supabase)

    const messages: OpenAiMessage[] = [
      {
        role: 'system',
        content: `You are Poshan AI, a warm, encouraging personal health coach. You have full access to the user's health data below. Be concise, practical, and specific. When the user tells you what they ate, estimate macros and log the meal with the log_meal tool. When they describe a workout, log it with log_activity. Use get_inbody_history and daily summaries to judge progress, and use adjust_diet_plan (which appends a new goals row) when results warrant a change.\n\n${COACHING_PRINCIPLES}\n\n${systemContext}`,
      },
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ]

    const deadline = Date.now() + REQUEST_BUDGET_MS
    let toolsRan = false
    let reply = ''
    for (let i = 0; i < MAX_TOOL_ROUNDS; i++) {
      const remaining = deadline - Date.now()
      if (remaining < 5_000) {
        if (!toolsRan) throw new DOMException('agent request budget exhausted', 'TimeoutError')
        reply = "Done — I've saved that. I ran out of time to write a full reply, so ask me again if you'd like the details."
        break
      }
      const data = await chatCompletion(
        supabase,
        'chat',
        { max_completion_tokens: 1024, messages, tools: TOOL_DEFINITIONS },
        { timeoutMs: Math.min(PER_CALL_TIMEOUT_MS, remaining) }
      )
      const msg = data.choices?.[0]?.message
      if (!msg) throw new Error('chat completion returned no message')

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(tc.function.arguments || '{}') } catch { args = {} }
          const result = await executeTool(tc.function.name, args, userId, supabase)
          toolsRan = true
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
        }
        continue
      }

      reply = msg.content ?? ''
      break
    }

    if (!reply) reply = "I processed that, but I don't have anything else to add."

    if (!persist) return json({ reply, conversation_id: null })

    // Persist the turn only once it succeeded, so a failed send (which the app lets the
    // user retry) never leaves an orphan message or an empty thread behind.
    const now = Date.now()
    const title = isNewThread ? threadTitle(message) : undefined
    const { error: threadErr } = isNewThread
      ? await supabase.from('conversations').insert({ id: convId, user_id: userId, title })
      : await supabase.from('conversations').update({ updated_at: new Date(now).toISOString() }).eq('id', convId)
    if (threadErr) {
      await logEdgeError(supabase, 'ai-agent:save-thread', new Error(threadErr.message), userId)
    } else {
      const { error: saveErr } = await supabase.from('chat_messages').insert([
        { user_id: userId, conversation_id: convId, role: 'user', content: message, created_at: new Date(now).toISOString() },
        { user_id: userId, conversation_id: convId, role: 'assistant', content: reply, created_at: new Date(now + 1).toISOString() },
      ])
      if (saveErr) await logEdgeError(supabase, 'ai-agent:save-turn', new Error(saveErr.message), userId)
    }

    return json({ reply, conversation_id: convId, title: title ?? null })
  } catch (e) {
    return await errorResponse('ai-agent', e, userId)
  }
})
