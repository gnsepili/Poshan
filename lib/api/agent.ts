import { invokeEdgeFunction } from './edgeFunction'

export interface AgentResponse {
  reply: string
  conversation_id: string
}

// The agent may chain several model + tool calls, so it gets a longer timeout.
export function sendAgentMessage(message: string, conversationId?: string, photoUrl?: string): Promise<AgentResponse> {
  return invokeEdgeFunction<AgentResponse>(
    'ai-agent',
    { message, conversation_id: conversationId, photo_url: photoUrl },
    { timeoutMs: 90_000 }
  )
}
