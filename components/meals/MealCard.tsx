import { Image, View } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import { Meal } from '../../types'
import { Card, Text } from '../ui'
import { useThemeColors } from '../../lib/theme'
import { useSignedPhoto } from '../../lib/hooks/useSignedPhoto'

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <Text variant="caption" muted>
        {label} {Math.round(value)}g
      </Text>
    </View>
  )
}

export function MealCard({ meal }: { meal: Meal }) {
  const colors = useThemeColors()
  const photo = useSignedPhoto('meal-photos', meal.photo_url)
  return (
    <Card>
      {photo ? (
        <Image
          source={{ uri: photo }}
          className="w-full h-44 rounded-xl mb-3 bg-surface-muted"
          resizeMode="cover"
          accessibilityLabel={`Photo of ${meal.description || 'meal'}`}
        />
      ) : null}
      <View className="flex-row justify-between items-start mb-2">
        <Text variant="label" className="flex-1 mr-3" numberOfLines={2}>
          {meal.description}
        </Text>
        <Text className="font-display text-xl text-primary">{meal.total_calories}</Text>
      </View>
      <View className="flex-row gap-4">
        <MacroPill label="P" value={meal.protein_g} color={colors.macroProtein} />
        <MacroPill label="C" value={meal.carbs_g} color={colors.macroCarbs} />
        <MacroPill label="F" value={meal.fat_g} color={colors.macroFat} />
      </View>
      {meal.ai_suggestions ? (
        <View className="flex-row items-start gap-2 mt-3 bg-primary-soft rounded-xl p-3">
          <Sparkles size={15} color={colors.primary} />
          <Text variant="caption" className="flex-1 text-foreground">{meal.ai_suggestions}</Text>
        </View>
      ) : null}
    </Card>
  )
}
