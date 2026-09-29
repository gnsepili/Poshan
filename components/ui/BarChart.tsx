import { View, Text } from 'react-native'
import Svg, { Rect, Line } from 'react-native-svg'
import { AdherenceBar } from '../../lib/utils/chart'

interface Props {
  data: AdherenceBar[]
  width?: number
  height?: number
}

export function BarChart({ data, width = 320, height = 160 }: Props) {
  if (data.length === 0) {
    return <Text className="text-gray-400 text-center py-6">Not enough data to chart adherence yet.</Text>
  }
  const padding = 8
  const innerH = height - padding * 2
  const barW = (width - padding * 2) / data.length

  return (
    <View>
      <Svg width={width} height={height}>
        {data.map((d, i) => {
          const capped = Math.min(150, d.pct)          // clamp so a huge overshoot doesn't overflow
          const h = (capped / 150) * innerH
          const x = padding + i * barW
          const y = padding + innerH - h
          // green = on target (90-110%), amber = under, red = over
          const color = d.pct < 90 ? '#d97706' : d.pct <= 110 ? '#16a34a' : '#dc2626'
          return <Rect key={i} x={x + 1} y={y} width={Math.max(1, barW - 2)} height={h} fill={color} rx={2} />
        })}
        <Line x1={padding} y1={padding + innerH} x2={width - padding} y2={padding + innerH} stroke="#e5e7eb" strokeWidth={1} />
      </Svg>
      <View className="flex-row justify-between px-1">
        <Text className="text-[10px] text-gray-400">{data[0].label}</Text>
        <Text className="text-[10px] text-gray-400">{data[data.length - 1].label}</Text>
      </View>
    </View>
  )
}
