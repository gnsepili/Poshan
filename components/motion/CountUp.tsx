import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import { Text, AppTextProps } from '../ui/Text'

interface Props extends Omit<AppTextProps, 'children'> {
  value: number
  durationMs?: number
  format?: (n: number) => string
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString()

// A number that counts up to its value (from the previous value on updates).
export function CountUp({ value, durationMs = 700, format = defaultFormat, ...textProps }: Props) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(reduceMotion ? value : 0)
  const from = useRef(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      setShown(value)
      from.current = value
      return
    }
    const start = from.current
    const startedAt = Date.now()
    let frame = 0
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(start + (value - start) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs, reduceMotion])

  return <Text {...textProps}>{format(shown)}</Text>
}
