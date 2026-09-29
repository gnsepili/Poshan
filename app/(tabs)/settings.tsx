import { View, Text, Pressable, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { AiProvider } from '../../types'

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'GPT-4o (OpenAI)' },
  { id: 'gemini', label: 'Gemini (Google)' },
]

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut, loading: authLoading, error: authError } = useAuthStore()
  const { profile, upsertProfile, loading: profileLoading, error: profileError } = useProfileStore()

  const errorMessage = authError ?? profileError

  const changeProvider = async (provider: AiProvider) => {
    if (!user) return
    await upsertProfile({ id: user.id, ai_provider: provider })
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
      </View>

      {errorMessage && (
        <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <Text className="text-red-600 text-sm">{errorMessage}</Text>
        </View>
      )}

      <View className="px-4 pt-4">
        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">AI Provider</Text>
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          {PROVIDERS.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => changeProvider(p.id)}
              disabled={profileLoading}
              className={`px-4 py-4 flex-row justify-between items-center ${i < PROVIDERS.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <Text className="text-gray-900">{p.label}</Text>
              {profile?.ai_provider === p.id && <Text className="text-green-600 font-semibold">✓</Text>}
            </Pressable>
          ))}
        </View>

        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">Account</Text>
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          <Pressable className="px-4 py-4 border-b border-gray-100" onPress={() => router.push('/(onboarding)/profile')}>
            <Text className="text-gray-900">Edit health profile</Text>
          </Pressable>
          <Pressable className="px-4 py-4" onPress={() => router.push('/(onboarding)/goals')}>
            <Text className="text-gray-900">Edit goals</Text>
          </Pressable>
        </View>

        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">Integrations</Text>
        <View className="mb-4">
          <Pressable className="bg-white rounded-xl border border-gray-100 px-4 py-4" onPress={() => router.push('/health-connect')}>
            <Text className="text-gray-800 font-semibold">Health Connect</Text>
            <Text className="text-gray-500 text-xs mt-1">Auto-sync steps, calories, heart rate and workouts (Android)</Text>
          </Pressable>
        </View>

        <Pressable
          className="bg-red-50 rounded-xl border border-red-100 px-4 py-4 items-center mb-8"
          onPress={signOut}
          disabled={authLoading}
        >
          <Text className="text-red-600 font-semibold">Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
