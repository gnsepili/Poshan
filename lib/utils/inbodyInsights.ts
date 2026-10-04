import { InBodyDetails, InBodyReport, InBodySegment, InBodySegmentValue } from '../../types'

// Left/right lean-mass difference above this (relative to the pair's mean) is worth flagging.
const IMBALANCE_THRESHOLD_PCT = 5

export interface PairBalance {
  diffPct: number
  stronger: 'right' | 'left' | 'even'
  imbalanced: boolean
}

function pairBalance(right: number | null, left: number | null): PairBalance | null {
  if (right === null || left === null || right + left <= 0) return null
  const diffPct = Math.round((Math.abs(right - left) / ((right + left) / 2)) * 1000) / 10
  const stronger = right === left ? 'even' : right > left ? 'right' : 'left'
  return { diffPct, stronger, imbalanced: diffPct > IMBALANCE_THRESHOLD_PCT }
}

export function limbBalance(lean: Record<InBodySegment, InBodySegmentValue>): { arms: PairBalance | null; legs: PairBalance | null } {
  return {
    arms: pairBalance(lean.right_arm.kg, lean.left_arm.kg),
    legs: pairBalance(lean.right_leg.kg, lean.left_leg.kg),
  }
}

export type WaterBalance = 'low' | 'normal' | 'slightly_high' | 'high'

// InBody's ECW/TBW bands: 0.360–0.390 is normal; above suggests fluid retention/inflammation.
export function waterBalanceStatus(ratio: number | null): WaterBalance | null {
  if (ratio === null) return null
  if (ratio < 0.36) return 'low'
  if (ratio <= 0.39) return 'normal'
  if (ratio <= 0.4) return 'slightly_high'
  return 'high'
}

export function rangeStatus(
  value: number | null,
  metric: string,
  ranges: InBodyDetails['reference_ranges']
): 'under' | 'normal' | 'over' | null {
  if (value === null) return null
  const range = ranges.find((r) => r.metric === metric)
  if (!range) return null
  if (range.low !== null && value < range.low) return 'under'
  if (range.high !== null && value > range.high) return 'over'
  return 'normal'
}

export function isFullExtraction(report: InBodyReport): boolean {
  const raw = report.raw_extracted_json as { core?: unknown } | null
  return report.extraction_version >= 2 && !!raw && typeof raw.core === 'object'
}

// How many numeric values were read off the sheet (for "N values read" feedback).
export function countReadValues(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? 1 : 0
  if (Array.isArray(value)) return value.reduce((n: number, v) => n + countReadValues(v), 0)
  if (value && typeof value === 'object') return Object.values(value).reduce((n: number, v) => n + countReadValues(v), 0)
  return 0
}
