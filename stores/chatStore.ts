import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { randomUUID } from 'expo-crypto'
import { sendAgentMessage } from '../lib/api/agent'
import { supabase } from '../lib/supabase'
import { ChatMessage, ChatRole } from '../types'

type ChatHistoryMessage = Omit<ChatMessage, 'user_id' | 'tool_calls' | 'context_snapshot'>

export interface ConversationSummary {
  id: string
  title: string
  updated_at: string
}

const MESSAGE_LIMIT = 50

// Latest messages of a thread (newest-first from the DB), shown oldest-first.
async function loadThreadMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_LIMIT)
  const messages: ChatHistoryMessage[] = (data ?? [])
    .slice()
    .reverse()
    .map((m) => ({ id: m.id, conversation_id: m.conversation_id, role: m.role as ChatRole, content: m.content, created_at: m.created_at }))
  return { messages, error }
}

interface ChatState {
  messages: ChatHistoryMessage[]
  conversationId: string | null
  conversations: ConversationSummary[]
  loading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  loadHistory: (userId: string) => Promise<void>
  fetchConversations: (userId: string) => Promise<void>
  openConversation: (id: string) => Promise<void>
  startNewConversation: () => void
  /** Resolves false (and sets `error`) if the delete failed. */
  deleteConversation: (id: string) => Promise<boolean>
}

export const useChatStore = create<ChatState>()(
  persist(
  immer((set, get) => ({
    messages: [],
    conversationId: null,
    conversations: [],
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
        const sentFrom = get().conversationId
        const { reply, conversation_id, title } = await sendAgentMessage(content, sentFrom ?? undefined)
        const threadId = conversation_id ?? sentFrom ?? ''
        const now = new Date().toISOString()
        const assistantMsg: ChatHistoryMessage = {
          id: randomUUID(),
          conversation_id: threadId,
          role: 'assistant',
          content: reply,
          created_at: now,
        }
        set((s) => {
          s.loading = false
          // Only touch the visible chat if the user is still on the thread this was sent from
          // (they may have opened another thread or started a new one meanwhile).
          if (s.conversationId === sentFrom) {
            s.messages.push(assistantMsg)
            s.conversationId = threadId || null
          }
          // Either way keep the thread list fresh: move this thread to the top (adding it if new).
          if (threadId) {
            const existing = s.conversations.find((c) => c.id === threadId)
            s.conversations = [
              { id: threadId, title: existing?.title ?? title ?? content.slice(0, 50), updated_at: now },
              ...s.conversations.filter((c) => c.id !== threadId),
            ]
          }
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

    fetchConversations: async (userId) => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100)
      set((s) => {
        if (!error && data) s.conversations = data as ConversationSummary[]
        else if (error) s.error = error.message
      })
    },

    openConversation: async (id) => {
      set((s) => {
        s.loading = true
        s.error = null
        s.conversationId = id
        s.messages = []
      })
      const { messages, error } = await loadThreadMessages(id)
      set((s) => {
        s.loading = false
        s.error = error?.message ?? null
        if (!error) s.messages = messages
      })
    },

    startNewConversation: () => {
      set((s) => {
        s.messages = []
        s.conversationId = null
        s.error = null
      })
    },

    deleteConversation: async (id) => {
      // Messages are removed with the thread (FK on delete cascade).
      const { error } = await supabase.from('conversations').delete().eq('id', id)
      if (error) {
        set((s) => {
          s.error = error.message
        })
        return false
      }
      set((s) => {
        s.conversations = s.conversations.filter((c) => c.id !== id)
        if (s.conversationId === id) {
          s.conversationId = null
          s.messages = []
        }
      })
      return true
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
  cacheOptions<ChatState>('chat', ['messages', 'conversationId', 'conversations'])
  )
)
