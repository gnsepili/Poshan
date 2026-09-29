import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'

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
    <ScrollView className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold mb-6 text-gray-900">Your goals</Text>
      {error && <Text className="text-red-500 mb-4">{error}</Text>}
      {[
        { label: 'Target weight (kg)', value: targetWeight, setter: setTargetWeight },
        { label: 'Daily calories (kcal)', value: calories, setter: setCalories },
        { label: 'Protein (g)', value: protein, setter: setProtein },
        { label: 'Carbs (g)', value: carbs, setter: setCarbs },
        { label: 'Fat (g)', value: fat, setter: setFat },
        { label: 'Daily steps', value: steps, setter: setSteps },
      ].map(({ label, value, setter }) => (
        <View key={label} className="mb-4">
          <Text className="text-gray-600 mb-1">{label}</Text>
          <TextInput className="border border-gray-300 rounded-lg px-4 py-3" keyboardType="decimal-pad" value={value} onChangeText={setter} />
        </View>
      ))}
      <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-8 mt-4" onPress={handleNext} disabled={loading}>
        <Text className="text-white font-semibold text-base">Next: AI setup</Text>
      </Pressable>
    </ScrollView>
  )
}
