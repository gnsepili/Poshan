import { View } from 'react-native'
import Svg, { Rect, Line } from 'react-native-svg'
import { Text } from './Text'
import { useThemeColors } from '../../lib/theme'
import { AdherenceBar } from '../../lib/utils/chart'

interface Props {
  data: AdherenceBar[]
  width?: number
  height?: number
}

export function BarChart({ data, width = 320, height = 160 }: Props) {
  const colors = useThemeColors()

  if (data.length === 0) {
    return (
      <Text variant="bodySm" muted className="text-center py-6">
        Not enough data to chart adherence yet.
      </Text>
    )
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
          // on target (90-110%) = primary, under target = warning, over target = danger
          const color = d.pct < 90 ? colors.warning : d.pct <= 110 ? colors.primary : colors.danger
          return <Rect key={i} x={x + 1} y={y} width={Math.max(1, barW - 2)} height={h} fill={color} rx={2} />
        })}
        <Line x1={padding} y1={padding + innerH} x2={width - padding} y2={padding + innerH} stroke={colors.border} strokeWidth={1} />
      </Svg>
      <View className="flex-row justify-between px-1">
        <Text variant="caption" muted>{data[0].label}</Text>
        <Text variant="caption" muted>{data[data.length - 1].label}</Text>
      </View>
    </View>
  )
}
