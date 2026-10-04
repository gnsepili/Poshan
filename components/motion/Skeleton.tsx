import { useEffect } from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

interface Props {
  className?: string
  style?: ViewStyle
}

// Pulsing placeholder block shown while content loads.
export function Skeleton({ className = '', style }: Props) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(0.5)
  useEffect(() => {
    if (!reduceMotion) opacity.value = withRepeat(withTiming(1, { duration: 750 }), -1, true)
  }, [reduceMotion])
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  // Classes on an inner View (they don't apply to Animated.View); the wrapper only fades.
  return (
    <View className={`overflow-hidden rounded-xl ${className}`} style={style}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1D' }, animatedStyle]} />
    </View>
  )
}
