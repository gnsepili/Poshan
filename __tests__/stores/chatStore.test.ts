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

let mockUuidCounter = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuidCounter}` }))

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

  it('sets error and drops the optimistic user message when sending fails (the screen restores the input, so a resend never duplicates it)', async () => {
    ;(sendAgentMessage as jest.Mock).mockRejectedValue(new Error('network down'))
    await useChatStore.getState().sendMessage('Hi')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBe('network down')
  })

  it('does not rely on a global crypto object (Hermes has none)', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true })
    try {
      ;(sendAgentMessage as jest.Mock).mockResolvedValue({ reply: 'Hello!', conversation_id: 'conv-1' })
      await useChatStore.getState().sendMessage('Hi')
      const msgs = useChatStore.getState().messages
      expect(msgs).toHaveLength(2)
      expect(msgs[0].id).not.toBe(msgs[1].id)
      expect(useChatStore.getState().error).toBeNull()
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true, writable: true })
    }
  })

  it('loads the latest 50 messages of the most recent conversation, shown oldest-first', async () => {
    const { latestChain, messagesChain } = mockChatHistory(
      { data: { conversation_id: 'conv-1' } },
      {
        data: [
          { id: 'm2', conversation_id: 'conv-1', role: 'assistant', content: 'Hello!', created_at: '2026-01-01T00:00:01Z' },
          { id: 'm1', conversation_id: 'conv-1', role: 'user', content: 'Hi', created_at: '2026-01-01T00:00:00Z' },
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
    expect(messagesChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
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
