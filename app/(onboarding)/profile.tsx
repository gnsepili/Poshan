import { useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Calendar, Ruler, Weight as WeightIcon } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { ActivityLevel } from '../../types'
import { Screen, Heading, Text, Input, Chip, Button } from '../../components/ui'

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very active',
}

const SEX_LABELS: Record<'male' | 'female' | 'other', string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
}

// Inclusive sanity bounds — catches typos (e.g. 1750 cm) before they reach the coach.
function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

export default function OnboardingProfileScreen() {
  const router = useRouter()
  // Settings opens this screen with ?mode=edit to change an existing profile.
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit'
  const { user } = useAuthStore()
  const { profile, upsertProfile, loading, error } = useProfileStore()
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '')
  const [sex, setSex] = useState<'male' | 'female' | 'other'>(profile?.sex ?? 'male')
  const [heightCm, setHeightCm] = useState(profile?.height_cm ? String(profile.height_cm) : '')
  const [weightKg, setWeightKg] = useState(profile?.current_weight_kg ? String(profile.current_weight_kg) : '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activity_level ?? 'moderate')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!user) return
    const parsed = {
      age: parseInt(age, 10),
      height_cm: parseFloat(heightCm),
      current_weight_kg: parseFloat(weightKg),
    }
    if (!inRange(parsed.age, 13, 110) || !inRange(parsed.height_cm, 90, 250) || !inRange(parsed.current_weight_kg, 25, 350)) {
      setFormError('Please enter a valid age (13-110), height in cm (90-250) and weight in kg (25-350).')
      return
    }
    setFormError(null)
    await upsertProfile({ id: user.id, ...parsed, sex, activity_level: activityLevel })
    if (useProfileStore.getState().error !== null) return
    if (editing) router.back()
    else router.push('/(onboarding)/goals')
  }

  const shownError = formError ?? error

  return (
    <Screen
      scroll
      back={editing}
      title={editing ? 'Health profile' : undefined}
      footer={<Button label={editing ? 'Save changes' : 'Next: Set goals'} loading={loading} onPress={handleSave} />}
    >
      {editing ? null : (
        <View className="mt-1 mb-6">
          <Text variant="caption" muted className="uppercase tracking-wide">
            Step 1 of 2
          </Text>
          <Heading level={1} uppercase>
            Your health profile
          </Heading>
          <Text variant="body" muted className="mt-1">
            Tell us a bit about yourself so we can personalize your plan.
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

      <View className="gap-4">
        <Input
          label="Age"
          icon={Calendar}
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 28"
        />

        <View>
          <Text variant="label" className="mb-1.5">
            Sex
          </Text>
          <View className="flex-row gap-2">
            {(['male', 'female', 'other'] as const).map((s) => (
              <Chip
                key={s}
                label={SEX_LABELS[s]}
                selected={sex === s}
                onPress={() => setSex(s)}
                className="flex-1 justify-center"
              />
            ))}
          </View>
        </View>

        <Input
          label="Height (cm)"
          icon={Ruler}
          keyboardType="decimal-pad"
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="e.g. 175"
        />
        <Input
          label="Current weight (kg)"
          icon={WeightIcon}
          keyboardType="decimal-pad"
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="e.g. 75"
        />

        <View>
          <Text variant="label" className="mb-1.5">
            Activity level
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {ACTIVITY_LEVELS.map((level) => (
              <Chip
                key={level}
                label={ACTIVITY_LABELS[level]}
                selected={activityLevel === level}
                onPress={() => setActivityLevel(level)}
              />
            ))}
          </View>
        </View>
      </View>
    </Screen>
  )
}
