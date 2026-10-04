import { limbBalance, waterBalanceStatus, rangeStatus, isFullExtraction, countReadValues } from '../../lib/utils/inbodyInsights'
import { InBodyReport } from '../../types'

const seg = (kg: number | null) => ({ kg, pct: null })

describe('limbBalance', () => {
  it('flags arm/leg pairs that differ by more than 5%', () => {
    const r = limbBalance({
      right_arm: seg(3.6), left_arm: seg(3.2), trunk: seg(27), right_leg: seg(9.5), left_leg: seg(9.4),
    })
    expect(r.arms).toEqual({ diffPct: 11.8, stronger: 'right', imbalanced: true })
    expect(r.legs).toEqual({ diffPct: 1.1, stronger: 'right', imbalanced: false })
  })

  it('reports even pairs as balanced and unreadable pairs as null', () => {
    const r = limbBalance({
      right_arm: seg(3.4), left_arm: seg(3.4), trunk: seg(27), right_leg: seg(null), left_leg: seg(9.4),
    })
    expect(r.arms).toEqual({ diffPct: 0, stronger: 'even', imbalanced: false })
    expect(r.legs).toBeNull()
  })
})

describe('waterBalanceStatus', () => {
  it('uses the InBody ECW/TBW bands', () => {
    expect(waterBalanceStatus(0.355)).toBe('low')
    expect(waterBalanceStatus(0.38)).toBe('normal')
    expect(waterBalanceStatus(0.395)).toBe('slightly_high')
    expect(waterBalanceStatus(0.405)).toBe('high')
    expect(waterBalanceStatus(null)).toBeNull()
  })
})

describe('rangeStatus', () => {
  it('compares a value against its printed normal range', () => {
    const ranges = [{ metric: 'weight_kg', low: 60.6, high: 82 }]
    expect(rangeStatus(94.2, 'weight_kg', ranges)).toBe('over')
    expect(rangeStatus(70, 'weight_kg', ranges)).toBe('normal')
    expect(rangeStatus(50, 'weight_kg', ranges)).toBe('under')
    expect(rangeStatus(70, 'protein_kg', ranges)).toBeNull()
    expect(rangeStatus(null, 'weight_kg', ranges)).toBeNull()
  })
})

describe('isFullExtraction', () => {
  it('is true only for v2 reports carrying structured details', () => {
    expect(isFullExtraction({ extraction_version: 2, raw_extracted_json: { core: {} } } as unknown as InBodyReport)).toBe(true)
    expect(isFullExtraction({ extraction_version: 1, raw_extracted_json: { PBF: '32.1' } } as unknown as InBodyReport)).toBe(false)
  })
})

describe('countReadValues', () => {
  it('counts every non-null number in the details, including nested segments', () => {
    expect(countReadValues({ core: { a: 1, b: null }, seg: { right_arm: { kg: 3.2, pct: 101 } }, ranges: [{ metric: 'x', low: 1, high: null }] })).toBe(4)
  })
})
