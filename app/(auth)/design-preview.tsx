import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { Screen, Heading, Text } from '../../components/ui'
import { TodayRings } from '../../components/home/TodayRings'
import { MacroTile } from '../../components/home/MacroTile'
import { MealCard } from '../../components/meals/MealCard'
import { MealResult } from '../../components/meals/MealResult'
import { useThemeColors } from '../../lib/theme'
import { Meal } from '../../types'

// Development-only gallery of the redesigned components with sample data, so the UI can
// be checked on web without signing in. Release builds redirect away.
const sampleMeal: Meal = {
  id: 'preview-1',
  user_id: 'preview',
  logged_at: new Date().toISOString(),
  meal_type: 'lunch',
  photo_url: null,
  description: 'Paneer tikka bowl',
  total_calories: 650,
  protein_g: 45,
  carbs_g: 60,
  fat_g: 25,
  fiber_g: 6,
  ai_suggestions: 'Great protein. Swap half the rice for salad to save about 150 kcal.',
  items: [
    { name: 'Paneer tikka', portion: '150 g', calories: 280, protein_g: 28, carbs_g: 8, fat_g: 16 },
    { name: 'Jeera rice', portion: '1 cup', calories: 300, protein_g: 6, carbs_g: 48, fat_g: 8 },
    { name: 'Onion salad', portion: '1 bowl', calories: 70, protein_g: 2, carbs_g: 12, fat_g: 1 },
  ],
  score: 8,
  score_label: 'High protein',
  created_at: new Date().toISOString(),
}

export default function DesignPreview() {
  const colors = useThemeColors()
  if (!__DEV__) return <Redirect href="/(auth)/login" />
  return (
    <Screen scroll>
      <Text variant="bodySm" muted className="mt-1">Good afternoon</Text>
      <Heading level={1} uppercase className="mb-4">Today</Heading>
      <TodayRings
        calories={{ label: 'Calories', value: 1240, target: 2100 }}
        protein={{ label: 'Protein', value: 86, target: 150, unit: 'g' }}
        steps={{ label: 'Steps', value: 6420, target: 8000 }}
      />
      <View className="flex-row gap-2.5 mt-3 mb-6">
        <MacroTile label="Protein" value={86} target={150} color={colors.macroProtein} trackColor={colors.macroProteinSoft} />
        <MacroTile label="Carbs" value={142} target={230} color={colors.macroCarbs} trackColor={colors.macroCarbsSoft} />
        <MacroTile label="Fat" value={38} target={70} color={colors.macroFat} trackColor={colors.macroFatSoft} />
      </View>
      <Heading level={4} uppercase className="mb-3">Today&apos;s meals</Heading>
      <MealCard meal={sampleMeal} onPress={() => {}} />
      <Heading level={4} uppercase className="mt-8 mb-3">Meal result</Heading>
      <MealResult
        targets={{ calories: 2100, protein: 150, carbs: 230, fat: 70 }}
        data={{
          title: sampleMeal.description,
          mealType: sampleMeal.meal_type,
          loggedAt: sampleMeal.logged_at,
          photo: null,
          calories: sampleMeal.total_calories,
          protein_g: sampleMeal.protein_g,
          carbs_g: sampleMeal.carbs_g,
          fat_g: sampleMeal.fat_g,
          items: sampleMeal.items ?? [],
          score: sampleMeal.score,
          scoreLabel: sampleMeal.score_label,
          tip: sampleMeal.ai_suggestions,
        }}
      />
    </Screen>
  )
}
