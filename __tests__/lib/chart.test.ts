import { scalePoints } from '../../lib/utils/chart'

describe('scalePoints', () => {
  it('returns [] for no values', () => {
    expect(scalePoints([], 100, 100)).toEqual([])
  })

  it('centers a single value', () => {
    const pts = scalePoints([5], 100, 100, 8)
    expect(pts).toHaveLength(1)
    expect(pts[0].x).toBe(50) // 8 + (100-16)/2
    expect(pts[0].y).toBe(50) // all-equal -> vertical mid
  })

  it('places min at the bottom and max at the top', () => {
    const pts = scalePoints([0, 10], 100, 100, 8)
    expect(pts[0]).toEqual({ x: 8, y: 92 })  // min -> bottom
    expect(pts[1]).toEqual({ x: 92, y: 8 })  // max -> top
  })

  it('draws a flat mid-line when all values are equal', () => {
    const pts = scalePoints([5, 5, 5], 100, 100, 8)
    expect(pts.every((p) => p.y === 50)).toBe(true)
  })

  it('never produces NaN/Infinity once null-containing series are pre-filtered', () => {
    const raw: (number | null)[] = [5, null, 7, null, 9]
    const values = raw.filter((v): v is number => v !== null)
    const pts = scalePoints(values, 100, 100, 8)
    expect(pts).toHaveLength(3)
    expect(pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})
