import { View } from 'react-native'
import Animated, { FadeIn as ReFadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { Check } from 'lucide-react-native'
import { Text } from '../ui'
import { useThemeColors } from '../../lib/theme'

// Full-screen "done" moment: a check that pops in with a short label.
export function SuccessBurst({ label, detail }: { label: string; detail?: string }) {
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
        style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
      >
        <Check size={48} color={colors.onPrimary} strokeWidth={3} />
      </Animated.View>
      <Animated.View entering={reduceMotion ? undefined : ReFadeIn.delay(200)} style={{ alignItems: 'center', marginTop: 20 }}>
        <Text className="font-display text-3xl text-foreground uppercase">{label}</Text>
        {detail ? (
          <Text variant="body" muted className="mt-1 text-center">
            {detail}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  )
}
