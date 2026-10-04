import { useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Scale, Flame, Footprints } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { Screen, Heading, Text, Input, Card, Button } from '../../components/ui'

const toText = (n: number | null | undefined): string => (n ? String(n) : '')

export default function OnboardingGoalsScreen() {
  const router = useRouter()
  // Settings opens this screen with ?mode=edit to change existing goals.
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit'
  const { user } = useAuthStore()
  const { goals, upsertGoals, loading, error } = useProfileStore()
  const [targetWeight, setTargetWeight] = useState(toText(goals?.target_weight_kg))
  const [calories, setCalories] = useState(toText(goals?.daily_calorie_target))
  const [protein, setProtein] = useState(toText(goals?.daily_protein_g))
  const [carbs, setCarbs] = useState(toText(goals?.daily_carbs_g))
  const [fat, setFat] = useState(toText(goals?.daily_fat_g))
  const [steps, setSteps] = useState(toText(goals?.daily_steps_target) || '8000')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!user) return
    const parsed = {
      target_weight_kg: parseFloat(targetWeight),
      daily_calorie_target: parseInt(calories, 10),
      daily_protein_g: parseInt(protein, 10),
      daily_carbs_g: parseInt(carbs, 10),
      daily_fat_g: parseInt(fat, 10),
      daily_steps_target: parseInt(steps, 10),
    }
    if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0) || parsed.daily_calorie_target < 800) {
      setFormError('Please fill in every field with a valid number (at least 800 kcal a day).')
      return
    }
    setFormError(null)
    // Goals are append-only: carry over what this form doesn't edit (coach-set targets/notes).
    await upsertGoals({
      user_id: user.id,
      target_body_fat_pct: goals?.target_body_fat_pct ?? null,
      target_muscle_mass_kg: goals?.target_muscle_mass_kg ?? null,
      notes: goals?.notes ?? '',
      ...parsed,
    })
    if (useProfileStore.getState().error !== null) return
    if (editing) router.back()
    else router.replace('/(tabs)')
  }

  const shownError = formError ?? error

  return (
    <Screen
      scroll
      back={editing}
      title={editing ? 'Goals' : undefined}
      footer={<Button label={editing ? 'Save changes' : 'Start coaching'} loading={loading} onPress={handleSave} />}
    >
      {editing ? null : (
        <View className="mt-1 mb-6">
          <Text variant="caption" muted className="uppercase tracking-wide">
            Step 2 of 2
          </Text>
          <Heading level={1} uppercase>
            Your goals
          </Heading>
          <Text variant="body" muted className="mt-1">
            Set the targets we&apos;ll track against every day.
          </Text>
        </View>
      )}

      {shownError ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {shownError}
          </Text>
        </View>
      ) : null}

      <View className="gap-4 mb-4">
        <Input
          label="Target weight (kg)"
          icon={Scale}
          keyboardType="decimal-pad"
          value={targetWeight}
          onChangeText={setTargetWeight}
        />
        <Input
          label="Daily calories (kcal)"
          icon={Flame}
          keyboardType="number-pad"
          value={calories}
          onChangeText={setCalories}
        />
      </View>

      <Card className="mb-4">
        <Heading level={4} uppercase className="mb-3">
          Macros
        </Heading>
        <View className="gap-4">
          <Input label="Protein (g)" keyboardType="number-pad" value={protein} onChangeText={setProtein} />
          <Input label="Carbs (g)" keyboardType="number-pad" value={carbs} onChangeText={setCarbs} />
          <Input label="Fat (g)" keyboardType="number-pad" value={fat} onChangeText={setFat} />
        </View>
      </Card>

      <Input
        label="Daily steps"
        icon={Footprints}
        keyboardType="number-pad"
        value={steps}
        onChangeText={setSteps}
        containerClassName="mb-4"
      />
    </Screen>
  )
}
