import { useEffect } from 'react'
import { View, Text, ScrollView, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { useProfileStore } from '../../stores/profileStore'
import { useDailySummaryStore } from '../../stores/dailySummaryStore'
import { useActivityStore } from '../../stores/activityStore'
import { MealCard } from '../../components/meals/MealCard'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { MacroBar } from '../../components/ui/MacroBar'
import { calcProgress, sumMeals } from '../../lib/utils/macros'
import { sumSteps } from '../../lib/utils/activity'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals, error: mealsError } = useMealsStore()
  const { goals, fetchGoals, error: profileError } = useProfileStore()
  const { summary, fetchOrCreateToday, error: summaryError } = useDailySummaryStore()
  const { todayActivity, fetchTodayActivity, error: activityError } = useActivityStore()

  useEffect(() => {
    if (user) {
      fetchTodayMeals(user.id)
      fetchGoals(user.id)
      fetchOrCreateToday(user.id)
      fetchTodayActivity(user.id)
    }
  }, [user])

  const totals = sumMeals(meals)
  const calorieTarget = goals?.daily_calorie_target ?? 2000
  const proteinTarget = goals?.daily_protein_g ?? 150
  const carbsTarget = goals?.daily_carbs_g ?? 250
  const fatTarget = goals?.daily_fat_g ?? 70
  const stepsToday = sumSteps(todayActivity)
  const stepsTarget = goals?.daily_steps_target ?? 8000
  const errorMessage = mealsError ?? profileError ?? summaryError ?? activityError

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-6">
        <Text className="text-gray-500 text-sm">Good morning</Text>
        <Text className="text-2xl font-bold text-gray-900 mb-6">Today&apos;s progress</Text>
        <View className="flex-row justify-around">
          <ProgressRing percentage={calcProgress(totals.calories, calorieTarget)} label="Calories" value={`${totals.calories}`} color="#16a34a" />
          <ProgressRing percentage={calcProgress(totals.protein, proteinTarget)} label="Protein" value={`${Math.round(totals.protein)}g`} color="#2563eb" />
          <ProgressRing percentage={calcProgress(stepsToday, stepsTarget)} label="Steps" value={`${stepsToday}`} color="#d97706" />
        </View>
      </View>

      {errorMessage && (
        <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <Text className="text-red-600 text-sm">{errorMessage}</Text>
        </View>
      )}

      <View className="flex-row px-4 pt-4 gap-3 mb-4">
        <Pressable className="flex-1 bg-green-600 rounded-xl py-4 items-center" onPress={() => router.push('/(tabs)/meals')}>
          <Text className="text-white font-semibold">Log Meal</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/(tabs)/chat')}>
          <Text className="text-gray-700 font-semibold">Ask Coach</Text>
        </Pressable>
      </View>

      <View className="flex-row px-4 gap-3 mb-4">
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/activity')}>
          <Text className="text-gray-700 font-semibold">Log Activity</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/inbody')}>
          <Text className="text-gray-700 font-semibold">Add InBody</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white rounded-xl py-4 items-center border border-gray-200" onPress={() => router.push('/progress')}>
          <Text className="text-gray-700 font-semibold">Progress</Text>
        </Pressable>
      </View>

      <View className="mx-4 mb-4 bg-white rounded-xl px-4 py-4 border border-gray-100">
        <MacroBar label="Carbs" consumed={totals.carbs} target={carbsTarget} color="#7c3aed" />
        <MacroBar label="Fat" consumed={totals.fat} target={fatTarget} color="#d97706" />
      </View>

      {summary?.ai_coach_note && (
        <View className="mx-4 mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <Text className="text-xs text-amber-700">{summary.ai_coach_note}</Text>
        </View>
      )}

      <View className="px-4">
        <Text className="font-semibold text-gray-700 mb-3">Today&apos;s meals</Text>
        {meals.length === 0
          ? <Text className="text-gray-400 text-center py-8">No meals logged yet today</Text>
          : meals.map(m => <MealCard key={m.id} meal={m} />)
        }
      </View>
    </ScrollView>
  )
}
