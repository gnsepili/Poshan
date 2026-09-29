import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

interface Props { percentage: number; label: string; value: string; color: string; size?: number }

export function ProgressRing({ percentage, label, value, color, size = 80 }: Props) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const strokeDash = circ - (percentage / 100) * circ

  return (
    <View className="items-center">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={8} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={circ} strokeDashoffset={strokeDash} strokeLinecap="round"
          rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <Text className="font-bold text-gray-900 -mt-1">{value}</Text>
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
  )
}
