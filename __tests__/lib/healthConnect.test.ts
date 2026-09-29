import {
  hcExerciseToActivityType,
  hcDedupKey,
  sessionsToActivityRows,
  sumStepsRecords,
  sumActiveCaloriesRecords,
  averageHeartRate,
  HcExerciseSession,
  HcHeartRateRecord,
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

describe('averageHeartRate', () => {
  it('returns null when there are no records', () => {
    expect(averageHeartRate([])).toBeNull()
  })
  it('returns null when records have no samples', () => {
    const records: HcHeartRateRecord[] = [{ samples: [] }, { samples: [] }]
    expect(averageHeartRate(records)).toBeNull()
  })
  it('averages samples across multiple records, rounded', () => {
    const records: HcHeartRateRecord[] = [
      { samples: [{ beatsPerMinute: 60 }, { beatsPerMinute: 70 }] },
      { samples: [{ beatsPerMinute: 81 }] },
    ]
    // (60 + 70 + 81) / 3 = 70.33... -> 70
    expect(averageHeartRate(records)).toBe(70)
  })
  it('returns the value for a single sample', () => {
    const records: HcHeartRateRecord[] = [{ samples: [{ beatsPerMinute: 65 }] }]
    expect(averageHeartRate(records)).toBe(65)
  })
  it('never returns NaN/Infinity for malformed samples', () => {
    const records = [{ samples: [{ beatsPerMinute: undefined as unknown as number }] }] as HcHeartRateRecord[]
    const result = averageHeartRate(records)
    expect(result === null || Number.isFinite(result)).toBe(true)
  })
})
