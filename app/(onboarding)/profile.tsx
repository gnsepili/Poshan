import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { ActivityLevel } from '../../types'

const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']

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
    <ScrollView className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold mb-6 text-gray-900">Your health profile</Text>
      {error && <Text className="text-red-500 mb-4">{error}</Text>}
      <Text className="text-gray-600 mb-1">Age</Text>
      <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" keyboardType="number-pad" value={age} onChangeText={setAge} placeholder="e.g. 28" />
      <Text className="text-gray-600 mb-1">Sex</Text>
      <View className="flex-row gap-2 mb-4">
        {(['male', 'female', 'other'] as const).map(s => (
          <Pressable key={s} onPress={() => setSex(s)} className={`flex-1 py-3 rounded-lg border items-center ${sex === s ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
            <Text className={sex === s ? 'text-white' : 'text-gray-700'}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-gray-600 mb-1">Height (cm)</Text>
      <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} placeholder="e.g. 175" />
      <Text className="text-gray-600 mb-1">Current weight (kg)</Text>
      <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-4" keyboardType="decimal-pad" value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 75" />
      <Text className="text-gray-600 mb-1">Activity level</Text>
      <View className="gap-2 mb-8">
        {ACTIVITY_LEVELS.map(level => (
          <Pressable key={level} onPress={() => setActivityLevel(level)} className={`py-3 px-4 rounded-lg border ${activityLevel === level ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
            <Text className={activityLevel === level ? 'text-white' : 'text-gray-700'}>{level}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-8" onPress={handleNext} disabled={loading}>
        <Text className="text-white font-semibold text-base">Next: Set goals</Text>
      </Pressable>
    </ScrollView>
  )
}
