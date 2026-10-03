import { useEffect, useState } from 'react'
import { View, ScrollView, Modal, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetInfo } from '@react-native-community/netinfo'
import { Plus, X, UtensilsCrossed } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { MealPhotoCapture } from '../../components/meals/MealPhotoCapture'
import { MealCard } from '../../components/meals/MealCard'
import { analyzeMealPhoto } from '../../lib/api/mealAnalysis'
import { parseManualMacros } from '../../lib/utils/manualMealEntry'
import { MealType } from '../../types'
import { Screen, Heading, Text, Button, IconButton, Input, Chip, EmptyState } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const FAB_SHADOW = {
  shadowColor: '#0B1210',
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
}

export default function MealsScreen() {
  const { user } = useAuthStore()
  const { meals, fetchTodayMeals, addMeal, loading, pendingCount } = useMealsStore()
  const netInfo = useNetInfo()
  const isOffline = netInfo.isConnected === false
  const colors = useThemeColors()
  const insets = useSafeAreaInsets()
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
    <Screen title="Today's meals" subtitle={`${todayTotal} kcal logged`} contentClassName="flex-1">
      {pendingCount > 0 ? (
        <View className="bg-accent-soft rounded-2xl px-4 py-3 mb-3">
          <Text variant="bodySm" className="text-accent font-semibold">
            {pendingCount} meal{pendingCount > 1 ? 's' : ''} saved offline — will sync automatically.
          </Text>
        </View>
      ) : null}

      <View className="flex-1">
        {loading ? (
          <ActivityIndicator className="mt-8" color={colors.primary} />
        ) : meals.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="No meals yet"
            description="Tap the + button to log your first meal of the day."
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
            <View className="gap-3">
              {meals.map((m) => (
                <MealCard key={m.id} meal={m} />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View className="absolute bottom-6 right-5" style={FAB_SHADOW}>
        <IconButton
          icon={Plus}
          accessibilityLabel="Log a meal"
          variant="primary"
          size="lg"
          onPress={() => setModalOpen(true)}
        />
      </View>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 12 }}>
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Heading level={3} uppercase>
              Log a meal
            </Heading>
            <IconButton
              icon={X}
              accessibilityLabel="Close"
              variant="ghost"
              onPress={() => {
                setModalOpen(false)
                resetForm()
              }}
            />
          </View>

          <ScrollView
            className="flex-1 px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {isOffline ? (
              <View className="bg-accent-soft rounded-2xl px-4 py-3 mb-4">
                <Text variant="bodySm" className="text-accent font-semibold">
                  You&apos;re offline — log manually and it will sync automatically once you&apos;re
                  back online.
                </Text>
              </View>
            ) : (
              <MealPhotoCapture onUploaded={setPhotoUrl} />
            )}

            <Input
              placeholder="Describe your meal (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              containerClassName="mt-4"
            />

            {isOffline ? (
              <View className="gap-3 mt-4">
                <Input
                  placeholder="Calories"
                  keyboardType="numeric"
                  value={manualCalories}
                  onChangeText={setManualCalories}
                />
                <Input
                  placeholder="Protein (g)"
                  keyboardType="numeric"
                  value={manualProtein}
                  onChangeText={setManualProtein}
                />
                <Input
                  placeholder="Carbs (g)"
                  keyboardType="numeric"
                  value={manualCarbs}
                  onChangeText={setManualCarbs}
                />
                <Input
                  placeholder="Fat (g)"
                  keyboardType="numeric"
                  value={manualFat}
                  onChangeText={setManualFat}
                />
                <Input
                  placeholder="Fiber (g, optional)"
                  keyboardType="numeric"
                  value={manualFiber}
                  onChangeText={setManualFiber}
                />
              </View>
            ) : null}

            <View className="flex-row flex-wrap gap-2 mt-5">
              {MEAL_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t.charAt(0).toUpperCase() + t.slice(1)}
                  selected={mealType === t}
                  onPress={() => setMealType(t)}
                />
              ))}
            </View>

            {isOffline ? (
              <>
                {manualError ? (
                  <View className="bg-danger-soft rounded-2xl px-4 py-3 mt-5">
                    <Text variant="bodySm" className="text-danger">
                      {manualError}
                    </Text>
                  </View>
                ) : null}
                <Button
                  label="Log meal (offline)"
                  variant="accent"
                  loading={savingOffline}
                  disabled={savingOffline}
                  onPress={handleLogOffline}
                  className="mt-5"
                />
              </>
            ) : (
              <>
                {analysisError ? (
                  <View className="bg-danger-soft rounded-2xl px-4 py-3 mt-5">
                    <Text variant="bodySm" className="text-danger">
                      {analysisError}
                    </Text>
                  </View>
                ) : null}
                <Button
                  label="Analyse & log meal"
                  variant="accent"
                  loading={analysing}
                  disabled={!photoUrl || analysing}
                  onPress={handleLog}
                  className="mt-5"
                />
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  )
}
