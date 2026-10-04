import { ReactNode } from 'react'
import { View, ViewStyle } from 'react-native'
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated'

interface Props {
  children: ReactNode
  /** Position in a list — each step delays the entrance a little (stagger). */
  index?: number
  style?: ViewStyle
  className?: string
}

// Fades and slides a block up into place when it first mounts. NativeWind classNames don't
// apply to Reanimated's Animated.View, so the classes go on an inner View.
export function FadeIn({ children, index = 0, style, className }: Props) {
  const reduceMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(380).delay(index * 70)}
      style={style}
    >
      <View className={className}>{children}</View>
    </Animated.View>
  )
}
