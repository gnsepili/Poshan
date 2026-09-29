import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, Pressable, Modal, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { MealPhotoCapture } from '../../components/meals/MealPhotoCapture'
import { MealCard } from '../../components/meals/MealCard'
import { analyzeMealPhoto } from '../../lib/api/mealAnalysis'
import { MealType } from '../../types'

export default function MealsScreen() {
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals, addMeal, loading } = useMealsStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [analysing, setAnalysing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    if (user) fetchTodayMeals(user.id)
  }, [user])

  const handleLog = async () => {
    if (!user || !photoUrl) return
    setAnalysing(true)
    setAnalysisError(null)
    try {
      const analysis = await analyzeMealPhoto(photoUrl, description)
      await addMeal({
        user_id: user.id,
        meal_type: mealType,
        description,
        photo_url: photoUrl,
        total_calories: analysis.total_calories,
        protein_g: analysis.protein_g,
        carbs_g: analysis.carbs_g,
        fat_g: analysis.fat_g,
        fiber_g: analysis.fiber_g,
        ai_suggestions: analysis.suggestions ?? null,
      })
      setModalOpen(false)
      setPhotoUrl(null)
      setDescription('')
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Meal analysis failed')
    } finally {
      setAnalysing(false)
    }
  }

  const todayTotal = meals.reduce((sum, m) => sum + m.total_calories, 0)

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Today&apos;s meals</Text>
        <Text className="text-gray-500">{todayTotal} kcal logged</Text>
      </View>
      <ScrollView className="flex-1 px-4 pt-4">
        {loading ? <ActivityIndicator className="mt-8" /> : meals.map((m) => <MealCard key={m.id} meal={m} />)}
      </ScrollView>
      <Pressable
        className="absolute bottom-6 right-6 bg-green-600 rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={() => setModalOpen(true)}
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white px-6 pt-12">
          <Text className="text-xl font-bold mb-4">Log a meal</Text>
          <MealPhotoCapture onUploaded={setPhotoUrl} />
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
            placeholder="Describe your meal (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <View className="flex-row gap-2 mb-6">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setMealType(t)}
                className={`flex-1 py-2 rounded-lg border items-center ${mealType === t ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}
              >
                <Text className={`text-xs ${mealType === t ? 'text-white' : 'text-gray-600'}`}>{t}</Text>
              </Pressable>
            ))}
          </View>
          {analysing && <ActivityIndicator className="mb-4" />}
          {analysisError && <Text className="text-red-500 text-xs mb-4">{analysisError}</Text>}
          <Pressable className="bg-green-600 rounded-lg py-4 items-center" onPress={handleLog} disabled={!photoUrl || analysing}>
            <Text className="text-white font-semibold">Analyse & log meal</Text>
          </Pressable>
          <Pressable className="py-4 items-center mt-2" onPress={() => setModalOpen(false)}>
            <Text className="text-gray-500">Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}
