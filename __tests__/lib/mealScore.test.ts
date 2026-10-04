import { mealTypeForTime, scoreTone, shareOfTarget } from '../../lib/utils/mealScore'

const at = (h: number) => new Date(2026, 9, 4, h, 30)

describe('mealTypeForTime', () => {
  it('maps the local hour to a sensible meal type', () => {
    expect(mealTypeForTime(at(7))).toBe('breakfast')
    expect(mealTypeForTime(at(13))).toBe('lunch')
    expect(mealTypeForTime(at(17))).toBe('snack')
    expect(mealTypeForTime(at(21))).toBe('dinner')
    expect(mealTypeForTime(at(2))).toBe('snack')
  })
})

describe('scoreTone', () => {
  it('bands the 1-10 meal score', () => {
    expect(scoreTone(9)).toBe('good')
    expect(scoreTone(7)).toBe('good')
    expect(scoreTone(5)).toBe('ok')
    expect(scoreTone(3)).toBe('poor')
    expect(scoreTone(null)).toBeNull()
  })
})

describe('shareOfTarget', () => {
  it('is the rounded percentage of a daily target (0 when there is no target)', () => {
    expect(shareOfTarget(650, 2100)).toBe(31)
    expect(shareOfTarget(45, 0)).toBe(0)
  })
})
