import { calcProgress, sumMeals } from '../../lib/utils/macros'
import { Meal } from '../../types'

describe('macros utils', () => {
  it('calcProgress returns 0 when target is 0', () => {
    expect(calcProgress(500, 0)).toBe(0)
  })

  it('calcProgress caps at 100', () => {
    expect(calcProgress(2500, 2000)).toBe(100)
  })

  it('calcProgress returns correct percentage', () => {
    expect(calcProgress(1000, 2000)).toBe(50)
  })

  it('sumMeals totals calories from meals array', () => {
    const meals = [{ total_calories: 400 }, { total_calories: 600 }] as Meal[]
    expect(sumMeals(meals).calories).toBe(1000)
  })
})
