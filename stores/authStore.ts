import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<() => void>
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    session: null,
    user: null,
    loading: false,
    error: null,

    signIn: async (email, password) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      set((s) => {
        s.loading = false
        s.session = data.session
        s.user = data.session?.user ?? null
        s.error = error?.message ?? null
      })
    },

    signUp: async (email, password) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase.auth.signUp({ email, password })
      set((s) => {
        s.loading = false
        s.session = data.session
        s.user = data.session?.user ?? null
        s.error = error?.message ?? null
      })
    },

    signOut: async () => {
      set((s) => { s.loading = true; s.error = null })
      const { error } = await supabase.auth.signOut()
      // Dynamic import: authStore must never statically import the data stores
      // (would create a module-init cycle). This wipes every per-user store so a
      // second user on the same device never sees the previous user's cached
      // data (Review Focus #5).
      const { resetAllStores } = await import('../lib/storeReset')
      resetAllStores()
      set((s) => {
        s.loading = false
        s.session = null
        s.user = null
        s.error = error?.message ?? null
      })
    },

    initialize: async () => {
      const { data, error } = await supabase.auth.getSession()
      set((s) => {
        s.session = data.session
        s.user = data.session?.user ?? null
        s.error = error?.message ?? null
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set((s) => { s.session = session; s.user = session?.user ?? null })
      })
      return () => subscription.unsubscribe()
    },
  }))
)
