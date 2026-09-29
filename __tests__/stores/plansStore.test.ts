/// <reference types="jest" />
import { usePlansStore } from '../../stores/plansStore'
import { supabase } from '../../lib/supabase'
import { sendAgentMessage } from '../../lib/api/agent'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../lib/api/agent', () => ({ sendAgentMessage: jest.fn() }))

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
    usePlansStore.setState({ mealPlan: null, workoutPlan: null, loading: false, generating: false, error: null })
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
    expect(sendAgentMessage).toHaveBeenCalledWith(expect.stringContaining('meal plan'))
    expect(supabase.from).toHaveBeenCalledWith('meal_plans')
    expect(usePlansStore.getState().generating).toBe(false)
  })

  it('generateMealPlan surfaces an agent error', async () => {
    ;(sendAgentMessage as jest.Mock).mockRejectedValue(new Error('agent down'))
    ;(supabase.from as jest.Mock).mockImplementation(() => makeLatestChain({ data: null, error: null }))
    await usePlansStore.getState().generateMealPlan('u1')
    expect(usePlansStore.getState().error).toBe('agent down')
  })
})
