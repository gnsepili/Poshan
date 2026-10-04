import { invokeEdgeFunction } from './edgeFunction'
import { WorkoutPlan } from '../../types'

// Each call returns the saved (latest) workout plan row.
const call = (body: Record<string, unknown>, timeoutMs: number) =>
  invokeEdgeFunction<WorkoutPlan>('ai-workout-plan', body, { timeoutMs })

/** Build a fresh 7-day plan from the user's preferences, goals and body composition. */
export const buildWorkoutWeek = () => call({ mode: 'week' }, 90_000)

/** Replace one day's session (same focus, different exercises) in the given plan. */
export const regenerateWorkoutDay = (planId: string, dayIndex: number) =>
  call({ mode: 'day', plan_id: planId, day_index: dayIndex }, 70_000)

/** Swap one exercise for an alternative that trains the same muscles. */
export const swapWorkoutExercise = (planId: string, dayIndex: number, exerciseIndex: number) =>
  call({ mode: 'swap', plan_id: planId, day_index: dayIndex, exercise_index: exerciseIndex }, 50_000)
