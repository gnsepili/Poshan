import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TOOL_DEFINITIONS, executeTool } from './tools.ts'
import { assembleContext } from './context.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const MODEL = 'gpt-4o'

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

async function callOpenAI(messages: OpenAiMessage[]) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages,
      tools: TOOL_DEFINITIONS,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${text}`)
  }
  return await res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const authClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const userId = userData.user.id

    const body = await req.json()
    const message: string = body.message
    const convId: string = body.conversation_id ?? crypto.randomUUID()

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Persist the user's message
    await supabase.from('chat_messages').insert({ user_id: userId, conversation_id: convId, role: 'user', content: message })

    // Load recent conversation history
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20)

    const systemContext = await assembleContext(userId, supabase)

    const messages: OpenAiMessage[] = [
      {
        role: 'system',
        content: `You are Poshan AI, a warm, encouraging personal health coach. You have full access to the user's health data below. Be concise, practical, and specific. When the user tells you what they ate, estimate macros and log the meal with the log_meal tool. When they describe a workout, log it with log_activity. Use get_inbody_history and daily summaries to judge progress, and use adjust_diet_plan (which appends a new goals row) when results warrant a change.\n\n${COACHING_PRINCIPLES}\n\n${systemContext}`,
      },
      ...(history ?? []).map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    let reply = ''
    for (let i = 0; i < 5; i++) {
      const data = await callOpenAI(messages)
      const choice = data.choices[0]
      const msg = choice.message

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
        for (const tc of msg.tool_calls) {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(tc.function.arguments || '{}') } catch { args = {} }
          const result = await executeTool(tc.function.name, args, userId, supabase)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
        }
        continue
      }

      reply = msg.content ?? ''
      break
    }

    if (!reply) reply = "I processed that, but I don't have anything else to add."

    await supabase.from('chat_messages').insert({ user_id: userId, conversation_id: convId, role: 'assistant', content: reply })

    return new Response(JSON.stringify({ reply, conversation_id: convId }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
