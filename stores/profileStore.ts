import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
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
  fetchProfile: (userId: string) => Promise<void>
  fetchGoals: (userId: string) => Promise<void>
  upsertProfile: (profile: Partial<Profile> & { id: string }) => Promise<void>
  upsertGoals: (goals: Partial<Goal> & { user_id: string }) => Promise<void>
}

export const useProfileStore = create<ProfileState>()(
  immer((set) => ({
    profile: null,
    goals: null,
    loading: false,
    error: null,

    fetchProfile: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      set((s) => {
        s.loading = false
        s.profile = error ? null : (data as Profile)
        s.error = error?.message ?? null
      })
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
        s.goals = error ? null : (data as Goal | null)
        s.error = error?.message ?? null
      })
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
  }))
)
