import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useActivityStore } from '../stores/activityStore'
import { ActivityType } from '../types'

const TYPES: ActivityType[] = ['walk', 'run', 'gym', 'cycle', 'swim', 'yoga', 'other']

export default function ActivityScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { todayActivity, fetchTodayActivity, addActivity, loading, error } = useActivityStore()
  const [type, setType] = useState<ActivityType>('walk')
  const [duration, setDuration] = useState('')
  const [steps, setSteps] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => { if (user) fetchTodayActivity(user.id) }, [user])

  const handleSave = async () => {
    if (!user) return
    const result = await addActivity({
      user_id: user.id,
      activity_type: type,
      duration_min: parseInt(duration, 10) || 0,
      steps: parseInt(steps, 10) || 0,
      calories_burned: parseInt(calories, 10) || 0,
      notes,
    })
    if (result) { setDuration(''); setSteps(''); setCalories(''); setNotes('') }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">Log activity</Text>
      </View>

      {error && <Text className="text-red-500 mx-6 mt-4">{error}</Text>}

      <View className="px-6 pt-4">
        <Text className="text-gray-600 mb-1">Type</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} className={`px-4 py-2 rounded-lg border ${type === t ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
              <Text className={type === t ? 'text-white' : 'text-gray-700'}>{t}</Text>
            </Pressable>
          ))}
        </View>
        {[
          { label: 'Duration (min)', value: duration, setter: setDuration },
          { label: 'Steps', value: steps, setter: setSteps },
          { label: 'Calories burned (kcal)', value: calories, setter: setCalories },
        ].map(({ label, value, setter }) => (
          <View key={label} className="mb-4">
            <Text className="text-gray-600 mb-1">{label}</Text>
            <TextInput className="border border-gray-300 rounded-lg px-4 py-3" keyboardType="number-pad" value={value} onChangeText={setter} placeholder="0" />
          </View>
        ))}
        <Text className="text-gray-600 mb-1">Notes</Text>
        <TextInput className="border border-gray-300 rounded-lg px-4 py-3 mb-6" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
        <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-6" onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Save activity</Text>}
        </Pressable>

        <Text className="font-semibold text-gray-700 mb-3">Today's activity</Text>
        {todayActivity.length === 0
          ? <Text className="text-gray-400 text-center py-8">No activity logged yet today</Text>
          : todayActivity.map((a) => (
            <View key={a.id} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <View className="flex-row justify-between">
                <Text className="font-semibold text-gray-900 capitalize">{a.activity_type}</Text>
                <Text className="text-green-700 font-bold">{a.calories_burned} kcal</Text>
              </View>
              <Text className="text-xs text-gray-500 mt-1">{a.duration_min} min · {a.steps} steps</Text>
              {a.notes ? <Text className="text-xs text-gray-500 mt-1">{a.notes}</Text> : null}
            </View>
          ))}
      </View>
    </ScrollView>
  )
}
