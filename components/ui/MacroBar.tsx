import { View, Text } from 'react-native'
import { calcProgress } from '../../lib/utils/macros'

interface Props {
  label: string
  consumed: number
  target: number
  unit?: string
  color?: string
}

export function MacroBar({ label, consumed, target, unit = 'g', color = '#16a34a' }: Props) {
  const percentage = calcProgress(consumed, target)

  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm text-gray-700 font-medium">{label}</Text>
        <Text className="text-xs text-gray-500">
          {Math.round(consumed)}{unit} / {Math.round(target)}{unit}
        </Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <View className="h-2 rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </View>
    </View>
  )
}
