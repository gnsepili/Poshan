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

const mockChatHistory = (data: unknown, error: unknown = null) => {
  const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], conversationId: null, loading: false, error: null })
    ;(sendAgentMessage as jest.Mock).mockReset()
    ;(supabase.from as jest.Mock).mockReset()
  })

  it('adds user message immediately then assistant reply', async () => {
    ;(sendAgentMessage as jest.Mock).mockResolvedValue({ reply: 'Hello!', conversation_id: 'conv-1' })
    await useChatStore.getState().sendMessage('user-1', 'Hi')
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
    await useChatStore.getState().sendMessage('user-1', 'Hi')
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('user')
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBe('network down')
  })

  it('loads chat history successfully', async () => {
    mockChatHistory([
      { id: 'm1', conversation_id: 'conv-1', role: 'user', content: 'Hi', created_at: '2026-01-01T00:00:00Z' },
      { id: 'm2', conversation_id: 'conv-1', role: 'assistant', content: 'Hello!', created_at: '2026-01-01T00:00:01Z' },
    ])
    await useChatStore.getState().loadHistory('user-1')
    const msgs = useChatStore.getState().messages
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect(useChatStore.getState().conversationId).toBe('conv-1')
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBeNull()
  })

  it('sets error when loadHistory fails', async () => {
    mockChatHistory(null, { message: 'fetch failed' })
    await useChatStore.getState().loadHistory('user-1')
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().loading).toBe(false)
    expect(useChatStore.getState().error).toBe('fetch failed')
  })
})
