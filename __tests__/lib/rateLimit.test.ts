import { evaluateUsage, messageForStatus, AI_LIMIT_MESSAGE } from '../../lib/utils/rateLimit'

describe('evaluateUsage', () => {
  it('allows the first call of the day (no prior count)', () => {
    expect(evaluateUsage(null, 50)).toEqual({ allowed: true, nextCount: 1 })
  })
  it('allows exactly the cap-th call', () => {
    expect(evaluateUsage(49, 50)).toEqual({ allowed: true, nextCount: 50 })
  })
  it('denies the cap+1-th call', () => {
    expect(evaluateUsage(50, 50)).toEqual({ allowed: false, nextCount: 51 })
  })
  it('stays denied beyond the cap', () => {
    expect(evaluateUsage(80, 50)).toEqual({ allowed: false, nextCount: 81 })
  })
})

describe('messageForStatus', () => {
  it('maps 429 to the friendly AI-limit message', () => {
    expect(messageForStatus(429, 'other')).toBe(AI_LIMIT_MESSAGE)
  })
  it('passes other statuses through to the fallback', () => {
    expect(messageForStatus(500, 'server exploded')).toBe('server exploded')
  })
})
