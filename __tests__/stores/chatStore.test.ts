/// <reference types="jest" />
import { useChatStore } from '../../stores/chatStore'
import { sendAgentMessage } from '../../lib/api/agent'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/api/agent', () => ({
  sendAgentMessage: jest.fn(),
}))

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

// loadHistory issues two sequential queries against `chat_messages`:
//   1) find the most recent conversation_id for the user (order/limit/maybeSingle)
//   2) load that conversation's messages (eq conversation_id/order/limit)
// This helper wires up both chains in order.
const mockChatHistory = (
  latest: { data: unknown; error?: unknown },
  messages?: { data: unknown; error?: unknown }
) => {
  const latestChain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn() }
  latestChain.select.mockReturnValue(latestChain)
  latestChain.eq.mockReturnValue(latestChain)
  latestChain.order.mockReturnValue(latestChain)
  latestChain.limit.mockReturnValue(latestChain)
  latestChain.maybeSingle.mockResolvedValue({ data: latest.data, error: latest.error ?? null })

  const messagesChain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn() }
  messagesChain.select.mockReturnValue(messagesChain)
  messagesChain.eq.mockReturnValue(messagesChain)
  messagesChain.order.mockReturnValue(messagesChain)
  messagesChain.limit.mockResolvedValue({ data: messages?.data ?? null, error: messages?.error ?? null })

  ;(supabase.from as jest.Mock)
    .mockReturnValueOnce(latestChain)
    .mockReturnValueOnce(messagesChain)

  return { latestChain, messagesChain }
}

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], conversationId: null, loading: false, error: null })
    ;(sendAgentMessage as jest.Mock).mockReset()
    ;(supabase.from as jest.Mock).mockReset()
  })

  it('adds user message immediately then assistant reply', async () => {
    ;(sendAgentMessage as jest.Mock).mockResolvedValue({ reply: 'Hello!', conversation_id: 'conv-1' })
    await useChatStore.getState().sendMessage('Hi')
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].content).toBe('Hello!')
    expect(useChatStore.getState().conversationId).toBe('conv-1')
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBeNull()
  })

  it('sets error when sendAgentMessage fails, keeping the user message', async () => {
    ;(sendAgentMessage as jest.Mock).mockRejectedValue(new Error('network down'))
    await useChatStore.getState().sendMessage('Hi')
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('user')
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBe('network down')
  })

  it('loads only the most recent conversation, bounded and ordered ascending', async () => {
    const { latestChain, messagesChain } = mockChatHistory(
      { data: { conversation_id: 'conv-1' } },
      {
        data: [
          { id: 'm1', conversation_id: 'conv-1', role: 'user', content: 'Hi', created_at: '2026-01-01T00:00:00Z' },
          { id: 'm2', conversation_id: 'conv-1', role: 'assistant', content: 'Hello!', created_at: '2026-01-01T00:00:01Z' },
        ],
      }
    )
    await useChatStore.getState().loadHistory('user-1')
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect(useChatStore.getState().conversationId).toBe('conv-1')
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBeNull()
    // First query finds the latest conversation for the user, most-recent first.
    expect(latestChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(latestChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(latestChain.limit).toHaveBeenCalledWith(1)
    // Second query is scoped to that conversation, ascending, and bounded.
    expect(messagesChain.eq).toHaveBeenCalledWith('conversation_id', 'conv-1')
    expect(messagesChain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(messagesChain.limit).toHaveBeenCalledWith(50)
  })

  it('leaves messages empty and conversationId unchanged when the user has no messages yet', async () => {
    mockChatHistory({ data: null })
    await useChatStore.getState().loadHistory('user-1')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().conversationId).toBeNull()
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBeNull()
  })

  it('sets error when the conversation lookup fails', async () => {
    mockChatHistory({ data: null, error: { message: 'fetch failed' } })
    await useChatStore.getState().loadHistory('user-1')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBe('fetch failed')
  })

  it('sets error when loading the conversation messages fails', async () => {
    mockChatHistory({ data: { conversation_id: 'conv-1' } }, { data: null, error: { message: 'messages fetch failed' } })
    await useChatStore.getState().loadHistory('user-1')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBe('messages fetch failed')
  })
})
