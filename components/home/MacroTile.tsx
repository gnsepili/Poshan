import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { CountUp } from '../motion'
import { Text } from '../ui'

interface Props {
  label: string
  value: number
  target: number
  color: string
  trackColor: string
}

// Small macro stat with a bar that fills to its share of the daily target.
export function MacroTile({ label, value, target, color, trackColor }: Props) {
  const reduceMotion = useReducedMotion()
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const width = useSharedValue(reduceMotion ? pct : 0)
  useEffect(() => {
    width.value = reduceMotion ? pct : withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) })
  }, [pct, reduceMotion])
  const trackWidth = useSharedValue(0)
  const barStyle = useAnimatedStyle(() => ({ width: trackWidth.value * width.value }))

  return (
    <View className="flex-1 bg-surface rounded-2xl p-3">
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <CountUp value={value} className="font-display text-2xl text-foreground" />
        <Text className="font-display text-base text-foreground">g</Text>
      </View>
      <Text variant="caption" muted>
        of {Math.round(target)}g
      </Text>
      <View
        className="h-1.5 rounded-full mt-2 overflow-hidden"
        style={{ backgroundColor: trackColor }}
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width
        }}
      >
        <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, barStyle]} />
      </View>
    </View>
  )
}
