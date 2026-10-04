import { ActivityIndicator, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Text } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

// Deep-link target for poshanai://auth-callback after Google sign-in. The auth store
// finishes the code exchange; the root layout's guard then routes the user onward.
export default function AuthCallbackScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  return (
    <View className="flex-1 items-center justify-center bg-background px-8 gap-4">
      <ActivityIndicator color={colors.primary} />
      <Text variant="body" muted>Finishing sign-in…</Text>
      <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </View>
  )
}
