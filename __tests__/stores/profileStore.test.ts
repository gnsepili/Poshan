/// <reference types="jest" />
import { useProfileStore } from '../../stores/profileStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = (data: unknown, error: unknown = null) => {
  const chain = {
    select: jest.fn(),
    upsert: jest.fn(),
    insert: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
  chain.maybeSingle.mockResolvedValue({ data, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('profileStore', () => {
  beforeEach(() => useProfileStore.setState({ profile: null, goals: null, loading: false, error: null }))

  it('sets error when fetch fails', async () => {
    mockFrom(null, { message: 'not found' })
    await useProfileStore.getState().fetchProfile('user-1')
    expect(useProfileStore.getState().error).toBe('not found')
  })

  it('sets profile when fetch succeeds', async () => {
    const mockProfile = { id: 'user-1', age: 30, sex: 'male' }
    mockFrom(mockProfile)
    await useProfileStore.getState().fetchProfile('user-1')
    expect(useProfileStore.getState().profile).toEqual(mockProfile)
  })

  it('leaves profile null and error null when a new user has no profile row yet (maybeSingle no-rows)', async () => {
    mockFrom(null, null)
    await useProfileStore.getState().fetchProfile('user-1')
    expect(useProfileStore.getState().profile).toBeNull()
    expect(useProfileStore.getState().error).toBeNull()
  })

  it('sets error when upsertProfile fails', async () => {
    mockFrom(null, { message: 'upsert failed' })
    await useProfileStore.getState().upsertProfile({ id: 'user-1', age: 31 })
    expect(useProfileStore.getState().error).toBe('upsert failed')
  })

  it('sets profile when upsertProfile succeeds', async () => {
    const mockProfile = { id: 'user-1', age: 31, sex: 'male' }
    mockFrom(mockProfile)
    await useProfileStore.getState().upsertProfile({ id: 'user-1', age: 31 })
    expect(useProfileStore.getState().profile).toEqual(mockProfile)
    expect(useProfileStore.getState().error).toBeNull()
  })

  it('sets error when fetchGoals fails', async () => {
    mockFrom(null, { message: 'goals fetch failed' })
    await useProfileStore.getState().fetchGoals('user-1')
    expect(useProfileStore.getState().error).toBe('goals fetch failed')
  })

  it('fetchGoals reads the most recent goals row (latest-wins, not by id)', async () => {
    const mockGoals = { user_id: 'user-1', daily_calorie_target: 2200 }
    const chain = mockFrom(mockGoals)
    await useProfileStore.getState().fetchGoals('user-1')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(1)
    expect(chain.maybeSingle).toHaveBeenCalled()
    expect(useProfileStore.getState().goals).toEqual(mockGoals)
    expect(useProfileStore.getState().error).toBeNull()
  })

  it('sets error when upsertGoals (insert) fails', async () => {
    const chain = mockFrom(null, { message: 'goals insert failed' })
    await useProfileStore.getState().upsertGoals({ user_id: 'user-1', daily_calorie_target: 2000 })
    expect(chain.insert).toHaveBeenCalled()
    expect(chain.upsert).not.toHaveBeenCalled()
    expect(useProfileStore.getState().error).toBe('goals insert failed')
  })

  it('sets goals when upsertGoals (insert) succeeds', async () => {
    const mockGoals = { user_id: 'user-1', daily_calorie_target: 2000 }
    const chain = mockFrom(mockGoals)
    await useProfileStore.getState().upsertGoals({ user_id: 'user-1', daily_calorie_target: 2000 })
    expect(chain.insert).toHaveBeenCalled()
    expect(chain.upsert).not.toHaveBeenCalled()
    expect(useProfileStore.getState().goals).toEqual(mockGoals)
    expect(useProfileStore.getState().error).toBeNull()
  })
})
