/// <reference types="jest" />
import { useDailySummaryStore } from '../../stores/dailySummaryStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

type Resolved = { data: unknown; error: unknown }

function makeSummaryLookupChain(resolved: Resolved) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue(resolved)
  return chain
}

describe('dailySummaryStore', () => {
  beforeEach(() => {
    useDailySummaryStore.setState({ summary: null, recent: [], loading: false, loaded: false, error: null })
    jest.clearAllMocks()
  })

  it('sets error when the existing-summary lookup fails', async () => {
    const summaryChain = makeSummaryLookupChain({ data: null, error: { message: 'lookup failed' } })
    ;(supabase.from as jest.Mock).mockImplementation(() => summaryChain)

    await useDailySummaryStore.getState().fetchOrCreateToday('user-1')

    expect(useDailySummaryStore.getState().error).toBe('lookup failed')
    expect(useDailySummaryStore.getState().summary).toBeNull()
    expect(useDailySummaryStore.getState().loaded).toBe(true)
  })

  it('uses the existing row for today without creating a new one', async () => {
    const existing = { id: 'sum-1', user_id: 'user-1', date: '2026-09-29', total_calories_consumed: 800 }
    const summaryChain = makeSummaryLookupChain({ data: existing, error: null })
    const insertSpy = jest.fn()
    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'daily_summaries') return summaryChain
      insertSpy()
      throw new Error(`unexpected table: ${table}`)
    })

    await useDailySummaryStore.getState().fetchOrCreateToday('user-1')

    expect(useDailySummaryStore.getState().summary).toEqual(existing)
    expect(insertSpy).not.toHaveBeenCalled()
    expect(useDailySummaryStore.getState().error).toBeNull()
    expect(useDailySummaryStore.getState().loaded).toBe(true)
  })

  it('creates a new summary from today’s meals and the latest goals row when none exists', async () => {
    const meals = [
      { total_calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 },
      { total_calories: 300, protein_g: 15, carbs_g: 30, fat_g: 8 },
    ]
    const latestGoal = {
      id: 'goal-2',
      user_id: 'user-1',
      daily_calorie_target: 2200,
      daily_protein_g: 160,
      daily_carbs_g: 250,
      daily_fat_g: 70,
      daily_steps_target: 8000,
    }
    const created = { id: 'sum-new', user_id: 'user-1', date: '2026-09-29', total_calories_consumed: 700 }

    const summaryLookupChain = makeSummaryLookupChain({ data: null, error: null })

    const mealsChain = { select: jest.fn(), eq: jest.fn(), gte: jest.fn() }
    mealsChain.select.mockReturnValue(mealsChain)
    mealsChain.eq.mockReturnValue(mealsChain)
    mealsChain.gte.mockResolvedValue({ data: meals, error: null })

    const goalsChain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn() }
    goalsChain.select.mockReturnValue(goalsChain)
    goalsChain.eq.mockReturnValue(goalsChain)
    goalsChain.order.mockReturnValue(goalsChain)
    goalsChain.limit.mockReturnValue(goalsChain)
    goalsChain.maybeSingle.mockResolvedValue({ data: latestGoal, error: null })

    const insertChain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
    insertChain.insert.mockReturnValue(insertChain)
    insertChain.select.mockReturnValue(insertChain)
    insertChain.single.mockResolvedValue({ data: created, error: null })

    let summaryCallCount = 0
    ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'meals') return mealsChain
      if (table === 'goals') return goalsChain
      if (table === 'daily_summaries') {
        summaryCallCount += 1
        return summaryCallCount === 1 ? summaryLookupChain : insertChain
      }
      throw new Error(`unexpected table: ${table}`)
    })

    await useDailySummaryStore.getState().fetchOrCreateToday('user-1')

    expect(goalsChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(goalsChain.limit).toHaveBeenCalledWith(1)
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        total_calories_consumed: 700,
        total_protein_g: 35,
        total_carbs_g: 70,
        total_fat_g: 18,
        ai_daily_goals: expect.objectContaining({ calories: 2200, protein_g: 160 }),
      })
    )
    expect(useDailySummaryStore.getState().summary).toEqual(created)
    expect(useDailySummaryStore.getState().error).toBeNull()
    expect(useDailySummaryStore.getState().loaded).toBe(true)
  })

  it('fetchRecent loads the recent summaries ascending', async () => {
    const rows = [{ id: 's1', date: '2026-09-01' }, { id: 's2', date: '2026-09-02' }]
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn() }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    chain.limit.mockResolvedValue({ data: rows, error: null })
    ;(supabase.from as jest.Mock).mockImplementation(() => chain)

    await useDailySummaryStore.getState().fetchRecent('user-1')
    expect(useDailySummaryStore.getState().recent).toHaveLength(2)
    expect(useDailySummaryStore.getState().error).toBeNull()
  })

  it('fetchRecent surfaces an error and leaves recent empty', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn() }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    chain.limit.mockResolvedValue({ data: null, error: { message: 'recent failed' } })
    ;(supabase.from as jest.Mock).mockImplementation(() => chain)

    await useDailySummaryStore.getState().fetchRecent('user-1')
    expect(useDailySummaryStore.getState().recent).toEqual([])
    expect(useDailySummaryStore.getState().error).toBe('recent failed')
  })
})
