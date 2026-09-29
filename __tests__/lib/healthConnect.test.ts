import {
  hcExerciseToActivityType,
  hcDedupKey,
  sessionsToActivityRows,
  sumStepsRecords,
  sumActiveCaloriesRecords,
  HcExerciseSession,
} from '../../lib/utils/healthConnect'

describe('hcExerciseToActivityType', () => {
  it('maps known Health Connect exercise types', () => {
    expect(hcExerciseToActivityType(79)).toBe('walk')
    expect(hcExerciseToActivityType(56)).toBe('run')
    expect(hcExerciseToActivityType(8)).toBe('cycle')
    expect(hcExerciseToActivityType(73)).toBe('swim')
    expect(hcExerciseToActivityType(74)).toBe('swim')
    expect(hcExerciseToActivityType(70)).toBe('gym')
    expect(hcExerciseToActivityType(83)).toBe('yoga')
  })
  it('falls back to "other" for an unknown type', () => {
    expect(hcExerciseToActivityType(9999)).toBe('other')
  })
})

describe('hcDedupKey', () => {
  it('is stable for the same user + start time + activity type', () => {
    const a = hcDedupKey('u1', '2026-09-29T06:00:00.000Z', 'run')
    const b = hcDedupKey('u1', '2026-09-29T06:00:00.000Z', 'run')
    expect(a).toBe(b)
    expect(a).toBe('u1|health_connect|2026-09-29T06:00:00.000Z|run')
  })
})

describe('sessionsToActivityRows', () => {
  const sessions: HcExerciseSession[] = [
    { startTime: '2026-09-29T06:00:00.000Z', endTime: '2026-09-29T06:30:00.000Z', exerciseType: 56, title: 'Morning run' },
    { startTime: '2026-09-29T18:00:00.000Z', endTime: '2026-09-29T18:45:00.000Z', exerciseType: 70 },
  ]
  it('maps each session, using startTime as the stable logged_at', () => {
    const rows = sessionsToActivityRows('u1', sessions)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      user_id: 'u1', source: 'health_connect', activity_type: 'run',
      duration_min: 30, steps: 0, calories_burned: 0, notes: 'Morning run',
      logged_at: '2026-09-29T06:00:00.000Z',
    })
    expect(rows[1].activity_type).toBe('gym')
    expect(rows[1].duration_min).toBe(45)
    expect(rows[1].notes).toBe('')
  })
  it('collapses duplicate sessions within a single pull (no double row for one session)', () => {
    const dup = [sessions[0], { ...sessions[0] }]
    expect(sessionsToActivityRows('u1', dup)).toHaveLength(1)
  })
})

describe('aggregation helpers', () => {
  it('sums step counts', () => {
    expect(sumStepsRecords([{ count: 1200 }, { count: 800 }])).toBe(2000)
  })
  it('sums active kilocalories, rounded', () => {
    expect(sumActiveCaloriesRecords([{ energy: { inKilocalories: 120.4 } }, { energy: { inKilocalories: 79.9 } }])).toBe(200)
  })
})
