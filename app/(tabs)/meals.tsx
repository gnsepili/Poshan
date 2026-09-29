import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, Pressable, Modal, ActivityIndicator } from 'react-native'
import { useNetInfo } from '@react-native-community/netinfo'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { MealPhotoCapture } from '../../components/meals/MealPhotoCapture'
import { MealCard } from '../../components/meals/MealCard'
import { analyzeMealPhoto } from '../../lib/api/mealAnalysis'
import { parseManualMacros } from '../../lib/utils/manualMealEntry'
import { MealType } from '../../types'

export default function MealsScreen() {
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals, addMeal, loading, pendingCount } = useMealsStore()
  const netInfo = useNetInfo()
  const isOffline = netInfo.isConnected === false
  const [modalOpen, setModalOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [analysing, setAnalysing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [manualCalories, setManualCalories] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarbs, setManualCarbs] = useState('')
  const [manualFat, setManualFat] = useState('')
  const [manualFiber, setManualFiber] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [savingOffline, setSavingOffline] = useState(false)

  useEffect(() => {
    if (user) fetchTodayMeals(user.id)
  }, [user])

  const resetForm = () => {
    setPhotoUrl(null)
    setDescription('')
    setManualCalories('')
    setManualProtein('')
    setManualCarbs('')
    setManualFat('')
    setManualFiber('')
    setManualError(null)
    setAnalysisError(null)
  }

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
      resetForm()
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Meal analysis failed')
    } finally {
      setAnalysing(false)
    }
  }

  // Offline path: no photo upload, no AI analysis (both need connectivity) — just a manual
  // macro entry that goes straight to addMeal, which enqueues it (existing offline path) and
  // syncs automatically once flushQueue runs on reconnect/foreground.
  const handleLogOffline = async () => {
    if (!user) return
    const macros = parseManualMacros({
      calories: manualCalories,
      protein: manualProtein,
      carbs: manualCarbs,
      fat: manualFat,
      fiber: manualFiber,
    })
    if (!macros) {
      setManualError('Enter valid non-negative numbers for calories, protein, carbs, and fat.')
      return
    }
    setManualError(null)
    setSavingOffline(true)
    try {
      await addMeal({
        user_id: user.id,
        meal_type: mealType,
        description,
        ...macros,
        ai_suggestions: null,
      })
      setModalOpen(false)
      resetForm()
    } finally {
      setSavingOffline(false)
    }
  }

  const todayTotal = meals.reduce((sum, m) => sum + m.total_calories, 0)

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Today&apos;s meals</Text>
        <Text className="text-gray-500">{todayTotal} kcal logged</Text>
      </View>
      {pendingCount > 0 && (
        <View className="bg-amber-50 border-b border-amber-200 px-6 py-2">
          <Text className="text-amber-800 text-xs">
            {pendingCount} meal{pendingCount > 1 ? 's' : ''} saved offline — will sync automatically.
          </Text>
        </View>
      )}
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
          {isOffline ? (
            <View className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-amber-800 text-xs font-medium">
                You&apos;re offline — log manually and it will sync automatically once you&apos;re back online.
              </Text>
            </View>
          ) : (
            <MealPhotoCapture onUploaded={setPhotoUrl} />
          )}
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
            placeholder="Describe your meal (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          {isOffline && (
            <View className="mb-4">
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 mb-2"
                placeholder="Calories"
                keyboardType="numeric"
                value={manualCalories}
                onChangeText={setManualCalories}
              />
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 mb-2"
                placeholder="Protein (g)"
                keyboardType="numeric"
                value={manualProtein}
                onChangeText={setManualProtein}
              />
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 mb-2"
                placeholder="Carbs (g)"
                keyboardType="numeric"
                value={manualCarbs}
                onChangeText={setManualCarbs}
              />
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 mb-2"
                placeholder="Fat (g)"
                keyboardType="numeric"
                value={manualFat}
                onChangeText={setManualFat}
              />
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3"
                placeholder="Fiber (g, optional)"
                keyboardType="numeric"
                value={manualFiber}
                onChangeText={setManualFiber}
              />
            </View>
          )}
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
          {isOffline ? (
            <>
              {savingOffline && <ActivityIndicator className="mb-4" />}
              {manualError && <Text className="text-red-500 text-xs mb-4">{manualError}</Text>}
              <Pressable className="bg-green-600 rounded-lg py-4 items-center" onPress={handleLogOffline} disabled={savingOffline}>
                <Text className="text-white font-semibold">Log meal (offline)</Text>
              </Pressable>
            </>
          ) : (
            <>
              {analysing && <ActivityIndicator className="mb-4" />}
              {analysisError && <Text className="text-red-500 text-xs mb-4">{analysisError}</Text>}
              <Pressable className="bg-green-600 rounded-lg py-4 items-center" onPress={handleLog} disabled={!photoUrl || analysing}>
                <Text className="text-white font-semibold">Analyse & log meal</Text>
              </Pressable>
            </>
          )}
          <Pressable className="py-4 items-center mt-2" onPress={() => { setModalOpen(false); resetForm() }}>
            <Text className="text-gray-500">Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}
