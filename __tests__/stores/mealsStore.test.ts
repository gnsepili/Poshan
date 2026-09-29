import { useMealsStore } from '../../stores/mealsStore'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockInsert = (error: unknown = null) => {
  const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() }
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: { id: 'meal-1' }, error })
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

describe('mealsStore', () => {
  beforeEach(() => useMealsStore.setState({ meals: [], loading: false, error: null }))

  it('sets error on failed insert', async () => {
    mockInsert({ message: 'insert failed' })
    await useMealsStore.getState().addMeal({ user_id: 'u1', meal_type: 'lunch', description: 'rice', total_calories: 400, protein_g: 10, carbs_g: 70, fat_g: 5, fiber_g: 2 })
    expect(useMealsStore.getState().error).toBe('insert failed')
  })
})
