import { sumSteps, sumActiveCalories } from '../../lib/utils/activity'
import { ActivityLog } from '../../types'

const log = (steps: number, calories_burned: number): ActivityLog => ({
  id: 'x', user_id: 'u', logged_at: '2026-09-29T10:00:00Z', activity_type: 'walk',
  duration_min: 0, steps, calories_burned, notes: '', source: 'manual', created_at: '2026-09-29T10:00:00Z',
})

describe('activity utils', () => {
  it('sumSteps returns 0 for an empty list', () => {
    expect(sumSteps([])).toBe(0)
  })
  it('sumSteps totals steps across logs', () => {
    expect(sumSteps([log(4000, 0), log(2500, 0)])).toBe(6500)
  })
  it('sumActiveCalories totals calories across logs', () => {
    expect(sumActiveCalories([log(0, 120), log(0, 80)])).toBe(200)
  })
})
