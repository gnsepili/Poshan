/// <reference types="jest" />
import { usePlansStore } from '../../stores/plansStore'
import { supabase } from '../../lib/supabase'
import { sendAgentMessage } from '../../lib/api/agent'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../lib/api/agent', () => ({ sendAgentMessage: jest.fn() }))
jest.mock('../../lib/api/workoutPlan', () => ({
  buildWorkoutWeek: jest.fn(),
  regenerateWorkoutDay: jest.fn(),
  swapWorkoutExercise: jest.fn(),
}))
import { buildWorkoutWeek, regenerateWorkoutDay, swapWorkoutExercise } from '../../lib/api/workoutPlan'

function makeLatestChain(resolved: { data: unknown; error: unknown }) {
  const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue(resolved)
  return chain
}

describe('plansStore', () => {
  beforeEach(() => {
    usePlansStore.setState({ mealPlan: null, workoutPlan: null, loading: false, generating: false, workoutBusy: null, error: null })
    jest.clearAllMocks()
  })

  it('fetchPlans loads the latest meal and workout plan', async () => {
    const meal = { id: 'm1', user_id: 'u1', week_start_date: '2026-09-28', plan_json: { days: [] }, created_at: 'x' }
    const workout = { id: 'w1', user_id: 'u1', week_start_date: '2026-09-28', plan_json: { days: [] }, created_at: 'x' }
    ;(supabase.from as jest.Mock).mockImplementation((table: string) =>
      table === 'meal_plans' ? makeLatestChain({ data: meal, error: null }) : makeLatestChain({ data: workout, error: null })
    )
    await usePlansStore.getState().fetchPlans('u1')
    expect(usePlansStore.getState().mealPlan?.id).toBe('m1')
    expect(usePlansStore.getState().workoutPlan?.id).toBe('w1')
    expect(usePlansStore.getState().error).toBeNull()
  })

  it('fetchPlans surfaces an error', async () => {
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: { message: 'boom' } }))
    await usePlansStore.getState().fetchPlans('u1')
    expect(usePlansStore.getState().error).toBe('boom')
  })

  it('generateMealPlan calls the agent with a directive then refetches', async () => {
    ;(sendAgentMessage as jest.Mock).mockResolvedValue({ reply: 'done', conversation_id: 'c1' })
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: null }))
    await usePlansStore.getState().generateMealPlan('u1')
    // One-off request: must not create a coach chat thread.
    expect(sendAgentMessage).toHaveBeenCalledWith(expect.stringContaining('meal plan'), undefined, { persist: false })
    expect(supabase.from).toHaveBeenCalledWith('meal_plans')
    expect(usePlansStore.getState().generating).toBe(false)
  })

  it('generateMealPlan surfaces an agent error', async () => {
    ;(sendAgentMessage as jest.Mock).mockRejectedValue(new Error('agent down'))
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: null }))
    await usePlansStore.getState().generateMealPlan('u1')
    expect(usePlansStore.getState().error).toBe('agent down')
  })

  describe('workout plan', () => {
    const row = (days: unknown[]) => ({ id: 'w2', user_id: 'u1', week_start_date: '2026-10-05', plan_json: { days }, created_at: 'x' })

    it('generateWorkoutPlan builds a week via the workout function (not the chat agent)', async () => {
      ;(buildWorkoutWeek as jest.Mock).mockResolvedValue(row([{ day: 'Monday', focus: 'Push', exercises: [] }]))
      await usePlansStore.getState().generateWorkoutPlan('u1')
      expect(buildWorkoutWeek).toHaveBeenCalled()
      expect(sendAgentMessage).not.toHaveBeenCalled()
      expect(usePlansStore.getState().workoutPlan?.id).toBe('w2')
      expect(usePlansStore.getState().workoutBusy).toBeNull()
    })

    it('regenerateWorkoutDay and swapWorkoutExercise replace the plan and track which item is busy', async () => {
      let busyDuring: string | null = null
      ;(regenerateWorkoutDay as jest.Mock).mockImplementation(async () => {
        busyDuring = usePlansStore.getState().workoutBusy
        return row([{ day: 'Monday', focus: 'Pull', exercises: [] }])
      })
      usePlansStore.setState({ workoutPlan: row([]) as never })
      await usePlansStore.getState().regenerateWorkoutDay(0)
      expect(busyDuring).toBe('day:0')
      expect(regenerateWorkoutDay).toHaveBeenCalledWith('w2', 0)

      ;(swapWorkoutExercise as jest.Mock).mockImplementation(async () => {
        busyDuring = usePlansStore.getState().workoutBusy
        return row([{ day: 'Monday', focus: 'Pull', exercises: [{ name: 'Row', sets: 3, reps: '10' }] }])
      })
      await usePlansStore.getState().swapWorkoutExercise(0, 2)
      expect(busyDuring).toBe('swap:0:2')
      expect(swapWorkoutExercise).toHaveBeenCalledWith('w2', 0, 2)
      expect(usePlansStore.getState().workoutPlan?.plan_json.days[0].focus).toBe('Pull')
      expect(usePlansStore.getState().workoutBusy).toBeNull()
    })

    it('surfaces a failure and clears the busy marker', async () => {
      ;(swapWorkoutExercise as jest.Mock).mockRejectedValue(new Error('AI busy'))
      await usePlansStore.getState().swapWorkoutExercise(1, 0)
      expect(usePlansStore.getState().error).toBe('AI busy')
      expect(usePlansStore.getState().workoutBusy).toBeNull()
    })
  })
})
