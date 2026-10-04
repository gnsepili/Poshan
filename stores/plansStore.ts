import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { cacheOptions } from '../lib/cache'
import { supabase } from '../lib/supabase'
import { logEvent } from '../lib/telemetry'
import { sendAgentMessage } from '../lib/api/agent'
import { MealPlan, MealPlanJson, WorkoutPlan, WorkoutPlanJson } from '../types'

interface PlansState {
  mealPlan: MealPlan | null
  workoutPlan: WorkoutPlan | null
  loading: boolean
  generating: boolean
  error: string | null
  fetchPlans: (userId: string) => Promise<void>
  generateMealPlan: (userId: string) => Promise<void>
  generateWorkoutPlan: (userId: string) => Promise<void>
}

export const usePlansStore = create<PlansState>()(
  persist(
  immer((set, get) => ({
    mealPlan: null,
    workoutPlan: null,
    loading: false,
    generating: false,
    error: null,

    fetchPlans: async (userId) => {
      set((s) => { s.loading = true; s.error = null })
      // Plans are append-only / latest-wins: take the most recent row per type.
      const [mealRes, workoutRes] = await Promise.all([
        supabase.from('meal_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_plans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      const mealRow = mealRes.data
      const workoutRow = workoutRes.data
      set((s) => {
        s.loading = false
        // plan_json comes back typed as the generic DB `Json`; narrow it to the
        // concrete plan shape via `object` (never `unknown`) since Json's
        // self-referential union defeats a direct structural `as` check.
        s.mealPlan = mealRes.error || !mealRow ? null : { ...mealRow, plan_json: mealRow.plan_json as object as MealPlanJson }
        s.workoutPlan = workoutRes.error || !workoutRow ? null : { ...workoutRow, plan_json: workoutRow.plan_json as object as WorkoutPlanJson }
        s.error = mealRes.error?.message ?? workoutRes.error?.message ?? null
      })
    },

    generateMealPlan: async (userId) => {
      set((s) => { s.generating = true; s.error = null })
      try {
        // Reuse ai-agent; its generate_meal_plan tool persists the row (no new edge fn).
        await sendAgentMessage('Generate a new 7-day meal plan aligned to my current calorie and macro goals, and save it with the generate_meal_plan tool.')
      } catch (e) {
        set((s) => { s.generating = false; s.error = e instanceof Error ? e.message : String(e) })
        return
      }
      set((s) => { s.generating = false })
      await get().fetchPlans(userId)
      logEvent('plan_generated', { kind: 'meal' }, userId)
      // If the agent succeeded but no row was persisted, surface a sensible message.
      if (!get().mealPlan) {
        set((s) => { s.error = s.error ?? 'The coach could not generate a meal plan right now. Please try again.' })
      }
    },

    generateWorkoutPlan: async (userId) => {
      set((s) => { s.generating = true; s.error = null })
      try {
        await sendAgentMessage('Generate a new weekly workout plan based on my goals, activity level, and latest InBody data, and save it with the generate_workout_plan tool.')
      } catch (e) {
        set((s) => { s.generating = false; s.error = e instanceof Error ? e.message : String(e) })
        return
      }
      set((s) => { s.generating = false })
      await get().fetchPlans(userId)
      logEvent('plan_generated', { kind: 'workout' }, userId)
      if (!get().workoutPlan) {
        set((s) => { s.error = s.error ?? 'The coach could not generate a workout plan right now. Please try again.' })
      }
    },
  })),
  cacheOptions<PlansState>('plans', ['mealPlan', 'workoutPlan'])
  )
)
