import { summarizeArc, ArcRow } from '../../lib/challenge/progress'
import { arcWindow, CLASSIC_RULES, RULES } from '../../lib/challenge/rules'

// rows for one day: `doneIds` done, others not
const day = (date: string, rules: string[], doneIds: string[]): ArcRow[] =>
  rules.map((r) => ({ day: date, rule_id: r, done: doneIds.includes(r), value: null, target: null }))
const R = ['workout', 'water']

describe('summarizeArc', () => {
  const base = { startDate: '2026-10-01', endDate: '2026-12-31', strict: false, today: '2026-10-05' }

  it('counts the day number, streaks and completion', () => {
    const rows = [
      ...day('2026-10-01', R, R),
      ...day('2026-10-02', R, ['water']),
      ...day('2026-10-03', R, R),
      ...day('2026-10-04', R, R),
      ...day('2026-10-05', R, ['workout']),
    ]
    const s = summarizeArc(rows, base)
    expect(s.dayNumber).toBe(5)
    expect(s.totalDays).toBe(92)
    expect(s.currentStreak).toBe(2) // Oct 3-4; today isn't finished yet, so it doesn't break the streak
    expect(s.bestStreak).toBe(2)
    expect(s.perfectDays).toBe(3)
    expect(s.completionPct).toBe(80) // 8 of 10 rule-days
    expect(s.today).toEqual({ date: '2026-10-05', done: 1, total: 2, complete: false })
    expect(s.restartedOn).toBeNull()
  })

  it('includes today in the streak once today is complete', () => {
    const rows = [...day('2026-10-04', R, R), ...day('2026-10-05', R, R)]
    expect(summarizeArc(rows, { ...base, startDate: '2026-10-04' }).currentStreak).toBe(2)
  })

  it('strict mode restarts the arc the day after a missed day', () => {
    const rows = [
      ...day('2026-10-01', R, R),
      ...day('2026-10-02', R, ['water']),
      ...day('2026-10-03', R, R),
      ...day('2026-10-04', R, R),
      ...day('2026-10-05', R, []),
    ]
    const s = summarizeArc(rows, { ...base, strict: true })
    expect(s.restartedOn).toBe('2026-10-03')
    expect(s.dayNumber).toBe(3)
    expect(s.totalDays).toBe(90)
  })

  it('handles a fresh arc with no rows yet', () => {
    const s = summarizeArc([], { ...base, startDate: '2026-10-05' })
    expect(s.dayNumber).toBe(1)
    expect(s.currentStreak).toBe(0)
    expect(s.completionPct).toBe(0)
  })
})

describe('arc rules and window', () => {
  it('runs to Dec 31 when joined in Oct-Dec, otherwise 90 days', () => {
    expect(arcWindow(new Date(Date.UTC(2026, 9, 4)))).toEqual({ startDate: '2026-10-04', endDate: '2026-12-31', title: 'Winter Arc 2026' })
    expect(arcWindow(new Date(Date.UTC(2027, 1, 1)))).toEqual({ startDate: '2027-02-01', endDate: '2027-05-01', title: '90-day arc' })
  })

  it('has a classic preset made of known rules', () => {
    for (const id of CLASSIC_RULES) expect(RULES.find((r) => r.id === id)).toBeTruthy()
  })
})
