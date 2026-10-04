import { useEffect } from 'react'
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface Props {
  /** Ring centre (the ring is drawn inside a parent <Svg>). */
  cx: number
  cy: number
  radius: number
  thickness: number
  /** 0..1 — values above 1 are drawn as a full ring. */
  progress: number
  color: string
  trackColor: string
  delayMs?: number
}

// One progress ring that sweeps from empty to its value when it appears or changes.
export function AnimatedRing({ cx, cy, radius, thickness, progress, color, trackColor, delayMs = 0 }: Props) {
  const reduceMotion = useReducedMotion()
  const circumference = 2 * Math.PI * radius
  const target = Math.max(0, Math.min(1, progress))
  const value = useSharedValue(reduceMotion ? target : 0)

  useEffect(() => {
    value.value = reduceMotion
      ? target
      : withDelay(delayMs, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [target, reduceMotion, delayMs])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }))

  return (
    <>
      <Circle cx={cx} cy={cy} r={radius} stroke={trackColor} strokeWidth={thickness} fill="none" />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={color}
        strokeWidth={thickness}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </>
  )
}
