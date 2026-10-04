import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { useMealsStore } from '../../stores/mealsStore'
import { useProfileStore } from '../../stores/profileStore'
import { useThemeColors } from '../../lib/theme'
import { Meal } from '../../types'
import { Screen, Text, Button } from '../../components/ui'
import { MealResult } from '../../components/meals/MealResult'

function confirmDelete(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.('Delete this meal?')) onConfirm()
    return
  }
  Alert.alert('Delete this meal?', "It will be removed from today's totals.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}

// A logged meal in the same rich view as right after snapping it.
export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const colors = useThemeColors()
  const { goals } = useProfileStore()
  const { meals, deleteMeal, error } = useMealsStore()
  const cached = meals.find((m) => m.id === id) ?? null
  const [meal, setMeal] = useState<Meal | null>(cached)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (cached || !id) return
    supabase
      .from('meals')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) setLoadError(e?.message ?? 'This meal no longer exists.')
        else setMeal(data as unknown as Meal)
      })
  }, [id])

  const onDelete = () =>
    confirmDelete(async () => {
      if (!meal) return
      setDeleting(true)
      const ok = await deleteMeal(meal.id)
      setDeleting(false)
      if (ok) router.back()
    })

  return (
    <Screen
      back
      title="Meal"
      scroll
      headerRight={
        meal ? (
          <Button label="Delete" variant="ghost" size="sm" icon={Trash2} fullWidth={false} loading={deleting} onPress={onDelete} />
        ) : undefined
      }
    >
      {error || loadError ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{loadError ?? error}</Text>
        </View>
      ) : null}
      {meal ? (
        <MealResult
          targets={{
            calories: goals?.daily_calorie_target ?? 2000,
            protein: goals?.daily_protein_g ?? 150,
            carbs: goals?.daily_carbs_g ?? 250,
            fat: goals?.daily_fat_g ?? 70,
          }}
          data={{
            title: meal.description,
            mealType: meal.meal_type,
            loggedAt: meal.logged_at,
            photo: meal.photo_url,
            calories: meal.total_calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            items: meal.items ?? [],
            score: meal.score,
            scoreLabel: meal.score_label,
            tip: meal.ai_suggestions,
          }}
        />
      ) : !loadError ? (
        <ActivityIndicator className="mt-10" color={colors.primary} />
      ) : null}
    </Screen>
  )
}
