/// <reference types="jest" />
import { useProfileStore } from '../../stores/profileStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = (data: unknown, error: unknown = null) => {
  const chain = { select: jest.fn(), upsert: jest.fn(), eq: jest.fn(), single: jest.fn() }
  chain.select.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error })
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

  it('sets error when upsertGoals fails', async () => {
    mockFrom(null, { message: 'goals upsert failed' })
    await useProfileStore.getState().upsertGoals({ user_id: 'user-1', daily_calorie_target: 2000 })
    expect(useProfileStore.getState().error).toBe('goals upsert failed')
  })

  it('sets goals when upsertGoals succeeds', async () => {
    const mockGoals = { user_id: 'user-1', daily_calorie_target: 2000 }
    mockFrom(mockGoals)
    await useProfileStore.getState().upsertGoals({ user_id: 'user-1', daily_calorie_target: 2000 })
    expect(useProfileStore.getState().goals).toEqual(mockGoals)
    expect(useProfileStore.getState().error).toBeNull()
  })
})
