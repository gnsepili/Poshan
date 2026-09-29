import { View, Text } from 'react-native'
import { Meal } from '../../types'

export function MealCard({ meal }: { meal: Meal }) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="font-semibold text-gray-900 flex-1 mr-2">{meal.description}</Text>
        <Text className="font-bold text-green-700">{meal.total_calories} kcal</Text>
      </View>
      <View className="flex-row gap-4">
        <Text className="text-xs text-gray-500">P: {meal.protein_g}g</Text>
        <Text className="text-xs text-gray-500">C: {meal.carbs_g}g</Text>
        <Text className="text-xs text-gray-500">F: {meal.fat_g}g</Text>
      </View>
      {meal.ai_suggestions && (
        <Text className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">{meal.ai_suggestions}</Text>
      )}
    </View>
  )
}
