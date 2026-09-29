import { useEffect } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { usePlansStore } from '../../stores/plansStore'
import { planDays, dayMeals, dayExercises } from '../../lib/utils/plan'
import { MealPlanDay, WorkoutPlanDay } from '../../types'

export default function PlansScreen() {
  const { user } = useAuthStore()
  const { mealPlan, workoutPlan, loading, generating, error, fetchPlans, generateMealPlan, generateWorkoutPlan } = usePlansStore()

  useEffect(() => { if (user) fetchPlans(user.id) }, [user])

  const mealDays = planDays<MealPlanDay>(mealPlan?.plan_json ?? null)
  const workoutDays = planDays<WorkoutPlanDay>(workoutPlan?.plan_json ?? null)

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Plans</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}
      {(loading || generating) && <ActivityIndicator className="mt-6" color="#16a34a" />}

      {/* Meal plan */}
      <View className="px-6 pt-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-800">Meal plan</Text>
          <Pressable className="bg-green-600 rounded-lg px-4 py-2" disabled={generating} onPress={() => user && generateMealPlan(user.id)}>
            <Text className="text-white font-semibold text-sm">Regenerate</Text>
          </Pressable>
        </View>
        {mealDays.length === 0 ? (
          <Text className="text-gray-400 text-center py-6">No plan yet — tap Regenerate</Text>
        ) : (
          mealDays.map((d, i) => (
            <View key={`${d.day}-${i}`} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <Text className="font-semibold text-gray-900 mb-2">{d.day}</Text>
              {dayMeals(d).map((m, j) => (
                <View key={j} className="mb-2">
                  <Text className="text-sm text-gray-800 capitalize">{m.meal_type}: {m.description}</Text>
                  <Text className="text-xs text-gray-500">{m.calories} kcal · {m.protein_g}p / {m.carbs_g}c / {m.fat_g}f</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      {/* Workout plan */}
      <View className="px-6 pt-2 pb-8">
        <View className="flex-row items-center justify-between mb-3 mt-2">
          <Text className="text-lg font-semibold text-gray-800">Workout plan</Text>
          <Pressable className="bg-green-600 rounded-lg px-4 py-2" disabled={generating} onPress={() => user && generateWorkoutPlan(user.id)}>
            <Text className="text-white font-semibold text-sm">Regenerate</Text>
          </Pressable>
        </View>
        {workoutDays.length === 0 ? (
          <Text className="text-gray-400 text-center py-6">No plan yet — tap Regenerate</Text>
        ) : (
          workoutDays.map((d, i) => (
            <View key={`${d.day}-${i}`} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <Text className="font-semibold text-gray-900">{d.day}</Text>
              <Text className="text-xs text-gray-500 mb-2">{d.focus}</Text>
              {dayExercises(d).map((ex, j) => (
                <View key={j} className="mb-1">
                  <Text className="text-sm text-gray-800">{ex.name} — {ex.sets} × {ex.reps}</Text>
                  {ex.notes ? <Text className="text-xs text-gray-400">{ex.notes}</Text> : null}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}
