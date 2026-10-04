import { View } from 'react-native'
import { ActivityRings, CountUp } from '../motion'
import { Text } from '../ui'
import { useThemeColors } from '../../lib/theme'

interface Metric {
  label: string
  value: number
  target: number
  unit?: string
}

interface Props {
  calories: Metric
  protein: Metric
  steps: Metric
}

function Legend({ metric, color }: { metric: Metric; color: string }) {
  return (
    <View>
      <Text variant="caption" style={{ color }}>
        {metric.label}
      </Text>
      <View className="flex-row items-baseline gap-1">
        <CountUp value={metric.value} className="font-display text-2xl text-foreground" />
        {metric.unit ? <Text className="font-display text-lg text-foreground">{metric.unit}</Text> : null}
        <Text variant="bodySm" muted>
          / {metric.target.toLocaleString()}
        </Text>
      </View>
    </View>
  )
}

// Home hero: calories (outer), protein (middle) and steps (inner) as concentric rings.
export function TodayRings({ calories, protein, steps }: Props) {
  const colors = useThemeColors()
  const ratio = (m: Metric) => (m.target > 0 ? m.value / m.target : 0)
  return (
    <View className="bg-surface rounded-3xl p-4 flex-row items-center gap-5">
      <ActivityRings
        size={140}
        thickness={13}
        rings={[
          { progress: ratio(calories), color: colors.macroCalories, trackColor: colors.macroCaloriesSoft },
          { progress: ratio(protein), color: colors.macroProtein, trackColor: colors.macroProteinSoft },
          { progress: ratio(steps), color: colors.macroSteps, trackColor: colors.macroStepsSoft },
        ]}
      />
      <View className="flex-1 gap-2.5">
        <Legend metric={calories} color={colors.macroCalories} />
        <Legend metric={protein} color={colors.macroProtein} />
        <Legend metric={steps} color={colors.macroSteps} />
      </View>
    </View>
  )
}
