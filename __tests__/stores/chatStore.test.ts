/// <reference types="jest" />
import { useChatStore } from '../../stores/chatStore'
import { sendAgentMessage } from '../../lib/api/agent'

jest.mock('../../lib/api/agent', () => ({
  sendAgentMessage: jest.fn(),
}))

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], conversationId: null, loading: false, error: null })
    ;(sendAgentMessage as jest.Mock).mockReset()
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
})
