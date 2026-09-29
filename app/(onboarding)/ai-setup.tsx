import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { AiProvider } from '../../types'

const PROVIDERS: { id: AiProvider; label: string; description: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', description: 'Best reasoning and nuanced health advice' },
  { id: 'openai', label: 'GPT-4o (OpenAI)', description: 'Great all-round performance' },
  { id: 'gemini', label: 'Gemini (Google)', description: 'Fast and capable' },
]

export default function AiSetupScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { upsertProfile, loading } = useProfileStore()
  const [selected, setSelected] = useState<AiProvider>('claude')

  const handleFinish = async () => {
    if (!user) return
    await upsertProfile({ id: user.id, ai_provider: selected })
    router.replace('/(tabs)')
  }

  return (
    <View className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold mb-2 text-gray-900">Choose your AI</Text>
      <Text className="text-gray-500 mb-6">This powers your health coach. You can change it later in settings.</Text>
      {PROVIDERS.map(p => (
        <Pressable key={p.id} onPress={() => setSelected(p.id)} className={`p-4 rounded-xl border mb-3 ${selected === p.id ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
          <Text className="font-semibold text-gray-900">{p.label}</Text>
          <Text className="text-gray-500 text-sm mt-1">{p.description}</Text>
        </Pressable>
      ))}
      <Pressable className="bg-green-600 rounded-lg py-4 items-center mt-6" onPress={handleFinish} disabled={loading}>
        <Text className="text-white font-semibold text-base">Start coaching</Text>
      </Pressable>
    </View>
  )
}
