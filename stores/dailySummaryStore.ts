import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { DailySummary, Goal, Meal } from '../types'
import { sumMeals } from '../lib/utils/macros'

type DailySummaryInsert = Database['public']['Tables']['daily_summaries']['Insert']

interface DailySummaryState {
  summary: DailySummary | null
  recent: DailySummary[]
  loading: boolean
  // True once fetchOrCreateToday has settled at least once (success or error) for
  // the current session. Distinguishes "today's row hasn't loaded yet" (summary is
  // still its initial null) from "loaded, and there really is no row today" — the
  // dashboard's lazy coach-note fallback must only evaluate after this is true.
  loaded: boolean
  error: string | null
  fetchOrCreateToday: (userId: string) => Promise<void>
  fetchRecent: (userId: string) => Promise<void>
}

export const useDailySummaryStore = create<DailySummaryState>()(
  immer((set) => ({
    summary: null,
    recent: [],
    loading: false,
    loaded: false,
    error: null,

    fetchOrCreateToday: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const today = new Date().toISOString().split('T')[0]

      const { data: existing, error: fetchError } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()

      if (fetchError) {
        set((s) => { s.loading = false; s.loaded = true; s.error = fetchError.message })
        return
      }

      if (existing) {
        set((s) => { s.loading = false; s.loaded = true; s.summary = existing as DailySummary })
        return
      }

      const [mealsRes, goalsRes] = await Promise.all([
        supabase
          .from('meals')
          .select('*')
          .eq('user_id', userId)
          .gte('logged_at', `${today}T00:00:00`),
        // Goals are append-only / latest-wins: always read the most recent row,
        // never assume a single goals row per user.
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (mealsRes.error || goalsRes.error) {
        set((s) => {
          s.loading = false
          s.loaded = true
          s.error = mealsRes.error?.message ?? goalsRes.error?.message ?? null
        })
        return
      }

      const totals = sumMeals((mealsRes.data ?? []) as Meal[])
      const goal = goalsRes.data as Goal | null

      const insertPayload: DailySummaryInsert = {
        user_id: userId,
        date: today,
        total_calories_consumed: totals.calories,
        total_protein_g: totals.protein,
        total_carbs_g: totals.carbs,
        total_fat_g: totals.fat,
        total_steps: 0,
        ai_daily_goals: goal
          ? {
              calories: goal.daily_calorie_target,
              protein_g: goal.daily_protein_g,
              carbs_g: goal.daily_carbs_g,
              fat_g: goal.daily_fat_g,
              steps: goal.daily_steps_target,
              workout_suggestion: '',
            }
          : null,
      }

      const { data: created, error: insertError } = await supabase
        .from('daily_summaries')
        .insert(insertPayload)
        .select()
        .single()

      set((s) => {
        s.loading = false
        s.loaded = true
        s.summary = insertError ? null : (created as DailySummary)
        s.error = insertError?.message ?? null
      })
    },

    fetchRecent: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(30)
      set((s) => {
        s.loading = false
        s.recent = error ? [] : (data as DailySummary[])
        s.error = error?.message ?? null
      })
    },
  }))
)
