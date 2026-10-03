import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { Check } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useProfileStore } from '../../stores/profileStore'
import { AiProvider } from '../../types'
import { Screen, Heading, Text, PressableCard, Button } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

const PROVIDERS: { id: AiProvider; label: string; description: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', description: 'Best reasoning and nuanced health advice' },
  { id: 'openai', label: 'GPT-4o (OpenAI)', description: 'Great all-round performance' },
  { id: 'gemini', label: 'Gemini (Google)', description: 'Fast and capable' },
]

export default function AiSetupScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { upsertProfile, loading, error } = useProfileStore()
  const [selected, setSelected] = useState<AiProvider>('claude')

  const handleFinish = async () => {
    if (!user) return
    await upsertProfile({ id: user.id, ai_provider: selected })
    if (useProfileStore.getState().error === null) {
      router.replace('/(tabs)')
    }
  }

  return (
    <Screen scroll footer={<Button label="Start coaching" loading={loading} onPress={handleFinish} />}>
      <View className="mt-1 mb-6">
        <Text variant="caption" muted className="uppercase tracking-wide">
          Step 3 of 3
        </Text>
        <Heading level={1} uppercase>
          Choose your AI
        </Heading>
        <Text variant="body" muted className="mt-1">
          This powers your health coach. You can change it later in settings.
        </Text>
      </View>

      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {error}
          </Text>
        </View>
      ) : null}

      <View className="gap-3">
        {PROVIDERS.map((p) => {
          const isSelected = selected === p.id
          return (
            <PressableCard
              key={p.id}
              onPress={() => setSelected(p.id)}
              className={isSelected ? 'bg-primary-soft border-primary' : ''}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text variant="label">{p.label}</Text>
                  <Text variant="bodySm" muted className="mt-1">
                    {p.description}
                  </Text>
                </View>
                {isSelected ? (
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
                    <Check size={16} color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
            </PressableCard>
          )
        })}
      </View>
    </Screen>
  )
}
