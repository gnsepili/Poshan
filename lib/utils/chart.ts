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
