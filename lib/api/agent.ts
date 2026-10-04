import { invokeEdgeFunction } from './edgeFunction'

export interface AgentResponse {
  reply: string
  /** null for one-off (persist: false) requests. */
  conversation_id: string | null
  /** Set when this message started a new thread. */
  title?: string | null
}

// The agent may chain several model + tool calls, so it gets a longer timeout.
// persist:false = one-off request (no chat thread, no history), e.g. plan generation.
export function sendAgentMessage(
  message: string,
  conversationId?: string,
  { persist = true }: { persist?: boolean } = {}
): Promise<AgentResponse> {
  return invokeEdgeFunction<AgentResponse>(
    'ai-agent',
    { message, conversation_id: conversationId, persist },
    { timeoutMs: 90_000 }
  )
}
