import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { supabase } from '../lib/supabase'
import { Database } from '../lib/database.types'
import { Meal } from '../types'

type MealInsert = Database['public']['Tables']['meals']['Insert']

interface MealsState {
  meals: Meal[]
  loading: boolean
  error: string | null
  fetchTodayMeals: (userId: string) => Promise<void>
  addMeal: (
    meal: Omit<Meal, 'id' | 'created_at' | 'logged_at' | 'ai_suggestions' | 'photo_url'> & {
      photo_url?: string
      ai_suggestions?: string | null
    }
  ) => Promise<Meal | null>
}

export const useMealsStore = create<MealsState>()(
  immer((set) => ({
    meals: [],
    loading: false,
    error: null,

    fetchTodayMeals: async (userId) => {
      const today = new Date().toISOString().split('T')[0]
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00`)
        .order('logged_at', { ascending: false })
      set((s) => {
        s.loading = false
        s.meals = error ? [] : (data as Meal[])
        s.error = error?.message ?? null
      })
    },

    addMeal: async (meal) => {
      set((s) => { s.loading = true; s.error = null })
      const { data, error } = await supabase
        .from('meals')
        .insert({ ...meal, logged_at: new Date().toISOString() } as unknown as MealInsert)
        .select()
        .single()
      set((s) => {
        s.loading = false
        if (!error && data) s.meals.unshift(data as Meal)
        s.error = error?.message ?? null
      })
      return error ? null : (data as Meal)
    },
  }))
)
