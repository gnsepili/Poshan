import { planDays } from '../../lib/utils/plan'
import { MealPlanDay } from '../../types'

describe('planDays', () => {
  it('returns [] for a null plan', () => {
    expect(planDays<MealPlanDay>(null)).toEqual([])
  })
  it('returns [] when days is missing', () => {
    expect(planDays<MealPlanDay>({})).toEqual([])
  })
  it('returns [] when days is not an array', () => {
    expect(planDays<MealPlanDay>({ days: 'nope' as unknown })).toEqual([])
  })
  it('returns the days array when well-formed', () => {
    const days = [{ day: 'Mon', meals: [] }]
    expect(planDays<MealPlanDay>({ days })).toEqual(days)
  })
})
