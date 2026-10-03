import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { Scale, Flame, Footprints } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { Screen, Heading, Text, Input, Card, Button } from '../../components/ui'

export default function OnboardingGoalsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { upsertGoals, loading, error } = useProfileStore()
  const [targetWeight, setTargetWeight] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [steps, setSteps] = useState('8000')

  const handleNext = async () => {
    if (!user) return
    await upsertGoals({
      user_id: user.id,
      target_weight_kg: parseFloat(targetWeight),
      daily_calorie_target: parseInt(calories, 10),
      daily_protein_g: parseInt(protein, 10),
      daily_carbs_g: parseInt(carbs, 10),
      daily_fat_g: parseInt(fat, 10),
      daily_steps_target: parseInt(steps, 10),
    })
    if (useProfileStore.getState().error === null) {
      router.push('/(onboarding)/ai-setup')
    }
  }

  return (
    <Screen scroll footer={<Button label="Next: AI setup" loading={loading} onPress={handleNext} />}>
      <View className="mt-1 mb-6">
        <Text variant="caption" muted className="uppercase tracking-wide">
          Step 2 of 3
        </Text>
        <Heading level={1} uppercase>
          Your goals
        </Heading>
        <Text variant="body" muted className="mt-1">
          Set the targets we&apos;ll track against every day.
        </Text>
      </View>

      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {error}
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
