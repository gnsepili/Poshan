import { useState } from 'react'
import { ActivityIndicator, Image, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useNetInfo } from '@react-native-community/netinfo'
import { Camera, Images, PenLine } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useMealsStore } from '../../stores/mealsStore'
import { useProfileStore } from '../../stores/profileStore'
import { analyzeMealPhoto, MealAnalysisResult } from '../../lib/api/mealAnalysis'
import { uploadMealPhoto } from '../../lib/api/mealPhotos'
import { parseManualMacros } from '../../lib/utils/manualMealEntry'
import { mealTypeForTime } from '../../lib/utils/mealScore'
import { logError } from '../../lib/telemetry'
import { useThemeColors } from '../../lib/theme'
import { MealType } from '../../types'
import { Screen, Text, Button, Input, Chip } from '../../components/ui'
import { FadeIn, PressableScale, Skeleton, SuccessBurst } from '../../components/motion'
import { MealResult } from '../../components/meals/MealResult'

type Phase = 'capture' | 'analyzing' | 'review' | 'manual' | 'done'

const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
]

const num = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 10) / 10) : '')

export default function NewMealScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { goals } = useProfileStore()
  const { addMeal } = useMealsStore()
  const offline = useNetInfo().isConnected === false

  const [phase, setPhase] = useState<Phase>(offline ? 'manual' : 'capture')
  const [localUri, setLocalUri] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MealAnalysisResult | null>(null)
  const [mealType, setMealType] = useState<MealType>(mealTypeForTime())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [doneDetail, setDoneDetail] = useState<string | undefined>()

  // Editable values (prefilled from the analysis; also used by manual entry).
  const [title, setTitle] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')

  const targets = {
    calories: goals?.daily_calorie_target ?? 2000,
    protein: goals?.daily_protein_g ?? 150,
    carbs: goals?.daily_carbs_g ?? 250,
    fat: goals?.daily_fat_g ?? 70,
  }

  const pickAndAnalyze = async (source: 'camera' | 'library') => {
    if (!user) return
    setError(null)
    try {
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
      if (result.canceled) return
      const uri = result.assets[0].uri
      setLocalUri(uri)
      setPhase('analyzing')
      const path = await uploadMealPhoto(user.id, uri)
      setPhotoPath(path)
      const res = await analyzeMealPhoto(path)
      setAnalysis(res)
      setTitle(res.title || res.items.join(', '))
      setCalories(String(res.total_calories))
      setProtein(num(res.protein_g))
      setCarbs(num(res.carbs_g))
      setFat(num(res.fat_g))
      setFiber(num(res.fiber_g))
      setPhase('review')
    } catch (e) {
      logError('meal-snap', e)
      setError(e instanceof Error ? e.message : "Couldn't read that photo. Try again.")
      setPhase('capture')
    }
  }

  const save = async () => {
    if (!user) return
    const macros = parseManualMacros({ calories, protein, carbs, fat, fiber })
    if (!macros) {
      setError('Enter valid non-negative numbers for calories, protein, carbs and fat.')
      setEditing(true)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const result = await addMeal({
        user_id: user.id,
        meal_type: mealType,
        description: title.trim() || 'Meal',
        ...macros,
        photo_url: photoPath ?? undefined,
        ai_suggestions: analysis?.suggestions || null,
        items: analysis?.item_breakdown ?? null,
        score: analysis?.score ?? null,
        score_label: analysis?.score_label || null,
      })
      if (result.status === 'failed') {
        setError(result.error)
        return
      }
      setDoneDetail(result.status === 'queued' ? "Saved offline — it'll sync when you're back online." : `${macros.total_calories} kcal added to today`)
      setPhase('done')
      setTimeout(() => router.back(), 1100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the meal.')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'done') return <SuccessBurst label="Logged" detail={doneDetail} />

  const typeChips = (
    <View className="flex-row flex-wrap gap-2">
      {MEAL_TYPES.map((t) => (
        <Chip key={t.id} label={t.label} selected={mealType === t.id} onPress={() => setMealType(t.id)} />
      ))}
    </View>
  )

  const valueFields = (
    <View className="gap-3">
      <Input label="Meal name" value={title} onChangeText={setTitle} placeholder="Dal, rice and salad" />
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="Calories" keyboardType="number-pad" value={calories} onChangeText={setCalories} /></View>
        <View className="flex-1"><Input label="Protein (g)" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} /></View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="Carbs (g)" keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} /></View>
        <View className="flex-1"><Input label="Fat (g)" keyboardType="decimal-pad" value={fat} onChangeText={setFat} /></View>
      </View>
      <Input label="Fiber (g, optional)" keyboardType="decimal-pad" value={fiber} onChangeText={setFiber} />
    </View>
  )

  const errorBanner = error ? (
    <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
      <Text variant="bodySm" className="text-danger">{error}</Text>
    </View>
  ) : null

  if (phase === 'review' && analysis) {
    const parsed = parseManualMacros({ calories, protein, carbs, fat, fiber })
    return (
      <Screen
        back
        title="Your meal"
        scroll
        footer={
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Log meal" onPress={save} loading={saving} />
            </View>
            <Button label={editing ? 'Done' : 'Edit'} variant="secondary" fullWidth={false} onPress={() => setEditing((v) => !v)} />
          </View>
        }
      >
        {errorBanner}
        <MealResult
          targets={targets}
          data={{
            title,
            mealType,
            photo: photoPath ?? localUri,
            calories: parsed?.total_calories ?? analysis.total_calories,
            protein_g: parsed?.protein_g ?? analysis.protein_g,
            carbs_g: parsed?.carbs_g ?? analysis.carbs_g,
            fat_g: parsed?.fat_g ?? analysis.fat_g,
            items: analysis.item_breakdown ?? [],
            score: analysis.score,
            scoreLabel: analysis.score_label || null,
            tip: analysis.suggestions || null,
          }}
        >
          <View className="gap-4">
            {typeChips}
            {editing ? valueFields : null}
            <Button label="Retake photo" variant="ghost" icon={Camera} onPress={() => setPhase('capture')} />
          </View>
        </MealResult>
      </Screen>
    )
  }

  if (phase === 'analyzing') {
    return (
      <Screen back title="Reading your meal" scroll>
        {localUri ? <Image source={{ uri: localUri }} className="w-full h-56 rounded-3xl bg-surface-muted" resizeMode="cover" /> : null}
        <View className="flex-row items-center gap-2 mt-5 mb-4">
          <ActivityIndicator color={colors.primary} />
          <Text variant="body" muted>Identifying food and estimating nutrition…</Text>
        </View>
        <Skeleton className="h-10 w-2/3 mb-3" />
        <Skeleton className="h-14 w-1/2 mb-4" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </Screen>
    )
  }

  if (phase === 'manual') {
    return (
      <Screen back title="Log a meal" scroll footer={<Button label="Log meal" onPress={save} loading={saving} />}>
        {offline ? (
          <View className="bg-accent-soft rounded-2xl px-4 py-3 mb-4">
            <Text variant="bodySm" className="text-accent font-semibold">
              You&apos;re offline — log it manually and it will sync once you&apos;re back online.
            </Text>
          </View>
        ) : null}
        {errorBanner}
        <View className="gap-4">
          {typeChips}
          {valueFields}
          {!offline ? <Button label="Snap a photo instead" variant="ghost" icon={Camera} onPress={() => setPhase('capture')} /> : null}
        </View>
      </Screen>
    )
  }

  return (
    <Screen back title="Snap a meal" scroll>
      {errorBanner}
      <FadeIn index={0}>
        <PressableScale
          className="bg-surface rounded-3xl h-64 items-center justify-center"
          onPress={() => pickAndAnalyze('camera')}
          accessibilityRole="button"
          accessibilityLabel="Take a photo of your meal"
        >
          <View className="h-20 w-20 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent }}>
            <Camera size={36} color={colors.onAccent} />
          </View>
          <Text className="font-display text-2xl text-foreground uppercase mt-4">Take a photo</Text>
          <Text variant="bodySm" muted className="mt-1">We&apos;ll work out the calories and macros</Text>
        </PressableScale>
      </FadeIn>
      <FadeIn index={1} className="flex-row gap-3 mt-3">
        <View className="flex-1">
          <PressableScale className="bg-surface rounded-2xl py-4 items-center" onPress={() => pickAndAnalyze('library')} accessibilityRole="button">
            <Images size={22} color={colors.macroCarbs} />
            <Text variant="label" className="mt-1.5">From gallery</Text>
          </PressableScale>
        </View>
        <View className="flex-1">
          <PressableScale className="bg-surface rounded-2xl py-4 items-center" onPress={() => setPhase('manual')} accessibilityRole="button">
            <PenLine size={22} color={colors.macroFat} />
            <Text variant="label" className="mt-1.5">Enter manually</Text>
          </PressableScale>
        </View>
      </FadeIn>
    </Screen>
  )
}
