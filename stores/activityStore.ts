import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { ActivityLog, ActivityType } from '../types'

type ActivityInsert = Database['public']['Tables']['activity_logs']['Insert']

export interface NewActivity {
  user_id: string
  activity_type: ActivityType
  duration_min: number
  steps: number
  calories_burned: number
  notes: string
}

interface ActivityState {
  todayActivity: ActivityLog[]
  loading: boolean
  error: string | null
  fetchTodayActivity: (userId: string) => Promise<void>
  addActivity: (activity: NewActivity) => Promise<ActivityLog | null>
}

export const useActivityStore = create<ActivityState>()(
  immer((set) => ({
    todayActivity: [],
    loading: false,
    error: null,

    fetchTodayActivity: async (userId) => {
      // Same UTC-day boundary as mealsStore so meals and activity agree on "today".
      const today = new Date().toISOString().split('T')[0]
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .order('logged_at', { ascending: false })
      set((s) => {
        s.loading = false
        s.todayActivity = error ? [] : (data as ActivityLog[])
        s.error = error?.message ?? null
      })
    },

    addActivity: async (activity) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('activity_logs')
        .insert({ ...activity, logged_at: new Date().toISOString() } as unknown as ActivityInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) s.todayActivity.unshift(data as ActivityLog)
        s.error = error?.message ?? null
      })
      return error ? null : (data as ActivityLog)
    },
  }))
)
