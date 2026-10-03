import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Text } from './Text'
import { useThemeColors } from '../../lib/theme'

interface Props {
  percentage: number
  label: string
  value: string
  /** Ring color — pass a macro/semantic token value. Defaults to brand primary. */
  color?: string
  size?: number
  thickness?: number
}

export function ProgressRing({
  percentage,
  label,
  value,
  color,
  size = 96,
  thickness = 9,
}: Props) {
  const colors = useThemeColors()
  const ringColor = color ?? colors.primary
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, percentage))
  const strokeDash = circ - (clamped / 100) * circ

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.surfaceMuted}
            strokeWidth={thickness}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={strokeDash}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text className="font-display text-2xl text-foreground">{value}</Text>
      </View>
      <Text variant="caption" muted className="uppercase tracking-wide mt-1.5">
        {label}
      </Text>
    </View>
  )
}
