import { mergeCached, todayKey } from '../../lib/cache'

describe('mergeCached', () => {
  const current = { meals: [] as string[], mealsDay: null as string | null, loading: false, fetchX: () => {} }

  it('restores cached data over the initial state, keeping actions and transient flags', () => {
    const merged = mergeCached({ meals: ['a'], mealsDay: '2026-10-04' }, current, { dayKey: 'mealsDay', dayScoped: ['meals'] }, '2026-10-04')
    expect(merged.meals).toEqual(['a'])
    expect(merged.loading).toBe(false)
    expect(merged.fetchX).toBe(current.fetchX)
  })

  it("drops day-scoped data cached on an earlier day (yesterday's meals are not today's)", () => {
    const merged = mergeCached({ meals: ['a'], mealsDay: '2026-10-03' }, current, { dayKey: 'mealsDay', dayScoped: ['meals'] }, '2026-10-04')
    expect(merged.meals).toEqual([])
  })

  it('tolerates an empty or corrupt cache', () => {
    expect(mergeCached(undefined, current, {}, '2026-10-04')).toEqual(current)
    expect(mergeCached('garbage', current, {}, '2026-10-04')).toEqual(current)
  })
})

describe('todayKey', () => {
  it('is the UTC calendar day the stores query by', () => {
    expect(todayKey(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-04')
  })
})
