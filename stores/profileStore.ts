import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { Profile, Goal } from '../types'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type GoalInsert = Database['public']['Tables']['goals']['Insert']

interface ProfileState {
  profile: Profile | null
  goals: Goal | null
  loading: boolean
  error: string | null
  /** Resolves false when the request failed (vs. true with a null profile for a new user). */
  fetchProfile: (userId: string) => Promise<boolean>
  fetchGoals: (userId: string) => Promise<boolean>
  upsertProfile: (profile: Partial<Profile> & { id: string }) => Promise<void>
  upsertGoals: (goals: Partial<Goal> & { user_id: string }) => Promise<void>
}

export const useProfileStore = create<ProfileState>()(
  persist(
  immer((set) => ({
    profile: null,
    goals: null,
    loading: false,
    error: null,

    fetchProfile: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      // A brand-new user has no profile row yet; that's not an error condition,
      // so use maybeSingle() and treat a null result as "no profile yet" —
      // mirrors the null-tolerant pattern used by fetchGoals.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      set((s) => {
        s.loading = false
        if (!error) s.profile = data as Profile | null
        s.error = error?.message ?? null
      })
      return !error
    },

    fetchGoals: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      // Goals are append-only / latest-wins: always read the most recent row,
      // never assume a single goals row per user_id.
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      set((s) => {
        s.loading = false
        if (!error) s.goals = data as Goal | null
        s.error = error?.message ?? null
      })
      return !error
    },

    upsertProfile: async (profile) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profile as unknown as ProfileInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error) s.profile = data as Profile
        s.error = error?.message ?? null
      })
    },

    upsertGoals: async (goals) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('goals')
        .insert(goals as unknown as GoalInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error) s.goals = data as Goal
        s.error = error?.message ?? null
      })
    },
  })),
  cacheOptions<ProfileState>('profile', ['profile', 'goals'])
  )
)
