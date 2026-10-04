import { useChallengeStore } from '../../stores/challengeStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))

const chain = (result: unknown) => {
  const c: Record<string, jest.Mock> = {}
  for (const k of ['select', 'eq', 'insert', 'update', 'upsert', 'order', 'limit']) c[k] = jest.fn(() => c)
  c.maybeSingle = jest.fn().mockResolvedValue(result)
  c.single = jest.fn().mockResolvedValue(result)
  ;(c as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return c
}

const arc = { id: 'a1', user_id: 'u1', title: 'Winter Arc 2026', start_date: '2026-10-04', end_date: '2026-12-31', rules: ['protein', 'water'], strict: false, status: 'active' }

describe('challengeStore', () => {
  beforeEach(() => {
    useChallengeStore.setState({ challenge: null, rows: [], loading: false, error: null })
    jest.clearAllMocks()
  })

  it('fetchActive loads the active arc and its per-day progress (numbers parsed)', async () => {
    ;(supabase.from as jest.Mock).mockReturnValue(chain({ data: arc, error: null }))
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ day: '2026-10-04', rule_id: 'protein', done: false, value: '45', target: '150' }], error: null })
    await useChallengeStore.getState().fetchActive('u1')
    expect(supabase.rpc).toHaveBeenCalledWith('challenge_progress', { p_challenge_id: 'a1' })
    expect(useChallengeStore.getState().challenge?.id).toBe('a1')
    expect(useChallengeStore.getState().rows[0]).toMatchObject({ value: 45, target: 150 })
  })

  it('join creates the arc with the chosen rules and mode', async () => {
    const c = chain({ data: arc, error: null })
    ;(supabase.from as jest.Mock).mockReturnValue(c)
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null })
    const ok = await useChallengeStore.getState().join({ userId: 'u1', title: 'Winter Arc 2026', startDate: '2026-10-04', endDate: '2026-12-31', rules: ['protein', 'water'], strict: true, startWeightKg: 94.2, startBodyFatPct: 32.1 })
    expect(ok).toBe(true)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', rules: ['protein', 'water'], strict: true, start_weight_kg: 94.2, start_body_fat_pct: 32.1 }))
    expect(useChallengeStore.getState().challenge?.id).toBe('a1')
  })

  it("toggleRule ticks today's manual rule immediately and saves it", async () => {
    useChallengeStore.setState({ challenge: arc as never, rows: [{ day: '2026-10-04', rule_id: 'water', done: false, value: null, target: null }] })
    const c = chain({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue(c)
    await useChallengeStore.getState().toggleRule('water', '2026-10-04', true)
    expect(c.upsert).toHaveBeenCalledWith({ challenge_id: 'a1', user_id: 'u1', date: '2026-10-04', rule_id: 'water', done: true })
    expect(useChallengeStore.getState().rows[0].done).toBe(true)
  })

  it('toggleRule rolls back if saving fails', async () => {
    useChallengeStore.setState({ challenge: arc as never, rows: [{ day: '2026-10-04', rule_id: 'water', done: false, value: null, target: null }] })
    ;(supabase.from as jest.Mock).mockReturnValue(chain({ error: { message: 'offline' } }))
    await useChallengeStore.getState().toggleRule('water', '2026-10-04', true)
    expect(useChallengeStore.getState().rows[0].done).toBe(false)
    expect(useChallengeStore.getState().error).toBe('offline')
  })

  it('leave marks the arc abandoned and clears it', async () => {
    useChallengeStore.setState({ challenge: arc as never })
    const c = chain({ error: null })
    ;(supabase.from as jest.Mock).mockReturnValue(c)
    await useChallengeStore.getState().leave()
    expect(c.update).toHaveBeenCalledWith({ status: 'abandoned' })
    expect(useChallengeStore.getState().challenge).toBeNull()
  })
})
