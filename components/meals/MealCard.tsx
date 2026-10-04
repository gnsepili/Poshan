import { Image, View } from 'react-native'
import { UtensilsCrossed } from 'lucide-react-native'
import { Meal } from '../../types'
import { PressableScale } from '../motion'
import { Text } from '../ui'
import { useThemeColors } from '../../lib/theme'
import { useSignedPhoto } from '../../lib/hooks/useSignedPhoto'
import { scoreTone } from '../../lib/utils/mealScore'

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' } as const

function MacroDot({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text variant="caption" muted>
        {label} {Math.round(value)}g
      </Text>
    </View>
  )
}

// Compact row for a logged meal; tap opens the full meal view.
export function MealCard({ meal, onPress }: { meal: Meal; onPress?: () => void }) {
  const colors = useThemeColors()
  const photo = useSignedPhoto('meal-photos', meal.photo_url)
  const tone = scoreTone(meal.score)
  const toneColor = tone === 'good' ? colors.success : tone === 'ok' ? colors.warning : colors.danger
  const time = new Date(meal.logged_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <PressableScale
      className="bg-surface rounded-2xl p-3 flex-row items-center gap-3"
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meal.description || 'Meal'}, ${meal.total_calories} calories`}
    >
      {photo ? (
        <Image source={{ uri: photo }} className="h-16 w-16 rounded-xl bg-surface-muted" resizeMode="cover" />
      ) : (
        <View className="h-16 w-16 rounded-xl bg-surface-muted items-center justify-center">
          <UtensilsCrossed size={22} color={colors.mutedForeground} />
        </View>
      )}
      <View className="flex-1">
        <Text variant="caption" muted>
          {MEAL_LABEL[meal.meal_type]} · {time}
        </Text>
        <Text variant="label" numberOfLines={1}>
          {meal.description || 'Meal'}
        </Text>
        <View className="flex-row gap-3 mt-1">
          <MacroDot label="P" value={meal.protein_g} color={colors.macroProtein} />
          <MacroDot label="C" value={meal.carbs_g} color={colors.macroCarbs} />
          <MacroDot label="F" value={meal.fat_g} color={colors.macroFat} />
        </View>
      </View>
      <View className="items-end">
        <Text className="font-display text-2xl" style={{ color: colors.macroCalories }}>
          {meal.total_calories}
        </Text>
        <Text variant="caption" muted>
          kcal
        </Text>
        {tone && meal.score ? (
          <Text variant="caption" className="font-bold mt-0.5" style={{ color: toneColor }}>
            {meal.score}/10
          </Text>
        ) : null}
      </View>
    </PressableScale>
  )
}
