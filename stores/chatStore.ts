import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { randomUUID } from 'expo-crypto'
import { sendAgentMessage } from '../lib/api/agent'
import { supabase } from '../lib/supabase'
import { ChatMessage, ChatRole } from '../types'

type ChatHistoryMessage = Omit<ChatMessage, 'user_id' | 'tool_calls' | 'context_snapshot'>

interface ChatState {
  messages: ChatHistoryMessage[]
  conversationId: string | null
  loading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  loadHistory: (userId: string) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  persist(
  immer((set, get) => ({
    messages: [],
    conversationId: null,
    loading: false,
    error: null,

    sendMessage: async (content) => {
      const userMsg: ChatHistoryMessage = {
        id: randomUUID(),
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
          id: randomUUID(),
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
        // Drop the optimistic message: the screen puts the text back in the input,
        // so a resend never shows the same message twice.
        set((s) => {
          s.messages = s.messages.filter((m) => m.id !== userMsg.id)
          s.loading = false
          s.error = e instanceof Error ? e.message : String(e)
        })
      }
    },

    loadHistory: async (userId) => {
      set((s) => {
        s.loading = true
        s.error = null
      })
      // Scope history to a single conversation: find the user's most recent
      // conversation, then load only that conversation's messages (bounded).
      // Loading every past conversation merged into one thread would grow
      // unbounded and mix unrelated conversations together.
      const { data: latest, error: latestError } = await supabase
        .from('chat_messages')
        .select('conversation_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestError) {
        set((s) => {
          s.loading = false
          s.error = latestError.message
        })
        return
      }

      if (!latest) {
        set((s) => {
          s.loading = false
          s.error = null
        })
        return
      }

      // Latest 50 (newest-first from the DB), shown oldest-first.
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', latest.conversation_id)
        .order('created_at', { ascending: false })
        .limit(50)

      set((s) => {
        s.loading = false
        s.error = error?.message ?? null
        if (!error && data) {
          s.messages = [...data].reverse().map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role as ChatRole,
            content: m.content,
            created_at: m.created_at,
          }))
          s.conversationId = latest.conversation_id
        }
      })
    },
  })),
  cacheOptions<ChatState>('chat', ['messages', 'conversationId'])
  )
)
