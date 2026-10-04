import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, HeartPulse, LogOut } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { Screen, Heading, Text, Card, PressableCard, Button } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

export default function SettingsScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { signOut, loading: authLoading, error: authError } = useAuthStore()

  return (
    <Screen scroll>
      <View className="mt-1 mb-6">
        <Heading level={1} uppercase>
          Settings
        </Heading>
      </View>

      {authError ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">
            {authError}
          </Text>
        </View>
      ) : null}

      <Heading level={4} uppercase className="mb-3">
        Account
      </Heading>
      <View className="gap-3 mb-6">
        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(onboarding)/profile?mode=edit')}
        >
          <Text variant="body">Edit health profile</Text>
          <ChevronRight size={20} color={colors.mutedForeground} />
        </PressableCard>
        <PressableCard
          className="flex-row items-center justify-between"
          onPress={() => router.push('/(onboarding)/goals?mode=edit')}
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
