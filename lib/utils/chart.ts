export interface ChartPoint {
  x: number
  y: number
}

// Map a series of values to SVG coordinates. Y is inverted (max at top).
// Guards the degenerate cases so a 0- or 1-point series never divides by zero.
export function scalePoints(values: number[], width: number, height: number, padding = 8): ChartPoint[] {
  const n = values.length
  if (n === 0) return []
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return values.map((v, i) => {
    const x = n === 1 ? padding + innerW / 2 : padding + (i / (n - 1)) * innerW
    const y = range === 0 ? padding + innerH / 2 : padding + innerH - ((v - min) / range) * innerH
    return { x, y }
  })
}

export interface AdherenceBar {
  label: string
  consumed: number
  target: number
  pct: number
}

// Calorie adherence per day. A day with no target (missing/null ai_daily_goals or
// target 0) yields pct 0 rather than NaN/Infinity, so the bar chart never breaks.
export function adherenceSeries(
  rows: { date: string; total_calories_consumed: number; ai_daily_goals: { calories?: number } | null }[]
): AdherenceBar[] {
  return rows.map((r) => {
    const target = r.ai_daily_goals?.calories ?? 0
    const consumed = r.total_calories_consumed ?? 0
    const pct = target > 0 ? Math.round((consumed / target) * 100) : 0
    return { label: r.date.slice(5), consumed, target, pct }
  })
}
