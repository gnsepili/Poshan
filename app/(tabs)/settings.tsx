import { Pressable, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Check, ChevronRight, HeartPulse, LogOut } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { AiProvider } from '../../types'
import { Screen, Heading, Text, Card, PressableCard, Button } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

const PROVIDERS: { id: AiProvider; label: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'GPT-4o (OpenAI)' },
  { id: 'gemini', label: 'Gemini (Google)' },
]

export default function SettingsScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user, signOut, loading: authLoading, error: authError } = useAuthStore()
  const { profile, upsertProfile, loading: profileLoading, error: profileError } = useProfileStore()

  const errorMessage = authError ?? profileError

  const changeProvider = async (provider: AiProvider) => {
    if (!user) return
    await upsertProfile({ id: user.id, ai_provider: provider })
  }

  return (
    <Screen scroll>
      <View className="mt-1 mb-6">
        <Heading level={1} uppercase>
          Settings
        </Heading>
      </View>

      {errorMessage ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <Heading level={4} uppercase className="mb-3">
        AI provider
      </Heading>
      <Card padded={false} className="mb-6 overflow-hidden">
        {PROVIDERS.map((p, i) => {
          const isSelected = profile?.ai_provider === p.id
          return (
            <Pressable
              key={p.id}
              onPress={() => changeProvider(p.id)}
              disabled={profileLoading}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: profileLoading }}
              className={`min-h-[44px] px-4 py-4 flex-row justify-between items-center active:bg-surface-muted ${
                i < PROVIDERS.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <Text variant="body">{p.label}</Text>
              {isSelected ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          )
        })}
      </Card>

      <Heading level={4} uppercase className="mb-3">
        Account
      </Heading>
      <View className="gap-3 mb-6">
        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(onboarding)/profile')}
        >
          <Text variant="body">Edit health profile</Text>
          <ChevronRight size={20} color={colors.mutedForeground} />
        </PressableCard>
        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(onboarding)/goals')}
        >
          <Text variant="body">Edit goals</Text>
          <ChevronRight size={20} color={colors.mutedForeground} />
        </PressableCard>
      </View>

      <Heading level={4} uppercase className="mb-3">
        Integrations
      </Heading>
      <PressableCard className="mb-8" onPress={() => router.push('/health-connect')}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1 pr-3">
            <HeartPulse size={20} color={colors.primary} />
            <View className="flex-1">
              <Text variant="label">Health Connect</Text>
              <Text variant="caption" muted className="mt-0.5">
                Auto-sync steps, calories, heart rate and workouts (Android)
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.mutedForeground} />
        </View>
      </PressableCard>

      <View className="border-t border-border pt-6 mb-4">
        <Button label="Sign out" variant="danger" icon={LogOut} loading={authLoading} onPress={signOut} />
      </View>
    </Screen>
  )
}
