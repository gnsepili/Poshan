import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { sendAgentMessage } from '../lib/api/agent'
import { supabase } from '../lib/supabase'
import { ChatMessage, ChatRole } from '../types'

type ChatHistoryMessage = Omit<ChatMessage, 'user_id' | 'tool_calls' | 'context_snapshot'>

interface ChatState {
  messages: ChatHistoryMessage[]
  conversationId: string | null
  loading: boolean
  error: string | null
  sendMessage: (userId: string, content: string) => Promise<void>
  loadHistory: (userId: string) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    messages: [],
    conversationId: null,
    loading: false,
    error: null,

    sendMessage: async (userId, content) => {
      const userMsg: ChatHistoryMessage = {
        id: crypto.randomUUID(),
        conversation_id: get().conversationId ?? '',
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      }
      set((s) => {
        s.messages.push(userMsg)
        s.loading = true
        s.error = null
      })
      try {
        const { reply, conversation_id } = await sendAgentMessage(content, get().conversationId ?? undefined)
        const assistantMsg: ChatHistoryMessage = {
          id: crypto.randomUUID(),
          conversation_id,
          role: 'assistant',
          content: reply,
          created_at: new Date().toISOString(),
        }
        set((s) => {
          s.messages.push(assistantMsg)
          s.conversationId = conversation_id
          s.loading = false
        })
      } catch (e) {
        set((s) => {
          s.loading = false
          s.error = (e as Error).message
        })
      }
    },

    loadHistory: async (userId) => {
      set((s) => {
        s.loading = true
        s.error = null
      })
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      set((s) => {
        s.loading = false
        s.error = error?.message ?? null
        if (!error && data) {
          const history = data as unknown as (ChatHistoryMessage & { role: string })[]
          s.messages = history.map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role as ChatRole,
            content: m.content,
            created_at: m.created_at,
          }))
          const last = history[history.length - 1]
          if (last) s.conversationId = last.conversation_id
        }
      })
    },
  }))
)
