import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
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

export default function OnboardingProfileScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { upsertProfile, loading, error } = useProfileStore()
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')

  const handleNext = async () => {
    if (!user) return
    await upsertProfile({
      id: user.id,
      age: parseInt(age, 10),
      sex,
      height_cm: parseFloat(heightCm),
      current_weight_kg: parseFloat(weightKg),
      activity_level: activityLevel,
    })
    if (useProfileStore.getState().error === null) {
      router.push('/(onboarding)/goals')
    }
  }

  return (
    <Screen scroll footer={<Button label="Next: Set goals" loading={loading} onPress={handleNext} />}>
      <View className="mt-1 mb-6">
        <Text variant="caption" muted className="uppercase tracking-wide">
          Step 1 of 3
        </Text>
        <Heading level={1} uppercase>
          Your health profile
        </Heading>
        <Text variant="body" muted className="mt-1">
          Tell us a bit about yourself so we can personalize your plan.
        </Text>
      </View>

      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {error}
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
