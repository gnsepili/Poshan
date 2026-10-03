import { View } from 'react-native'
import { Text } from './Text'
import { calcProgress } from '../../lib/utils/macros'
import { useThemeColors } from '../../lib/theme'

interface Props {
  label: string
  consumed: number
  target: number
  unit?: string
  /** Fill color — pass a macro token value. Defaults to carbs amber. */
  color?: string
}

export function MacroBar({ label, consumed, target, unit = 'g', color }: Props) {
  const colors = useThemeColors()
  const fill = color ?? colors.macroCarbs
  const percentage = calcProgress(consumed, target)

  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-baseline mb-1.5">
        <Text variant="label">{label}</Text>
        <Text variant="caption" muted>
          {Math.round(consumed)}
          {unit} / {Math.round(target)}
          {unit}
        </Text>
      </View>
      <View className="h-2.5 bg-surface-muted rounded-full overflow-hidden">
        <View
          className="h-2.5 rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: fill }}
        />
      </View>
    </View>
  )
}
