import { Platform, Pressable, PressableProps } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'

interface Props extends PressableProps {
  className?: string
  /** Light haptic tap on press (native only). */
  haptic?: boolean
}

export function tapHaptic(): void {
  if (Platform.OS === 'web') return
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

// Pressable that springs down slightly while pressed, with an optional haptic tap.
export function PressableScale({ children, className, style, haptic = true, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...rest}
        className={className}
        style={style}
        onPressIn={(e) => {
          if (!reduceMotion) scale.value = withSpring(0.96, { damping: 18, stiffness: 300 })
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 })
          onPressOut?.(e)
        }}
        onPress={(e) => {
          if (haptic) tapHaptic()
          onPress?.(e)
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}
