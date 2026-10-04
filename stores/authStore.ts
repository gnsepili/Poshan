import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Platform } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { parseAuthRedirect } from '../lib/auth/oauthRedirect'

// Web: close the OAuth popup/tab and hand the result back to the opener.
WebBrowser.maybeCompleteAuthSession()

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
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

    // Supabase Google OAuth with PKCE. Native: an in-app browser tab that returns to
    // poshanai://auth-callback with a one-time code we exchange for a session.
    // Web: a full-page redirect; the client finishes it via detectSessionInUrl.
    signInWithGoogle: async () => {
      set((s) => { s.loading = true; s.error = null })
      try {
        if (Platform.OS === 'web') {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          })
          if (error) throw error
          return // the page navigates away to Google
        }

        const redirectTo = Linking.createURL('auth-callback')
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        })
        if (error || !data?.url) throw error ?? new Error('Could not start Google sign-in.')

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type !== 'success') {
          set((s) => { s.loading = false })
          return // user closed the browser — not an error
        }
        const parsed = parseAuthRedirect(result.url)
        if (!parsed) throw new Error('Google sign-in did not complete. Please try again.')
        if ('error' in parsed) throw new Error(parsed.error)

        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code)
        if (exchangeError) throw exchangeError
        set((s) => {
          s.loading = false
          s.session = exchanged.session
          s.user = exchanged.session?.user ?? null
        })
      } catch (e) {
        set((s) => {
          s.loading = false
          s.error = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Google sign-in failed.'
        })
      }
    },

    signOut: async () => {
      set((s) => { s.loading = true; s.error = null })
      const { error } = await supabase.auth.signOut()
      // Dynamic import: authStore must never statically import the data stores
      // (would create a module-init cycle). This wipes every per-user store so a
      // second user on the same device never sees the previous user's cached
      // data (Review Focus #5).
      const { resetAllStores } = await import('../lib/storeReset')
      await resetAllStores()
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        set((s) => { s.session = session; s.user = session?.user ?? null })
        // A session can also end without signOut() (expired refresh token, revoked
        // elsewhere): wipe the previous user's cached data then too.
        if (event === 'SIGNED_OUT') {
          import('../lib/storeReset').then(({ resetAllStores }) => resetAllStores()).catch(() => {})
        }
      })
      return () => subscription.unsubscribe()
    },
  }))
)
