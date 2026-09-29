import { View, Text } from 'react-native'
import Svg, { Polyline, Circle, Line } from 'react-native-svg'
import { scalePoints } from '../../lib/utils/chart'

interface Props {
  data: { label: string; value: number }[]
  color: string
  width?: number
  height?: number
}

export function LineChart({ data, color, width = 300, height = 140 }: Props) {
  if (data.length < 2) {
    return <Text className="text-gray-400 text-center py-6">Need at least 2 scans to chart this.</Text>
  }
  const points = scalePoints(data.map((d) => d.value), width, height)
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const min = Math.min(...data.map((d) => d.value))
  const max = Math.max(...data.map((d) => d.value))

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={8} y1={height - 8} x2={width - 8} y2={height - 8} stroke="#e5e7eb" strokeWidth={1} />
        <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
      </Svg>
      <View className="flex-row justify-between px-1">
        <Text className="text-[10px] text-gray-400">{min}</Text>
        <Text className="text-[10px] text-gray-400">{max}</Text>
      </View>
    </View>
  )
}
