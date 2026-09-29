import { useActivityStore } from '../../stores/activityStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const mockInsert = (data: unknown, error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('activityStore', () => {
  beforeEach(() => useActivityStore.setState({ todayActivity: [], loading: false, error: null }))

  it('sets error on failed insert and returns null', async () => {
    mockInsert(null, { message: 'insert failed' })
    const result = await useActivityStore.getState().addActivity({
      user_id: 'u1', activity_type: 'run', duration_min: 30, steps: 5000, calories_burned: 300, notes: '',
    })
    expect(result).toBeNull()
    expect(useActivityStore.getState().error).toBe('insert failed')
  })

  it('prepends the new log on success', async () => {
    mockInsert({ id: 'a1', user_id: 'u1', activity_type: 'run', duration_min: 30, steps: 5000, calories_burned: 300, notes: '', logged_at: '2026-09-29T10:00:00Z', created_at: '2026-09-29T10:00:00Z' })
    const result = await useActivityStore.getState().addActivity({
      user_id: 'u1', activity_type: 'run', duration_min: 30, steps: 5000, calories_burned: 300, notes: '',
    })
    expect(result?.id).toBe('a1')
    expect(useActivityStore.getState().todayActivity).toHaveLength(1)
    expect(useActivityStore.getState().error).toBeNull()
  })
})
